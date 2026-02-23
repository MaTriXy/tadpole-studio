from fastapi import APIRouter
from pydantic import BaseModel, Field

from tadpole_studio.models.common import HealthResponse, SettingsResponse, SettingsUpdate
from tadpole_studio.services.generation import generation_service
from tadpole_studio.backends.base import BackendType
from tadpole_studio.db.connection import get_db

router = APIRouter(tags=["health"])


class BackendStatus(BaseModel):
    backend_type: str
    ready: bool
    init_stage: str = ""
    init_error: str = ""
    device: str = ""


class BackendCapabilitiesResponse(BaseModel):
    supported_task_types: list[str]
    supports_batch: bool
    supports_progress_callback: bool
    supported_audio_formats: list[str]
    max_duration_seconds: float
    supports_bpm_control: bool
    supports_keyscale_control: bool
    supports_timesignature_control: bool
    supports_instrumental_toggle: bool
    supports_thinking: bool
    supports_seed: bool


class BackendInfo(BaseModel):
    backend_type: str
    ready: bool
    init_stage: str = ""
    init_error: str = ""
    device: str = ""
    download_progress: float = 0.0
    capabilities: BackendCapabilitiesResponse


class BackendsResponse(BaseModel):
    active_backend: str
    backends: list[BackendInfo]


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    svc = generation_service
    active = svc.get_backend(svc.active_backend_type)
    active_ready = active.is_ready if active else False

    # When HeartMuLa is active, report its readiness for dit/lm fields
    # so the connection banner works correctly for any backend
    if svc.active_backend_type == BackendType.HEARTMULA:
        status = "ok" if active_ready else "degraded"
        init_stage = active.init_stage if active else "idle"
        init_error = active.init_error if active else ""
        return HealthResponse(
            status=status,
            dit_model_loaded=active_ready,
            lm_model_loaded=active_ready,
            dit_model="",
            lm_model="",
            device=active.device if active else "",
            init_stage=init_stage,
            init_error=init_error,
            download_progress=active.download_progress if active else 0.0,
            active_backend=svc.active_backend_type.value,
        )

    status = "ok" if svc.dit_initialized else "degraded"
    return HealthResponse(
        status=status,
        dit_model_loaded=svc.dit_initialized,
        lm_model_loaded=svc.lm_initialized,
        dit_model=svc.active_dit_model,
        lm_model=svc.active_lm_model,
        device=svc.device,
        init_stage=svc.init_stage,
        init_error=svc.init_error,
        download_progress=svc.download_progress,
        active_backend=svc.active_backend_type.value,
    )


@router.get("/backends", response_model=BackendsResponse)
async def get_backends() -> BackendsResponse:
    svc = generation_service
    backends_info: list[BackendInfo] = []

    for bt, backend in svc.backends.items():
        caps = backend.capabilities()
        backends_info.append(BackendInfo(
            backend_type=bt.value,
            ready=backend.is_ready,
            init_stage=backend.init_stage,
            init_error=backend.init_error,
            device=backend.device,
            download_progress=backend.download_progress,
            capabilities=BackendCapabilitiesResponse(
                supported_task_types=list(caps.supported_task_types),
                supports_batch=caps.supports_batch,
                supports_progress_callback=caps.supports_progress_callback,
                supported_audio_formats=list(caps.supported_audio_formats),
                max_duration_seconds=caps.max_duration_seconds,
                supports_bpm_control=caps.supports_bpm_control,
                supports_keyscale_control=caps.supports_keyscale_control,
                supports_timesignature_control=caps.supports_timesignature_control,
                supports_instrumental_toggle=caps.supports_instrumental_toggle,
                supports_thinking=caps.supports_thinking,
                supports_seed=caps.supports_seed,
            ),
        ))

    return BackendsResponse(
        active_backend=svc.active_backend_type.value,
        backends=backends_info,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    db = await get_db()
    cursor = await db.execute("SELECT key, value FROM settings")
    rows = await cursor.fetchall()
    return SettingsResponse(settings={row["key"]: row["value"] for row in rows})


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate) -> SettingsResponse:
    db = await get_db()
    for key, value in body.settings.items():
        await db.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value),
        )
    await db.commit()
    return await get_settings()
