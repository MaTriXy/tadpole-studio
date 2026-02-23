import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any

from loguru import logger

from tadpole_studio.config import settings
from tadpole_studio.models.training import (
    AudioFileInfo,
    DatasetConfig,
    DatasetConfigSummary,
    DatasetInfo,
    TrainingPreset,
    TrainingStartRequest,
    TrainingStatusResponse,
    TrainingUpdateMessage,
)
from tadpole_studio.services.gpu_lock import gpu_lock
from tadpole_studio.ws.manager import training_ws_manager

from datetime import datetime, timezone


def _mps_available() -> bool:
    """Check if MPS backend is available (Apple Silicon)."""
    try:
        import torch
        return hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    except Exception:
        return False


class TrainingService:
    """Wraps FixedLoRATrainer and preprocess_audio_files with WebSocket progress."""

    def __init__(self) -> None:
        self._training_task: asyncio.Task | None = None
        self._training_state: dict[str, Any] = {"should_stop": False}
        self._preprocess_task: asyncio.Task | None = None
        self._preprocess_cancel: bool = False

        self._status: str = "idle"
        self._current_step: int = 0
        self._current_epoch: int = 0
        self._max_epochs: int = 0
        self._latest_loss: float = 0.0
        self._output_name: str = ""

    @property
    def is_training(self) -> bool:
        return self._status in ("training", "loading_model", "stopping")

    def scan_datasets(self) -> list[DatasetInfo]:
        """Scan DATASETS_DIR for dirs containing .pt files."""
        datasets_dir = settings.DATASETS_DIR
        results: list[DatasetInfo] = []

        if not datasets_dir.exists():
            return results

        for entry in datasets_dir.iterdir():
            if not entry.is_dir():
                continue

            pt_files = list(entry.glob("*.pt"))
            if not pt_files:
                continue

            size_mb = sum(f.stat().st_size for f in pt_files) / (1024 * 1024)
            has_config = (entry / "config.json").exists()
            results.append(DatasetInfo(
                name=entry.name,
                path=str(entry),
                sample_count=len(pt_files),
                size_mb=round(size_mb, 1),
                has_config=has_config,
            ))

        # Newest first (by directory mtime)
        results.sort(key=lambda d: Path(d.path).stat().st_mtime, reverse=True)
        return results

    def delete_dataset(self, name: str) -> bool:
        """Delete a preprocessed dataset directory."""
        dataset_path = settings.DATASETS_DIR / name
        if not dataset_path.exists() or not dataset_path.is_dir():
            return False
        # Safety: ensure the path is actually inside DATASETS_DIR
        if settings.DATASETS_DIR not in dataset_path.resolve().parents:
            return False
        shutil.rmtree(dataset_path)
        logger.info(f"Deleted dataset: {name}")
        return True

    def scan_presets(self) -> list[TrainingPreset]:
        """Read preset JSON files from ACE-Step presets directory."""
        import acestep.training_v2
        presets_dir = Path(acestep.training_v2.__file__).parent / "presets"
        results: list[TrainingPreset] = []

        if not presets_dir.exists():
            return results

        for json_file in sorted(presets_dir.glob("*.json")):
            try:
                with open(json_file) as f:
                    data = json.load(f)
                results.append(TrainingPreset(
                    name=data.get("name", json_file.stem),
                    description=data.get("description", ""),
                    config=data,
                ))
            except Exception as e:
                logger.warning(f"Failed to read preset {json_file}: {e}")

        return results

    # ── Dataset config methods ──────────────────────────────────────

    _AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a"}

    def scan_audio_files(self, audio_dir: str) -> list[AudioFileInfo]:
        """Scan a directory for audio files and return their info."""
        audio_dir = audio_dir.strip().strip("'\"")
        audio_path = Path(audio_dir)
        if not audio_path.exists() or not audio_path.is_dir():
            raise FileNotFoundError(f"Directory not found: {audio_dir}")

        results: list[AudioFileInfo] = []
        for entry in sorted(audio_path.iterdir()):
            if not entry.is_file():
                continue
            if entry.suffix.lower() not in self._AUDIO_EXTENSIONS:
                continue

            duration: float | None = None
            try:
                from mutagen import File as MutagenFile
                mf = MutagenFile(str(entry))
                if mf is not None and mf.info is not None:
                    duration = round(mf.info.length, 2)
            except Exception:
                pass

            results.append(AudioFileInfo(
                filename=entry.name,
                audio_path=str(entry),
                duration=duration,
            ))

        return results

    def save_dataset_config(self, config: DatasetConfig) -> str:
        """Save config to data/dataset-configs/{name}.json. Returns path."""
        import re
        safe_name = re.sub(r"[^\w\-.]", "_", config.name.strip())
        if not safe_name:
            raise ValueError("Config name is empty after sanitization")

        out_path = settings.DATASET_CONFIGS_DIR / f"{safe_name}.json"
        out_path.write_text(
            json.dumps(config.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info(f"Saved dataset config: {out_path}")
        return str(out_path)

    def list_dataset_configs(self) -> list[DatasetConfigSummary]:
        """List saved dataset configs, newest first."""
        configs_dir = settings.DATASET_CONFIGS_DIR
        results: list[tuple[float, DatasetConfigSummary]] = []

        if not configs_dir.exists():
            return []

        for json_file in configs_dir.glob("*.json"):
            try:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                audio_dir = data.get("audio_dir", "")
                results.append((
                    json_file.stat().st_mtime,
                    DatasetConfigSummary(
                        name=data.get("name", json_file.stem),
                        audio_dir=audio_dir,
                        sample_count=len(data.get("samples", [])),
                        audio_dir_missing=bool(audio_dir) and not Path(audio_dir).is_dir(),
                    ),
                ))
            except Exception as e:
                logger.warning(f"Failed to read config {json_file}: {e}")

        # Newest first
        results.sort(key=lambda t: t[0], reverse=True)
        return [summary for _, summary in results]

    def load_dataset_config(self, name: str) -> DatasetConfig:
        """Load a saved config by name."""
        import re
        safe_name = re.sub(r"[^\w\-.]", "_", name.strip())
        config_path = settings.DATASET_CONFIGS_DIR / f"{safe_name}.json"
        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {name}")

        data = json.loads(config_path.read_text(encoding="utf-8"))
        return DatasetConfig(**data)

    def delete_dataset_config(self, name: str) -> bool:
        """Delete a saved config by name."""
        import re
        safe_name = re.sub(r"[^\w\-.]", "_", name.strip())
        config_path = settings.DATASET_CONFIGS_DIR / f"{safe_name}.json"
        if not config_path.exists():
            return False
        # Safety: ensure path is inside DATASET_CONFIGS_DIR
        if settings.DATASET_CONFIGS_DIR not in config_path.resolve().parents:
            return False
        config_path.unlink()
        logger.info(f"Deleted dataset config: {name}")
        return True

    # ── Embedded dataset config ─────────────────────────────────

    def load_dataset_embedded_config(self, name: str) -> DatasetConfig:
        """Load config.json embedded inside a built dataset folder."""
        import re
        safe_name = re.sub(r"[^\w\-.]", "_", name.strip())
        config_path = settings.DATASETS_DIR / safe_name / "config.json"
        if not config_path.exists():
            raise FileNotFoundError(f"No embedded config for dataset: {name}")
        data = json.loads(config_path.read_text(encoding="utf-8"))
        return DatasetConfig(**data)

    def save_dataset_embedded_config(self, name: str, config: DatasetConfig) -> None:
        """Write config.json into a built dataset folder."""
        import re
        safe_name = re.sub(r"[^\w\-.]", "_", name.strip())
        dataset_dir = settings.DATASETS_DIR / safe_name
        dataset_dir.mkdir(parents=True, exist_ok=True)
        config_path = dataset_dir / "config.json"
        config_path.write_text(
            json.dumps(config.model_dump(), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # ── Preprocessing ─────────────────────────────────────────────

    async def preprocess(self, audio_dir: str, output_name: str,
                         variant: str = "turbo", max_duration: float = 240.0,
                         dataset_json: str | None = None) -> dict[str, Any]:
        """Run audio preprocessing in a background thread."""
        acquired = await gpu_lock.acquire("preprocessing")
        if not acquired:
            return {"error": f"GPU is busy ({gpu_lock.holder})"}

        # Strip surrounding quotes/whitespace that users may paste from terminal
        audio_dir = audio_dir.strip().strip("'\"")

        self._status = "preprocessing"
        self._preprocess_cancel = False
        output_dir = str(settings.DATASETS_DIR / output_name)
        checkpoint_dir = os.path.join(settings.ACESTEP_PROJECT_ROOT, "checkpoints")

        loop = asyncio.get_running_loop()

        def progress_callback(current: int, total: int, message: str) -> None:
            loop.call_soon_threadsafe(
                asyncio.ensure_future,
                training_ws_manager.broadcast({
                    "type": "info",
                    "step": current,
                    "loss": 0.0,
                    "msg": f"Preprocessing: {message} ({current}/{total})",
                    "epoch": 0,
                    "max_epochs": total,
                }),
            )

        def cancel_check() -> bool:
            return self._preprocess_cancel

        try:
            from acestep.training_v2.preprocess import preprocess_audio_files

            await training_ws_manager.broadcast({
                "type": "info",
                "step": 0,
                "loss": 0.0,
                "msg": "Preprocessing: Loading model...",
                "epoch": 0,
                "max_epochs": 0,
            })
            logger.info(f"Preprocessing: loading model (variant={variant})...")

            result = await asyncio.to_thread(
                preprocess_audio_files,
                audio_dir=audio_dir,
                output_dir=output_dir,
                checkpoint_dir=checkpoint_dir,
                variant=variant,
                max_duration=max_duration,
                dataset_json=dataset_json,
                device="auto",
                # MPS fp16 causes NaN in T5 text encoder; use fp32
                precision="fp32" if _mps_available() else "auto",
                progress_callback=progress_callback,
                cancel_check=cancel_check,
            )

            await training_ws_manager.broadcast({
                "type": "complete",
                "step": result.get("processed", 0),
                "loss": 0.0,
                "msg": f"Preprocessing complete: {result.get('processed', 0)} files",
            })

            return result
        except Exception as e:
            logger.exception("Preprocessing failed")
            await training_ws_manager.broadcast({
                "type": "fail",
                "step": 0,
                "loss": 0.0,
                "msg": f"Preprocessing failed: {e}",
            })
            return {"error": str(e)}
        finally:
            self._status = "idle"
            await gpu_lock.release("preprocessing")

    async def start_training(self, request: TrainingStartRequest) -> str:
        """Start LoRA training in a background task."""
        if self.is_training:
            return "Training already in progress"

        acquired = await gpu_lock.acquire("training")
        if not acquired:
            return f"GPU is busy ({gpu_lock.holder})"

        self._training_state = {"should_stop": False}
        self._output_name = request.output_name
        self._current_step = 0
        self._current_epoch = 0
        self._latest_loss = 0.0

        self._training_task = asyncio.create_task(self._run_training(request))
        return "Training started"

    @staticmethod
    def _write_training_meta(output_dir: str, request: TrainingStartRequest) -> None:
        """Write training_config.json and a human-readable README.md to output_dir."""
        out = Path(output_dir)
        if not out.exists():
            return

        config_data = {
            "output_name": request.output_name,
            "dataset_dir": request.dataset_dir,
            "adapter_type": request.adapter_type,
            "variant": request.variant,
            "rank": request.rank,
            "alpha": request.alpha,
            "dropout": request.dropout,
            "learning_rate": request.learning_rate,
            "batch_size": request.batch_size,
            "gradient_accumulation": request.gradient_accumulation,
            "epochs": request.epochs,
            "warmup_steps": request.warmup_steps,
            "optimizer_type": request.optimizer_type,
            "scheduler_type": request.scheduler_type,
            "gradient_checkpointing": request.gradient_checkpointing,
            "save_every": request.save_every,
            "preset": request.preset,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }
        (out / "training_config.json").write_text(
            json.dumps(config_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        lines = [
            f"# {request.output_name}",
            "",
            f"LoRA adapter trained with Tadpole Studio on {config_data['trained_at'][:10]}.",
            "",
            "## Training Configuration",
            "",
            f"| Parameter | Value |",
            f"|-----------|-------|",
        ]
        for key, value in config_data.items():
            if key in ("trained_at", "output_name"):
                continue
            label = key.replace("_", " ").title()
            lines.append(f"| {label} | `{value}` |")
        lines.append("")
        (out / "README.md").write_text("\n".join(lines), encoding="utf-8")

    async def _run_training(self, request: TrainingStartRequest) -> None:
        """Run training loop in background thread, broadcasting updates via WebSocket."""
        loop = asyncio.get_running_loop()

        try:
            self._status = "loading_model"
            await training_ws_manager.broadcast({
                "type": "info",
                "step": 0,
                "loss": 0.0,
                "msg": "Loading model for training...",
            })

            from tadpole_studio.services.generation import generation_service
            handler = generation_service.dit_handler
            if handler is None or handler.model is None:
                raise RuntimeError("DiT model not loaded")

            checkpoint_dir = os.path.join(settings.ACESTEP_PROJECT_ROOT, "checkpoints")
            output_dir = str(settings.TRAINING_OUTPUT_DIR / request.output_name)
            os.makedirs(output_dir, exist_ok=True)

            from acestep.training_v2.configs import LoRAConfigV2, LoKRConfigV2, TrainingConfigV2

            if request.adapter_type == "lokr":
                adapter_config = LoKRConfigV2(
                    linear_dim=request.rank,
                    linear_alpha=request.alpha,
                    attention_type="both",
                )
            else:
                adapter_config = LoRAConfigV2(
                    r=request.rank,
                    alpha=request.alpha,
                    dropout=request.dropout,
                    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
                    attention_type="both",
                )

            # Resolve "auto" to actual device
            import torch
            if torch.cuda.is_available():
                device = "cuda"
            elif torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"

            training_config = TrainingConfigV2(
                dataset_dir=request.dataset_dir,
                output_dir=output_dir,
                checkpoint_dir=checkpoint_dir,
                learning_rate=request.learning_rate,
                batch_size=request.batch_size,
                gradient_accumulation_steps=request.gradient_accumulation,
                max_epochs=request.epochs,
                warmup_steps=request.warmup_steps,
                save_every_n_epochs=request.save_every,
                seed=42,
                adapter_type=request.adapter_type,
                optimizer_type=request.optimizer_type,
                scheduler_type=request.scheduler_type,
                gradient_checkpointing=request.gradient_checkpointing,
                model_variant=request.variant,
                device=device,
                log_every=1,
            )

            # Patch missing _unwrap_decoder in ace-step 1.5.0
            # Must run BEFORE any trainer_fixed/trainer_helpers import
            # (trainer_helpers imports _unwrap_decoder from lora_utils at module level)
            import acestep.training.lora_utils as _lora_utils
            if not hasattr(_lora_utils, "_unwrap_decoder"):
                def _unwrap_decoder(model: Any) -> Any:
                    """Unwrap Fabric wrappers from the decoder, preserving PEFT.

                    Only strips Lightning Fabric's _forward_module wrappers.
                    The PEFT layer (PeftModel) is preserved so that
                    save_pretrained() saves adapter weights, not the full model.
                    """
                    decoder = getattr(model, "decoder", model)
                    while hasattr(decoder, "_forward_module"):
                        decoder = decoder._forward_module
                    return decoder
                _lora_utils._unwrap_decoder = _unwrap_decoder

            # Patch _select_fabric_precision: MPS mixed-precision (fp16 and bf16)
            # produces NaN in DiT attention layers. Use full fp32 for stable training.
            import acestep.training_v2.fixed_lora_module as _flm
            _orig_select = _flm._select_fabric_precision
            def _patched_select(device_type: str) -> str:
                if device_type == "mps":
                    return "32-true"
                return _orig_select(device_type)
            _flm._select_fabric_precision = _patched_select
            # Also patch the already-imported reference in trainer_fixed
            import acestep.training_v2.trainer_fixed as _tf
            _tf._select_fabric_precision = _patched_select

            # Patch _select_compute_dtype: MPS autocast with fp16/bf16 produces NaN
            # in the DiT attention layers. Use fp32 compute to avoid NaN loss.
            # Fabric's "bf16-mixed" still handles parameter storage efficiency.
            if hasattr(_flm, "_select_compute_dtype"):
                _orig_compute = _flm._select_compute_dtype
                def _patched_compute(device_type: str) -> "torch.dtype":
                    if device_type == "mps":
                        return torch.float32
                    return _orig_compute(device_type)
                _flm._select_compute_dtype = _patched_compute
                if hasattr(_tf, "_select_compute_dtype"):
                    _tf._select_compute_dtype = _patched_compute
                logger.info(f"Patched _select_compute_dtype: MPS will use float32 compute")

            # Patch Fabric.clip_gradients to handle non-finite gradients gracefully
            # instead of crashing. When NaN/Inf gradients occur, zero them out so
            # the subsequent optimizer.step() is a no-op (Adam skips grad=None params).
            import lightning.fabric.fabric as _lightning_fab
            _orig_clip = _lightning_fab.Fabric.clip_gradients
            def _safe_clip_gradients(self, module, optimizer, clip_val=None,
                                     max_norm=None, norm_type=2.0,
                                     error_if_nonfinite=True):
                try:
                    return _orig_clip(self, module, optimizer, clip_val=clip_val,
                                      max_norm=max_norm, norm_type=norm_type,
                                      error_if_nonfinite=True)
                except RuntimeError as e:
                    if "non-finite" in str(e):
                        logger.warning(
                            "Non-finite gradients detected, skipping optimizer step"
                        )
                        optimizer.zero_grad(set_to_none=True)
                        return None
                    raise
            _lightning_fab.Fabric.clip_gradients = _safe_clip_gradients

            from acestep.training_v2.trainer_fixed import FixedLoRATrainer

            self._status = "training"
            await training_ws_manager.broadcast({
                "type": "info",
                "step": 0,
                "loss": 0.0,
                "msg": "Training started",
                "max_epochs": request.epochs,
            })

            trainer = FixedLoRATrainer(
                model=handler.model,
                adapter_config=adapter_config,
                training_config=training_config,
            )

            def _train_loop() -> None:
                for update in trainer.train(training_state=self._training_state):
                    self._current_step = update.step
                    self._latest_loss = update.loss
                    if update.kind == "epoch":
                        self._current_epoch = update.epoch
                        self._max_epochs = update.max_epochs

                    # Write training config into checkpoint dirs
                    if update.checkpoint_path:
                        try:
                            self._write_training_meta(update.checkpoint_path, request)
                        except Exception:
                            pass

                    # Log progress to terminal
                    if update.kind in ("step", "epoch", "info", "complete", "fail"):
                        logger.info(update.msg)

                    msg_dict = {
                        "type": update.kind,
                        "step": update.step,
                        "loss": update.loss,
                        "msg": update.msg,
                        "epoch": update.epoch,
                        "max_epochs": update.max_epochs,
                        "lr": update.lr,
                        "epoch_time": update.epoch_time,
                        "samples_per_sec": update.samples_per_sec,
                        "steps_per_epoch": update.steps_per_epoch,
                        "checkpoint_path": update.checkpoint_path,
                    }

                    loop.call_soon_threadsafe(
                        asyncio.ensure_future,
                        training_ws_manager.broadcast(msg_dict),
                    )

            await asyncio.to_thread(_train_loop)

            # Write training config into the final output dir
            self._write_training_meta(output_dir, request)

        except Exception as e:
            logger.exception("Training failed")
            await training_ws_manager.broadcast({
                "type": "fail",
                "step": self._current_step,
                "loss": self._latest_loss,
                "msg": f"Training failed: {e}",
            })
        finally:
            self._status = "idle"
            self._training_task = None
            await gpu_lock.release("training")

    async def stop_training(self) -> str:
        if not self.is_training:
            return "No training in progress"
        self._status = "stopping"
        self._training_state["should_stop"] = True
        return "Stop signal sent"

    def get_status(self) -> TrainingStatusResponse:
        return TrainingStatusResponse(
            is_training=self.is_training,
            status=self._status,
            current_step=self._current_step,
            current_epoch=self._current_epoch,
            max_epochs=self._max_epochs,
            latest_loss=self._latest_loss,
            output_name=self._output_name,
        )


training_service = TrainingService()
