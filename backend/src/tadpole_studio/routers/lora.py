import json

from fastapi import APIRouter, HTTPException
from loguru import logger

from tadpole_studio.models.training import (
    LoraInfo,
    LoadLoraRequest,
    SetLoraScaleRequest,
    ToggleLoraRequest,
    LoraStatusResponse,
)
from tadpole_studio.services.lora_service import lora_service
from tadpole_studio.db.connection import get_db

router = APIRouter(prefix="/lora", tags=["lora"])

_ERROR_KEYWORDS = ("not loaded", "error", "not found", "failed", "no adapter")


def _check_lora_result(result: str) -> str:
    if result.startswith("❌") or any(kw in result.lower() for kw in _ERROR_KEYWORDS):
        logger.warning(f"LoRA operation failed: {result}")
        raise HTTPException(status_code=400, detail=result)
    return result


async def _persist_lora_state() -> None:
    """Save the current library state to the settings table."""
    try:
        state = lora_service.get_persistable_state()
        db = await get_db()
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('lora_state', ?, datetime('now'))",
            (json.dumps(state),),
        )
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist LoRA state: {e}")


@router.get("", response_model=list[LoraInfo])
async def list_loras() -> list[LoraInfo]:
    return lora_service.scan_loras()


@router.get("/status", response_model=LoraStatusResponse)
async def get_lora_status() -> LoraStatusResponse:
    status = lora_service.get_status()
    raw_adapters = status.get("adapters", [])
    scales = status.get("scales", {})

    # PEFT may register a spurious "default" adapter alongside the real one.
    # Only expose adapters the user explicitly loaded (tracked in scales).
    # When scales is empty (e.g. after toggle-off), fall back to raw list.
    adapters = list(scales.keys()) if scales else raw_adapters

    # Detect current adapter type from handler
    handler = lora_service._get_handler()
    adapter_type = getattr(handler, "_adapter_type", None) if handler else None

    # Use our own active selection as the source of truth.
    # The handler's active_adapter is unreliable for LoKr since LoKr
    # doesn't register in PEFT's adapter registry.
    is_active = status.get("active", False)
    active_adapter = (
        (lora_service._active_selection or status.get("active_adapter"))
        if is_active
        else None
    )

    return LoraStatusResponse(
        loaded=status.get("loaded", False),
        active=status.get("active", False),
        scale=status.get("scale", 1.0),
        active_adapter=active_adapter,
        adapter_type=adapter_type,
        adapters=adapters,
        scales=scales,
        known_adapters=lora_service.get_known_adapters_list(),
    )


@router.post("/add")
async def add_to_library(request: LoadLoraRequest) -> dict[str, str]:
    """Add an adapter to the library without loading to GPU."""
    result = lora_service.add_to_library(request.path, request.adapter_name)
    await _persist_lora_state()
    return {"message": result}


@router.delete("/known/{name:path}")
async def forget_adapter(name: str) -> dict[str, str]:
    """Remove an adapter from the library (and unload from GPU if loaded)."""
    result = lora_service.forget_adapter(name)
    await _persist_lora_state()
    return {"message": result}


@router.post("/load")
async def load_lora(request: LoadLoraRequest) -> dict[str, str]:
    result = lora_service.load_lora(request.path, request.adapter_name)
    _check_lora_result(result)
    await _persist_lora_state()
    return {"message": result}


@router.post("/{name:path}/unload")
async def unload_lora(name: str) -> dict[str, str]:
    result = lora_service.unload_lora(name)
    _check_lora_result(result)
    return {"message": result}


@router.post("/unload-all")
async def unload_all_loras() -> dict[str, str]:
    result = lora_service.unload_all()
    _check_lora_result(result)
    return {"message": result}


@router.patch("/{name:path}/scale")
async def set_scale(name: str, request: SetLoraScaleRequest) -> dict[str, str]:
    result = lora_service.set_scale(name, request.scale)
    _check_lora_result(result)
    return {"message": result}


@router.post("/toggle")
async def toggle_lora(request: ToggleLoraRequest) -> dict[str, str]:
    result = lora_service.toggle(request.enabled)
    _check_lora_result(result)
    return {"message": result}


@router.post("/{name:path}/activate")
async def activate_lora(name: str) -> dict[str, str]:
    result = lora_service.set_active(name)
    _check_lora_result(result)
    return {"message": result}
