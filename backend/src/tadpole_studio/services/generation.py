import asyncio
import uuid
import time
from typing import Any, Callable, Optional
from loguru import logger

from tadpole_studio.backends.base import BackendType, MusicBackend


class GenerationService:
    """Routes generation requests to the appropriate backend."""

    def __init__(self) -> None:
        self._backends: dict[BackendType, MusicBackend] = {}
        self._active_backend: BackendType = BackendType.ACE_STEP
        self.model_download_status: dict[str, str] = {}
        self._jobs: dict[str, dict[str, Any]] = {}
        self._cancelled: set[str] = set()
        self._switch_lock = asyncio.Lock()

    def register_backend(self, backend: MusicBackend) -> None:
        self._backends[backend.backend_type()] = backend

    def get_backend(self, backend_type: Optional[BackendType] = None) -> Optional[MusicBackend]:
        bt = backend_type or self._active_backend
        return self._backends.get(bt)

    @property
    def active_backend_type(self) -> BackendType:
        return self._active_backend

    def set_active_backend(self, backend_type: BackendType) -> None:
        self._active_backend = backend_type

    async def switch_backend(self, new_type: BackendType, init_kwargs: dict) -> tuple[str, bool]:
        """Unload current backend, load new one. Returns (message, success).

        Serialized via _switch_lock to prevent double-click race conditions.
        """
        async with self._switch_lock:
            old = self._backends.get(self._active_backend)
            new = self._backends.get(new_type)
            if new is None:
                return f"Backend '{new_type}' not registered", False

            # Persist LoRA state before unloading ACE-Step so it can be
            # restored when switching back later.
            if (old is not None and old.is_ready
                    and old.backend_type() != new_type
                    and self._active_backend == BackendType.ACE_STEP):
                from tadpole_studio.services.lora_service import lora_service
                await lora_service.persist_before_unload()

            # Unload old backend if it's loaded and different
            if old is not None and old.is_ready and old.backend_type() != new_type:
                logger.info(f"Unloading {self._active_backend.value}...")
                await old.unload()

            self._active_backend = new_type

            # Initialize new backend if not already ready
            if not new.is_ready:
                logger.info(f"Initializing {new_type.value}...")
                msg, ok = await new.initialize(**init_kwargs)
                # Restore LoRAs after ACE-Step re-initialization
                if ok and new_type == BackendType.ACE_STEP:
                    from tadpole_studio.services.lora_service import lora_service
                    await lora_service.restore_after_init()
                return msg, ok

            return f"{new_type.value} already loaded", True

    @property
    def backends(self) -> dict[BackendType, MusicBackend]:
        return self._backends

    # --- Backward-compat properties delegating to ACE-Step backend ---

    @property
    def _ace(self):
        from tadpole_studio.backends.ace_step_backend import AceStepBackend
        b = self._backends.get(BackendType.ACE_STEP)
        if isinstance(b, AceStepBackend):
            return b
        return None

    @property
    def _heartmula(self):
        from tadpole_studio.backends.heartmula_backend import HeartMuLaBackend
        b = self._backends.get(BackendType.HEARTMULA)
        if isinstance(b, HeartMuLaBackend):
            return b
        return None

    @property
    def dit_initialized(self) -> bool:
        ace = self._ace
        return ace.dit_initialized if ace else False

    @property
    def lm_initialized(self) -> bool:
        if self._active_backend == BackendType.HEARTMULA:
            hm = self._heartmula
            return hm.lm_initialized if hm else False
        ace = self._ace
        return ace.lm_initialized if ace else False

    @property
    def active_dit_model(self) -> str:
        ace = self._ace
        return ace.active_dit_model if ace else ""

    @property
    def active_lm_model(self) -> str:
        ace = self._ace
        return ace.active_lm_model if ace else ""

    @property
    def active_heartmula_model(self) -> str:
        hm = self._heartmula
        return hm.model_path if hm else ""

    @property
    def device(self) -> str:
        ace = self._ace
        return ace.device if ace else ""

    @property
    def init_stage(self) -> str:
        ace = self._ace
        return ace.init_stage if ace else "idle"

    @property
    def init_error(self) -> str:
        ace = self._ace
        return ace.init_error if ace else ""

    @property
    def download_progress(self) -> float:
        ace = self._ace
        return ace.download_progress if ace else 0.0

    @property
    def dit_handler(self):
        ace = self._ace
        return ace.dit_handler if ace else None

    # --- ACE-Step delegation methods ---

    async def initialize_dit(self, **kwargs: Any) -> tuple[str, bool]:
        ace = self._ace
        if ace is None:
            return "ACE-Step backend not registered", False
        return await ace.initialize_dit(**kwargs)

    async def initialize_lm(self, **kwargs: Any) -> tuple[str, bool]:
        ace = self._ace
        if ace is None:
            return "ACE-Step backend not registered", False
        return await ace.initialize_lm(**kwargs)

    async def create_sample(self, **kwargs: Any) -> dict[str, Any]:
        if self._active_backend == BackendType.HEARTMULA:
            hm = self._heartmula
            if hm is None:
                return {"success": False, "error": "HeartMuLa backend not registered"}
            return await hm.create_sample(**kwargs)
        ace = self._ace
        if ace is None:
            return {"success": False, "error": "ACE-Step backend not registered"}
        return await ace.create_sample(**kwargs)

    async def format_sample(self, **kwargs: Any) -> dict[str, Any]:
        ace = self._ace
        if ace is None:
            return {"success": False, "error": "ACE-Step backend not registered"}
        return await ace.format_sample(**kwargs)

    # --- Generation (routed by backend) ---

    async def generate(
        self,
        params_dict: dict[str, Any],
        progress_callback: Optional[Callable] = None,
    ) -> dict[str, Any]:
        backend_key = params_dict.pop("backend", None) or self._active_backend
        if isinstance(backend_key, str):
            try:
                backend_key = BackendType(backend_key)
            except ValueError:
                backend_key = self._active_backend

        backend = self._backends.get(backend_key)
        if backend is None:
            return {"success": False, "error": f"Backend '{backend_key}' not registered"}
        if not backend.is_ready:
            return {"success": False, "error": f"Backend '{backend_key}' not initialized"}

        return await backend.generate(params_dict, progress_callback=progress_callback)

    # --- Job management (unchanged) ---

    def create_job(self) -> str:
        job_id = str(uuid.uuid4())
        self._jobs[job_id] = {
            "status": "queued",
            "progress": 0.0,
            "stage": "",
            "results": [],
            "error": None,
            "created_at": time.time(),
        }
        return job_id

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        return self._jobs.get(job_id)

    def update_job(self, job_id: str, **kwargs: Any) -> None:
        if job_id in self._jobs:
            self._jobs[job_id].update(kwargs)

    def cancel_job(self, job_id: str) -> bool:
        self._cancelled.add(job_id)
        if job_id in self._jobs:
            self._jobs[job_id]["status"] = "cancelled"
            return True
        return False

    def is_cancelled(self, job_id: str) -> bool:
        return job_id in self._cancelled

    def cleanup_old_jobs(self, max_age_seconds: int = 3600) -> None:
        now = time.time()
        expired = [
            jid for jid, job in self._jobs.items()
            if now - job.get("created_at", 0) > max_age_seconds
        ]
        for jid in expired:
            del self._jobs[jid]


generation_service = GenerationService()
