import asyncio
import json
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger

from tadpole_studio.config import settings
from tadpole_studio.models.training import (
    AudioFileInfo,
    DatasetConfig,
    DatasetConfigSummary,
    DatasetInfo,
    PreprocessRequest,
    SaveDatasetConfigRequest,
    ScanAudioRequest,
    TrainingPreset,
    TrainingStartRequest,
    TrainingStatusResponse,
)
from tadpole_studio.services.training_service import training_service
from tadpole_studio.ws.manager import training_ws_manager

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/datasets", response_model=list[DatasetInfo])
async def list_datasets() -> list[DatasetInfo]:
    return training_service.scan_datasets()


@router.delete("/datasets/{name}")
async def delete_dataset(name: str) -> dict[str, str]:
    deleted = training_service.delete_dataset(name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"status": f"Deleted dataset: {name}"}


@router.get("/datasets/{name}/config", response_model=DatasetConfig)
async def load_dataset_embedded_config(name: str) -> DatasetConfig:
    try:
        return training_service.load_dataset_embedded_config(name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/scan-audio", response_model=list[AudioFileInfo])
async def scan_audio(request: ScanAudioRequest) -> list[AudioFileInfo]:
    try:
        return training_service.scan_audio_files(request.audio_dir)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/dataset-configs", response_model=dict[str, str])
async def save_dataset_config(request: SaveDatasetConfigRequest) -> dict[str, str]:
    try:
        path = training_service.save_dataset_config(request.config)
        return {"status": "saved", "path": path}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dataset-configs", response_model=list[DatasetConfigSummary])
async def list_dataset_configs() -> list[DatasetConfigSummary]:
    return training_service.list_dataset_configs()


@router.get("/dataset-configs/{name}", response_model=DatasetConfig)
async def load_dataset_config(name: str) -> DatasetConfig:
    try:
        return training_service.load_dataset_config(name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/dataset-configs/{name}")
async def delete_dataset_config(name: str) -> dict[str, str]:
    deleted = training_service.delete_dataset_config(name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"status": f"Deleted config: {name}"}


@router.post("/preprocess")
async def preprocess(request: PreprocessRequest) -> dict[str, str]:
    # Check if GPU is available before launching the background task
    if training_service.is_training:
        raise HTTPException(status_code=409, detail="Training already in progress")

    # Resolve dataset_json: if it looks like a config name (no path separators),
    # resolve it to the actual config file path.
    dataset_json = request.dataset_json
    if dataset_json and "/" not in dataset_json and "\\" not in dataset_json:
        safe_name = re.sub(r"[^\w\-.]", "_", dataset_json.strip())
        config_path = settings.DATASET_CONFIGS_DIR / f"{safe_name}.json"
        if config_path.exists():
            dataset_json = str(config_path)
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset config not found: {dataset_json}",
            )

    # Save config into the built dataset folder (not into dataset-configs/)
    if dataset_json and dataset_json.endswith(".json"):
        try:
            source_data = json.loads(Path(dataset_json).read_text(encoding="utf-8"))
            embedded_config = DatasetConfig(**source_data)
            embedded_config = embedded_config.model_copy(update={"name": request.output_name})
            training_service.save_dataset_embedded_config(request.output_name, embedded_config)
        except Exception as e:
            logger.warning(f"Failed to embed config in dataset folder: {e}")

    # Fire-and-forget: launch preprocessing as a background task and return immediately.
    # Progress is streamed via WebSocket.
    asyncio.create_task(training_service.preprocess(
        audio_dir=request.audio_dir,
        output_name=request.output_name,
        variant=request.variant,
        max_duration=request.max_duration,
        dataset_json=dataset_json,
    ))
    return {"status": "Preprocessing started"}


@router.get("/presets", response_model=list[TrainingPreset])
async def list_presets() -> list[TrainingPreset]:
    return training_service.scan_presets()


@router.post("/start")
async def start_training(request: TrainingStartRequest) -> dict[str, str]:
    result = await training_service.start_training(request)
    if "already running" in result.lower():
        raise HTTPException(status_code=409, detail=result)
    if "error" in result.lower() or "not loaded" in result.lower():
        raise HTTPException(status_code=503, detail=result)
    return {"status": result}


@router.post("/stop")
async def stop_training() -> dict[str, str]:
    result = await training_service.stop_training()
    return {"status": result}


@router.get("/status", response_model=TrainingStatusResponse)
async def get_training_status() -> TrainingStatusResponse:
    return training_service.get_status()


ws_router = APIRouter(tags=["websocket"])


@ws_router.websocket("/ws/training")
async def websocket_training(websocket: WebSocket) -> None:
    await training_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await training_ws_manager.disconnect(websocket)
