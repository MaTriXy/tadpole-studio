from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Optional


class BackendType(str, Enum):
    ACE_STEP = "ace-step"
    HEARTMULA = "heartmula"


@dataclass(frozen=True)
class BackendCapabilities:
    supported_task_types: tuple[str, ...]
    supports_batch: bool
    supports_progress_callback: bool
    supported_audio_formats: tuple[str, ...]
    max_duration_seconds: float
    supports_bpm_control: bool
    supports_keyscale_control: bool
    supports_timesignature_control: bool
    supports_instrumental_toggle: bool
    supports_thinking: bool
    supports_seed: bool


class MusicBackend(ABC):
    """Abstract base class for music generation backends."""

    @abstractmethod
    async def initialize(self, **kwargs: Any) -> tuple[str, bool]:
        """Initialize the backend. Returns (status_message, success)."""

    @abstractmethod
    async def unload(self) -> None:
        """Release all GPU resources. Backend returns to uninitialized state."""

    @abstractmethod
    async def generate(
        self,
        params_dict: dict[str, Any],
        progress_callback: Optional[Callable] = None,
    ) -> dict[str, Any]:
        """Run music generation. Returns result dict with 'success', 'audios', etc."""

    @abstractmethod
    def capabilities(self) -> BackendCapabilities:
        """Return the capabilities of this backend."""

    @abstractmethod
    def backend_type(self) -> BackendType:
        """Return the backend type identifier."""

    @property
    @abstractmethod
    def is_ready(self) -> bool:
        """Whether the backend is initialized and ready to generate."""

    @property
    @abstractmethod
    def device(self) -> str:
        """The device this backend is running on."""

    @property
    @abstractmethod
    def init_stage(self) -> str:
        """Current initialization stage."""

    @property
    @abstractmethod
    def init_error(self) -> str:
        """Error message from initialization, if any."""

    @property
    @abstractmethod
    def download_progress(self) -> float:
        """Download progress (0.0-1.0) during model download."""
