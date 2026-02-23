import sys
from unittest.mock import MagicMock

# Mock GPU-dependent modules before any tadpole_studio import
for mod_name in [
    "acestep", "acestep.handler", "acestep.llm_inference",
    "acestep.inference", "acestep.training_v2",
    "acestep.training_v2.preprocess", "acestep.training_v2.configs",
    "acestep.training_v2.trainer_fixed",
    "torch", "torch.cuda", "torch.backends", "torch.backends.mps",
]:
    sys.modules.setdefault(mod_name, MagicMock())

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture
async def client(tmp_path):
    """Provide httpx AsyncClient against the FastAPI app."""
    from tadpole_studio.config import settings

    # Point all paths to tmp_path — must set DB_PATH explicitly
    data_dir = tmp_path / "data"
    settings.DATA_DIR = data_dir
    settings.DB_PATH = data_dir / "tadpole-studio.db"
    settings.AUDIO_DIR = data_dir / "audio"
    settings.UPLOADS_DIR = data_dir / "uploads"
    settings.LORA_DIR = data_dir / "loras"
    settings.DATASETS_DIR = data_dir / "datasets"
    settings.TRAINING_OUTPUT_DIR = data_dir / "training_output"

    # Create dirs before init_db
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "audio").mkdir(exist_ok=True)
    (data_dir / "uploads").mkdir(exist_ok=True)
    (data_dir / "loras").mkdir(exist_ok=True)
    (data_dir / "datasets").mkdir(exist_ok=True)
    (data_dir / "training_output").mkdir(exist_ok=True)

    # Ensure generation service is uninitialized
    from tadpole_studio.services.generation import generation_service

    generation_service.dit_initialized = False
    generation_service.lm_initialized = False
    generation_service.device = "cpu"
    generation_service.active_dit_model = ""
    generation_service.active_lm_model = ""

    from tadpole_studio.db.connection import init_db, close_db

    await init_db()

    from tadpole_studio.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await close_db()
