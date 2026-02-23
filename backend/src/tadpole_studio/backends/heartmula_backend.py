import asyncio
import json
import os
import uuid
from typing import Any, Callable, Optional

from loguru import logger

from tadpole_studio.backends.base import BackendCapabilities, BackendType, MusicBackend
from tadpole_studio.config import settings


def _apply_mps_patches(pipeline, torch, logger):
    """Patch heartlib pipeline for MPS compatibility.

    Fixes four MPS-specific issues:
    1. _unload() calls torch.cuda APIs that crash on MPS
    2. _forward() uses torch.autocast which leaks ~11 GB/step on MPS
       (autocast creates cached fp32 weight copies per context entry)
    3. No torch.mps.synchronize() between steps, so async ops pile up
    4. HeartCodec transformer uses .type(tensor.type()) which returns
       'torch.mps.FloatTensor' -- an invalid type string on MPS
    """
    import gc as _gc
    import math as _math
    from tqdm import tqdm
    from heartlib.heartmula.modeling_heartmula import HeartMuLa as _HM
    from heartlib.heartcodec.modeling_heartcodec import HeartCodec as _HC
    from heartlib.heartcodec.models.transformer import PixArtAlphaCombinedFlowEmbeddings as _PACFE

    # --- Patch 1: MPS-compatible _unload ---
    def _mps_unload(pipe=pipeline):
        if not pipe.lazy_load:
            return
        if isinstance(pipe._mula, _HM):
            logger.debug("Unloading HeartMuLa from MPS")
            del pipe._mula
            pipe._mula = None
            _gc.collect()
            if hasattr(torch.mps, "empty_cache"):
                torch.mps.empty_cache()
        if isinstance(pipe._codec, _HC):
            logger.debug("Unloading HeartCodec from MPS")
            del pipe._codec
            pipe._codec = None
            _gc.collect()
            if hasattr(torch.mps, "empty_cache"):
                torch.mps.empty_cache()

    pipeline._unload = _mps_unload

    # --- Patch 2: Fix .type() returning invalid 'torch.mps.FloatTensor' ---
    # heartlib's PixArtAlphaCombinedFlowEmbeddings.timestep_embedding uses
    # .type(timesteps.type()) which returns 'torch.mps.FloatTensor' on MPS --
    # an invalid type string. Replace with .to(timesteps.dtype).
    def _mps_timestep_embedding(self, timesteps, max_period=10000, scale=1000):
        half = self.flow_t_size // 2
        freqs = torch.exp(
            -_math.log(max_period)
            * torch.arange(start=0, end=half, device=timesteps.device)
            / half
        ).to(timesteps.dtype)
        args = timesteps[:, None] * freqs[None] * scale
        embedding = torch.cat([torch.cos(args), torch.sin(args)], dim=-1)
        if self.flow_t_size % 2:
            embedding = torch.cat(
                [embedding, torch.zeros_like(embedding[:, :1])], dim=-1
            )
        return embedding

    _PACFE.timestep_embedding = _mps_timestep_embedding

    # --- Patch 3: MPS-compatible _forward (autocast without cache + sync) ---
    # torch.autocast on MPS leaks memory: its weight cache stores fp32
    # copies of fp16 weights per context entry that are never freed
    # (~11 GB/step). Using cache_enabled=False keeps dtype casting for
    # mixed-precision ops but disables the leaky cache.

    def _pad_audio_token(token, parallel_number, empty_id):
        padded = (
            torch.ones(
                (token.shape[0], parallel_number),
                device=token.device,
                dtype=torch.long,
            )
            * empty_id
        )
        padded[:, :-1] = token
        padded = padded.unsqueeze(1)
        padded_mask = torch.ones_like(padded, device=token.device, dtype=torch.bool)
        padded_mask[..., -1] = False
        return padded, padded_mask

    def _mps_forward(self, model_inputs, max_audio_length_ms, temperature, topk, cfg_scale):
      with torch.inference_mode():
        prompt_tokens = model_inputs["tokens"].to(self.mula_device)
        prompt_tokens_mask = model_inputs["tokens_mask"].to(self.mula_device)
        continuous_segment = model_inputs["muq_embed"].to(self.mula_device)
        starts = model_inputs["muq_idx"]
        prompt_pos = model_inputs["pos"].to(self.mula_device)
        frames = []

        bs_size = 2 if cfg_scale != 1.0 else 1
        self.mula.setup_caches(bs_size)

        # autocast with cache_enabled=False: keeps dtype casting (needed for
        # mixed fp16/fp32 ops like norms) but disables weight cache that leaks
        # ~11 GB/step on MPS
        _ac = lambda: torch.autocast(device_type=self.mula_device.type, dtype=self.mula_dtype, cache_enabled=False)

        with _ac():
            curr_token = self.mula.generate_frame(
                tokens=prompt_tokens,
                tokens_mask=prompt_tokens_mask,
                input_pos=prompt_pos,
                temperature=temperature,
                topk=topk,
                cfg_scale=cfg_scale,
                continuous_segments=continuous_segment,
                starts=starts,
            )
        torch.mps.synchronize()
        torch.mps.empty_cache()
        frames.append(curr_token[0:1,])

        max_audio_frames = max_audio_length_ms // 80

        _hook = getattr(self, '_progress_hook', None)

        for i in tqdm(range(max_audio_frames)):
            curr_token, curr_token_mask = _pad_audio_token(
                curr_token, self._parallel_number, self.config.empty_id
            )
            with _ac():
                curr_token = self.mula.generate_frame(
                    tokens=curr_token,
                    tokens_mask=curr_token_mask,
                    input_pos=prompt_pos[..., -1:] + i + 1,
                    temperature=temperature,
                    topk=topk,
                    cfg_scale=cfg_scale,
                    continuous_segments=None,
                    starts=None,
                )
            torch.mps.synchronize()
            torch.mps.empty_cache()
            if _hook:
                _hook(i + 1, max_audio_frames)
            if torch.any(curr_token[0:1, :] >= self.config.audio_eos_id):
                if _hook:
                    _hook(max_audio_frames, max_audio_frames)
                break
            frames.append(curr_token[0:1,])

        frames = torch.stack(frames).permute(1, 2, 0).squeeze(0)
        self._unload()
        return {"frames": frames}

    pipeline._forward = _mps_forward.__get__(pipeline, type(pipeline))


_HEARTMULA_CAPABILITIES = BackendCapabilities(
    supported_task_types=("text2music",),
    supports_batch=False,
    supports_progress_callback=True,
    supported_audio_formats=("mp3",),
    max_duration_seconds=240.0,
    supports_bpm_control=False,
    supports_keyscale_control=False,
    supports_timesignature_control=False,
    supports_instrumental_toggle=False,
    supports_thinking=False,
    supports_seed=False,
)


class HeartMuLaBackend(MusicBackend):
    """HeartMuLa music generation backend with superior lyrics controllability."""

    def __init__(self) -> None:
        self._pipeline = None
        self._initialized = False
        self._device = ""
        self._init_stage: str = "idle"
        self._init_error: str = ""
        self._download_progress: float = 0.0
        self._model_path: str = ""
        self._version: str = "3B"
        self._lazy_load: bool = False

    def backend_type(self) -> BackendType:
        return BackendType.HEARTMULA

    def capabilities(self) -> BackendCapabilities:
        return _HEARTMULA_CAPABILITIES

    @property
    def is_ready(self) -> bool:
        return self._initialized

    @property
    def device(self) -> str:
        return self._device

    @property
    def init_stage(self) -> str:
        return self._init_stage

    @property
    def init_error(self) -> str:
        return self._init_error

    @property
    def download_progress(self) -> float:
        return self._download_progress

    @property
    def model_path(self) -> str:
        return self._model_path

    @property
    def lm_initialized(self) -> bool:
        """True if any LLM provider is available for sample creation."""
        # Checked synchronously via a cached flag; async check done in create_sample
        return True  # Optimistic — create_sample will fail gracefully if none available

    async def _find_provider(self):
        """Find the first available LLM provider."""
        from tadpole_studio.services.llm_provider import get_all_providers

        priority = ["built-in", "openai", "anthropic", "ollama"]
        providers = get_all_providers()
        for name in priority:
            provider = providers.get(name)
            if provider and await provider.is_available():
                return provider, name
        return None, None

    async def create_sample(
        self, query: str, instrumental: bool = False, vocal_language: Optional[str] = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Generate HeartMuLa tags and lyrics from a user description via LLM."""
        provider, provider_name = await self._find_provider()
        if provider is None:
            return {
                "success": False,
                "error": (
                    "No LLM provider available. Configure one of: "
                    "built-in MLX chat model, OpenAI (TADPOLE_OPENAI_API_KEY), "
                    "Anthropic (TADPOLE_ANTHROPIC_API_KEY), or Ollama."
                ),
            }

        logger.info(f"HeartMuLa create_sample using provider '{provider_name}' for: {query[:80]}")

        lang_hint = f"The vocal language should be {vocal_language}." if vocal_language and vocal_language != "unknown" else ""
        instrumental_instruction = (
            'Since this is an instrumental track, set "lyrics" to an empty string "".'
            if instrumental
            else 'Write original song lyrics inspired by the description theme. Use section markers like [Verse], [Chorus], [Bridge], [Outro]. Write 2-3 verses and a chorus minimum. Do NOT use the description as lyrics — write actual song lyrics.'
        )

        system_prompt = (
            "You are a professional music producer and songwriter. "
            "Given a user's description of a song, generate structured metadata for music generation. "
            "You MUST respond with valid JSON only — no markdown, no explanation, no extra text."
        )

        user_prompt = (
            f'Song description: "{query}"\n\n'
            f"Generate the following as a JSON object:\n"
            f'1. "tags": comma-separated style descriptors for the song (genre, mood, instruments, tempo feel). '
            f"Example: \"piano,lo-fi,dreamy,mellow,slow\". Use 3-8 tags.\n"
            f'2. "lyrics": {instrumental_instruction}\n'
            f'3. "duration": track length in seconds (60-160). Default to 90-120 seconds unless the style calls for something shorter or longer. '
            f"Shorter for simple/lo-fi, longer for epic/orchestral.\n"
            f"{lang_hint}\n\n"
            f"Respond with ONLY the JSON object, no other text:\n"
            f'{{"tags": "...", "lyrics": "...", "duration": ...}}'
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw = ""
        try:
            models = provider.list_models()
            model = models[0] if models else ""
            raw = await provider.chat(messages, model=model, max_tokens=2048, temperature=0.7)

            # Parse JSON from response — strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                start = 1
                end = len(lines)
                while end > start and lines[end - 1].strip().startswith("```"):
                    end -= 1
                cleaned = "\n".join(lines[start:end])

            parsed = json.loads(cleaned)
            tags = parsed.get("tags", query)
            lyrics = parsed.get("lyrics", "")
            duration_raw = parsed.get("duration", 120)

            try:
                duration = max(60, min(160, int(duration_raw)))
            except (ValueError, TypeError):
                logger.warning(f"Invalid duration from LLM: {duration_raw!r}, using 120s")
                duration = 120

            logger.info(f"HeartMuLa sample created: tags='{tags[:60]}', duration={duration}s, lyrics_len={len(lyrics)}")

            return {
                "success": True,
                "heartmula_tags": tags,
                "lyrics": "" if instrumental else lyrics,
                "duration": float(duration),
                "instrumental": instrumental,
                "caption": "",
                "language": vocal_language or "",
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}\nRaw: {raw[:500]}")
            return {"success": False, "error": f"LLM returned invalid JSON: {e}"}
        except Exception as e:
            logger.exception("HeartMuLa create_sample failed")
            return {"success": False, "error": str(e)}

    async def unload(self) -> None:
        def _sync_unload():
            import gc
            import torch
            self._pipeline = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                if hasattr(torch.mps, "empty_cache"):
                    torch.mps.empty_cache()

        await asyncio.to_thread(_sync_unload)
        self._initialized = False
        self._device = ""
        self._init_stage = "idle"
        self._init_error = ""
        logger.info("HeartMuLa backend unloaded")

    async def initialize(self, **kwargs: Any) -> tuple[str, bool]:
        model_path = kwargs.get("model_path", "")
        version = kwargs.get("version", "3B")
        lazy_load = kwargs.get("lazy_load", False)
        device = kwargs.get("device", "auto")

        self._model_path = model_path
        self._version = version
        self._lazy_load = lazy_load

        if not model_path:
            self._init_stage = "idle"
            return "No model path configured", False

        self._init_stage = "loading_heartmula"

        try:
            def _sync_init():
                from heartlib import HeartMuLaGenPipeline
                import torch

                # Resolve device
                if device == "auto":
                    if torch.cuda.is_available():
                        resolved_device = torch.device("cuda")
                    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                        resolved_device = torch.device("mps")
                    else:
                        resolved_device = torch.device("cpu")
                else:
                    resolved_device = torch.device(device)

                # Pick dtype: bfloat16 for CUDA, float16 for MPS, float32 for CPU
                # HeartCodec should stay fp32 for audio quality (upstream recommendation)
                if resolved_device.type == "cuda":
                    dtype = torch.bfloat16
                elif resolved_device.type == "mps":
                    dtype = {"mula": torch.float16, "codec": torch.float32}
                else:
                    dtype = torch.float32

                # MPS: force lazy_load so only one model is in memory at a time
                use_lazy_load = lazy_load or (resolved_device.type == "mps")

                # Auto-download tokenizer.json and gen_config.json if missing
                tokenizer_path = os.path.join(model_path, "tokenizer.json")
                gen_config_path = os.path.join(model_path, "gen_config.json")
                if not os.path.isfile(tokenizer_path) or not os.path.isfile(gen_config_path):
                    logger.info("Downloading tokenizer.json and gen_config.json from HeartMuLa/HeartMuLaGen...")
                    from huggingface_hub import hf_hub_download
                    if not os.path.isfile(tokenizer_path):
                        hf_hub_download(
                            repo_id="HeartMuLa/HeartMuLaGen",
                            filename="tokenizer.json",
                            local_dir=model_path,
                        )
                    if not os.path.isfile(gen_config_path):
                        hf_hub_download(
                            repo_id="HeartMuLa/HeartMuLaGen",
                            filename="gen_config.json",
                            local_dir=model_path,
                        )
                    logger.info("Downloaded tokenizer.json and gen_config.json")

                pipeline = HeartMuLaGenPipeline.from_pretrained(
                    pretrained_path=model_path,
                    device=resolved_device,
                    dtype=dtype,
                    version=version,
                    lazy_load=use_lazy_load,
                )

                # MPS needs several patches to heartlib:
                # 1. _unload() uses CUDA-specific calls
                # 2. _forward() uses torch.autocast which leaks ~11 GB/step on MPS
                if resolved_device.type == "mps":
                    _apply_mps_patches(pipeline, torch, logger)

                return pipeline, str(resolved_device)

            pipeline, resolved_device = await asyncio.to_thread(_sync_init)

            self._pipeline = pipeline
            self._device = resolved_device
            self._initialized = True
            self._init_stage = "ready"
            logger.info(f"HeartMuLa initialized: {version} on {resolved_device}")
            return f"HeartMuLa {version} loaded on {resolved_device}", True

        except Exception as e:
            self._init_stage = "error"
            self._init_error = str(e)
            logger.exception("Failed to initialize HeartMuLa")
            return f"Error: {e}", False

    async def generate(
        self,
        params_dict: dict[str, Any],
        progress_callback: Optional[Callable] = None,
    ) -> dict[str, Any]:
        if not self._initialized or self._pipeline is None:
            return {"success": False, "error": "HeartMuLa not initialized"}

        lyrics = params_dict.get("lyrics", "")
        tags = params_dict.get("heartmula_tags", "")
        duration = params_dict.get("duration", 30.0)
        if duration <= 0:
            duration = 30.0
        duration = min(duration, _HEARTMULA_CAPABILITIES.max_duration_seconds)

        temperature = params_dict.get("heartmula_temperature", 1.0)
        topk = params_dict.get("heartmula_topk", 50)
        cfg_scale = params_dict.get("heartmula_cfg_scale", 1.5)

        settings.ensure_dirs()
        save_dir = str(settings.AUDIO_DIR)
        output_filename = f"heartmula_{uuid.uuid4().hex[:8]}.mp3"
        output_path = os.path.join(save_dir, output_filename)

        # Shared progress state — written by _forward thread, read by async poller
        frame_progress = {"current": 0, "total": 0}

        def _progress_hook(current: int, total: int) -> None:
            frame_progress["current"] = current
            frame_progress["total"] = total

        progress_task = None
        if progress_callback:
            async def _poll_progress():
                while True:
                    total = frame_progress["total"]
                    if total > 0:
                        progress = min(frame_progress["current"] / total, 0.95)
                    else:
                        progress = 0.0
                    progress_callback(progress, "Generating with HeartMuLa...")
                    await asyncio.sleep(1)

            progress_task = asyncio.create_task(_poll_progress())

        try:
            def _run_generation():
                try:
                    os.nice(10)
                except Exception:
                    pass

                import gc
                import torch
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    if hasattr(torch.mps, "empty_cache"):
                        torch.mps.empty_cache()

                # Attach progress hook to pipeline for _mps_forward to call
                self._pipeline._progress_hook = _progress_hook

                # HeartMuLaGenPipeline.__call__ accepts:
                #   inputs: {"tags": str, "lyrics": str}
                #   save_path, max_audio_length_ms, temperature, topk, cfg_scale
                inputs = {
                    "tags": tags or "music",
                    "lyrics": lyrics or " ",
                }

                self._pipeline(
                    inputs,
                    save_path=output_path,
                    max_audio_length_ms=int(duration * 1000),
                    temperature=temperature,
                    topk=topk,
                    cfg_scale=cfg_scale,
                )
                return output_path

            result_path = await asyncio.to_thread(_run_generation)

            # Cancel progress estimation
            if progress_task:
                progress_task.cancel()
                try:
                    await progress_task
                except asyncio.CancelledError:
                    pass

            if progress_callback:
                progress_callback(1.0, "Complete")

            return {
                "success": True,
                "audios": [{
                    "path": result_path,
                    "key": os.path.basename(result_path),
                    "sample_rate": 48000,
                    "params": {
                        "tags": tags,
                        "lyrics": lyrics,
                        "duration": duration,
                        "temperature": temperature,
                        "topk": topk,
                        "cfg_scale": cfg_scale,
                    },
                }],
            }

        except Exception as e:
            if progress_task:
                progress_task.cancel()
                try:
                    await progress_task
                except asyncio.CancelledError:
                    pass
            logger.exception("HeartMuLa generation failed")
            return {"success": False, "error": str(e)}
