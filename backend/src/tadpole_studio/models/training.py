from pydantic import BaseModel, Field
from typing import Any, Optional


class LoraInfo(BaseModel):
    name: str
    path: str
    adapter_type: str = "lora"  # "lora" | "lokr"
    size_mb: float = 0.0


class LoadLoraRequest(BaseModel):
    path: str
    adapter_name: Optional[str] = None


class SetLoraScaleRequest(BaseModel):
    adapter_name: str
    scale: float = Field(ge=0.0, le=2.0, default=1.0)


class ToggleLoraRequest(BaseModel):
    enabled: bool


class KnownAdapter(BaseModel):
    name: str
    path: str
    adapter_type: str = "lora"  # "lora" | "lokr"
    loaded: bool = False        # currently on GPU


class LoraStatusResponse(BaseModel):
    loaded: bool = False
    active: bool = False
    scale: float = 1.0
    active_adapter: Optional[str] = None
    adapter_type: Optional[str] = None
    adapters: list[str] = Field(default_factory=list)
    scales: dict[str, float] = Field(default_factory=dict)
    known_adapters: list[KnownAdapter] = Field(default_factory=list)


class DatasetInfo(BaseModel):
    name: str
    path: str
    sample_count: int = 0
    size_mb: float = 0.0
    has_config: bool = False


class PreprocessRequest(BaseModel):
    audio_dir: str
    output_name: str = Field(min_length=1)
    variant: str = "turbo"
    max_duration: float = Field(default=240.0, ge=1.0, le=600.0)
    dataset_json: Optional[str] = None


class TrainingPreset(BaseModel):
    name: str
    description: str = ""
    config: dict[str, Any] = Field(default_factory=dict)


class TrainingStartRequest(BaseModel):
    dataset_dir: str
    output_name: str = Field(min_length=1)
    preset: Optional[str] = None
    adapter_type: str = Field(default="lora", pattern=r"^(lora|lokr)$")
    rank: int = Field(default=64, ge=1, le=512)
    alpha: int = Field(default=128, ge=1, le=1024)
    dropout: float = Field(default=0.1, ge=0.0, le=1.0)
    learning_rate: float = Field(default=1e-4, gt=0.0, le=1.0)
    batch_size: int = Field(default=1, ge=1, le=16)
    gradient_accumulation: int = Field(default=4, ge=1, le=64)
    epochs: int = Field(default=100, ge=1, le=10000)
    warmup_steps: int = Field(default=100, ge=0, le=10000)
    optimizer_type: str = "adamw"
    scheduler_type: str = "cosine"
    gradient_checkpointing: bool = True
    save_every: int = Field(default=10, ge=1, le=1000)
    variant: str = "turbo"


class TrainingUpdateMessage(BaseModel):
    type: str = "step"
    step: int = 0
    loss: float = 0.0
    msg: str = ""
    epoch: int = 0
    max_epochs: int = 0
    lr: float = 0.0
    epoch_time: float = 0.0
    samples_per_sec: float = 0.0
    steps_per_epoch: int = 0
    checkpoint_path: str = ""


class TrainingStatusResponse(BaseModel):
    is_training: bool = False
    status: str = "idle"
    current_step: int = 0
    current_epoch: int = 0
    max_epochs: int = 0
    latest_loss: float = 0.0
    output_name: str = ""


class SwitchModelRequest(BaseModel):
    model_name: str
    backend: Optional[str] = None


class GpuStatsResponse(BaseModel):
    device: str = ""
    vram_used_mb: Optional[float] = None
    vram_total_mb: Optional[float] = None
    vram_percent: Optional[float] = None


# Dataset editor models


class ScanAudioRequest(BaseModel):
    audio_dir: str


class AudioFileInfo(BaseModel):
    filename: str
    audio_path: str
    duration: Optional[float] = None


class DatasetSample(BaseModel):
    filename: str = ""
    audio_path: str
    caption: str = ""
    genre: str = ""
    lyrics: str = "[Instrumental]"
    bpm: Optional[int] = None
    keyscale: str = ""
    timesignature: str = ""
    duration: Optional[float] = None
    is_instrumental: bool = True
    custom_tag: str = ""
    prompt_override: Optional[str] = None


class DatasetLevelMetadata(BaseModel):
    custom_tag: str = ""
    tag_position: str = "prepend"
    genre_ratio: int = Field(default=0, ge=0, le=100)


class DatasetConfig(BaseModel):
    """Saved inside data/dataset-configs/{name}.json."""

    name: str
    audio_dir: str
    metadata: DatasetLevelMetadata = Field(default_factory=DatasetLevelMetadata)
    samples: list[DatasetSample] = Field(default_factory=list)


class SaveDatasetConfigRequest(BaseModel):
    config: DatasetConfig


class DatasetConfigSummary(BaseModel):
    name: str
    audio_dir: str
    sample_count: int = 0
    audio_dir_missing: bool = False
