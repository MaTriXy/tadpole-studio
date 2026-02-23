import json
import shutil
from pathlib import Path

from loguru import logger

from tadpole_studio.config import settings
from tadpole_studio.models.training import KnownAdapter, LoraInfo


class LoraService:
    """Thin wrapper around dit_handler LoRA methods + LoRA directory scanning."""

    def __init__(self) -> None:
        # Library of known adapters: name → {path, adapter_type}
        # Persists across GPU load/unload cycles.
        self._known_adapters: dict[str, dict] = {}
        # Track which adapter the user selected (needed because LoKr
        # doesn't register in PEFT's adapter registry).
        self._active_selection: str | None = None

    def _get_handler(self):
        from tadpole_studio.services.generation import generation_service
        return generation_service.dit_handler

    @staticmethod
    def _is_peft_dir(path: Path) -> str | None:
        """Return adapter type if *path* is a PEFT adapter dir, else None."""
        if (path / "adapter_config.json").exists():
            return "lora"
        if (path / "lokr_weights.safetensors").exists():
            return "lokr"
        return None

    @staticmethod
    def _dir_size_mb(path: Path) -> float:
        return round(
            sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            / (1024 * 1024),
            1,
        )

    def scan_loras(self) -> list[LoraInfo]:
        """Scan LORA_DIR and TRAINING_OUTPUT_DIR for PEFT adapter dirs.

        LORA_DIR uses a flat layout: ``data/loras/{name}/adapter_config.json``.
        TRAINING_OUTPUT_DIR uses a nested layout produced by the trainer:
        ``data/training_output/{run}/final/`` and
        ``data/training_output/{run}/checkpoints/epoch_N/``.
        """
        results: list[LoraInfo] = []
        seen_names: set[str] = set()

        def _add(name: str, path: Path, adapter_type: str) -> None:
            if name in seen_names:
                return
            seen_names.add(name)
            results.append(LoraInfo(
                name=name,
                path=str(path),
                adapter_type=adapter_type,
                size_mb=self._dir_size_mb(path),
            ))

        # --- data/loras/ (flat: each child is an adapter dir) ---
        lora_dir = settings.LORA_DIR
        if lora_dir.exists():
            for entry in sorted(lora_dir.iterdir()):
                if not entry.is_dir():
                    continue
                atype = self._is_peft_dir(entry)
                if atype:
                    _add(entry.name, entry, atype)

        # --- data/training_output/ (nested: run/checkpoints/epoch_N/) ---
        # Each epoch checkpoint is listed individually so users can pick a
        # specific epoch.  final/ is skipped because it duplicates the last
        # checkpoint.
        training_out = getattr(settings, "TRAINING_OUTPUT_DIR", None)
        if training_out and training_out.exists():
            for run_dir in sorted(training_out.iterdir()):
                if not run_dir.is_dir():
                    continue

                ckpt_dir = run_dir / "checkpoints"
                if not ckpt_dir.is_dir():
                    continue

                for epoch_dir in sorted(ckpt_dir.iterdir()):
                    if not epoch_dir.is_dir():
                        continue
                    atype = self._is_peft_dir(epoch_dir)
                    if atype:
                        display_name = f"{run_dir.name}/{epoch_dir.name}"
                        _add(display_name, epoch_dir, atype)

        return results

    @staticmethod
    def _resolve_lora_path(path: str) -> str:
        """Resolve a LoRA path to the directory expected by PEFT.

        Users often paste a path to the .safetensors file itself rather than
        the containing directory.  If ``path`` points to a file whose parent
        directory contains ``adapter_config.json``, return the parent directory
        instead.  This makes loading work regardless of whether the user
        selects the file or the folder.
        """
        p = Path(path.strip().strip("'\""))
        if p.is_file() and (p.parent / "adapter_config.json").exists():
            return str(p.parent)
        return str(p)

    @staticmethod
    def _is_lokr_path(path: Path) -> bool:
        """Check if path points to a LoKr/LyCORIS adapter (after path resolution).

        After ``_resolve_lora_path``, PEFT adapters are always directories
        (containing adapter_config.json).  A standalone .safetensors file
        is a LoKr/LyCORIS artifact.
        """
        if path.is_file() and path.suffix == ".safetensors":
            return True
        if path.is_dir() and (path / "lokr_weights.safetensors").exists():
            return True
        return False

    def _detect_adapter_type(self, resolved: Path) -> str:
        """Detect whether a resolved path is lora or lokr."""
        return "lokr" if self._is_lokr_path(resolved) else "lora"

    def _copy_external_if_needed(self, resolved: Path, name: str) -> Path:
        """Copy external adapter dirs into data/loras/ for persistence."""
        lora_dir = settings.LORA_DIR
        training_out = getattr(settings, "TRAINING_OUTPUT_DIR", None)
        known_parents = [lora_dir]
        if training_out:
            known_parents.append(training_out)

        is_external = not any(
            resolved.is_relative_to(p)
            for p in known_parents
            if p.exists()
        )

        if is_external and resolved.is_dir():
            dest = lora_dir / name
            if not dest.exists():
                lora_dir.mkdir(parents=True, exist_ok=True)
                shutil.copytree(str(resolved), str(dest))
                logger.info(f"Copied external adapter to {dest}")
            return dest

        return resolved

    # ------------------------------------------------------------------
    # Library management (Models tab)
    # ------------------------------------------------------------------

    def add_to_library(self, path: str, name: str | None = None) -> str:
        """Add an adapter to the library WITHOUT loading to GPU."""
        resolved = Path(self._resolve_lora_path(path))
        adapter_type = self._detect_adapter_type(resolved)
        adapter_name = name or resolved.name

        if adapter_name in self._known_adapters:
            return f"Adapter '{adapter_name}' already in library"

        # Copy external dirs into data/loras/
        resolved = self._copy_external_if_needed(resolved, adapter_name)

        self._known_adapters[adapter_name] = {
            "path": str(resolved),
            "adapter_type": adapter_type,
        }
        type_label = "LoKr" if adapter_type == "lokr" else "LoRA"
        logger.info(f"Added {type_label} adapter '{adapter_name}' to library")
        return f"{type_label} adapter '{adapter_name}' added to library"

    def forget_adapter(self, name: str) -> str:
        """Remove an adapter from the library (and unload from GPU if loaded)."""
        handler = self._get_handler()
        if handler is not None and handler.lora_loaded:
            try:
                handler.remove_lora(name)
                logger.info(f"Unloaded adapter '{name}' from GPU")
            except Exception as e:
                logger.warning(f"Failed to unload '{name}' from GPU: {e}")

        removed = self._known_adapters.pop(name, None)
        if removed:
            type_label = "LoKr" if removed["adapter_type"] == "lokr" else "LoRA"
            return f"{type_label} adapter '{name}' removed from library"
        return f"Adapter '{name}' not found in library"

    def get_known_adapters_list(self) -> list[KnownAdapter]:
        """Return library entries with GPU-loaded status."""
        handler = self._get_handler()
        active_loras = {}
        if handler is not None and handler.lora_loaded:
            active_loras = getattr(handler, "_active_loras", {})

        return [
            KnownAdapter(
                name=name,
                path=info["path"],
                adapter_type=info["adapter_type"],
                loaded=name in active_loras,
            )
            for name, info in self._known_adapters.items()
        ]

    # ------------------------------------------------------------------
    # GPU loading (Create tab)
    # ------------------------------------------------------------------

    def load_lora(self, path: str, name: str | None = None) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        resolved = Path(self._resolve_lora_path(path))
        adapter_name = name or resolved.name

        # Idempotent: if already loaded on GPU, just return success
        if handler.lora_loaded:
            active_loras = getattr(handler, "_active_loras", {})
            if adapter_name in active_loras:
                adapter_type = self._detect_adapter_type(resolved)
                type_label = "LoKr" if adapter_type == "lokr" else "LoRA"
                return f"{type_label} adapter '{adapter_name}' already loaded"

        # PEFT LoRA and LyCORIS LoKr are architecturally incompatible —
        # they can't coexist on the same decoder.  Auto-unload existing
        # adapters when switching between types.
        if handler.lora_loaded:
            current_type = getattr(handler, "_adapter_type", None)
            incoming_is_lokr = self._is_lokr_path(resolved)
            if (current_type == "lokr" and not incoming_is_lokr) or \
               (current_type == "lora" and incoming_is_lokr):
                incoming_type = "lokr" if incoming_is_lokr else "lora"
                logger.info(
                    f"Switching adapter type ({current_type} -> {incoming_type}), "
                    "unloading existing adapters first"
                )
                self.unload_all()

        # Copy external LoRAs into data/loras/ for persistence
        resolved = self._copy_external_if_needed(resolved, adapter_name)

        try:
            result = handler.add_lora(str(resolved), adapter_name=adapter_name)
        except Exception as e:
            logger.exception(f"handler.add_lora() raised for '{adapter_name}'")
            return f"❌ Failed to load adapter: {e}"

        logger.info(f"handler.add_lora result for '{adapter_name}': {result}")

        # If the handler already returned an error, pass it through directly
        if result.startswith("❌"):
            return result

        # Post-load verification: confirm adapter actually loaded
        if not handler.lora_loaded:
            logger.warning(f"handler.add_lora returned '{result}' but lora_loaded is False")
            return f"❌ Adapter load reported success but adapter is not active"

        # Ensure adapter is also in the library
        if adapter_name not in self._known_adapters:
            adapter_type = self._detect_adapter_type(resolved)
            self._known_adapters[adapter_name] = {
                "path": str(resolved),
                "adapter_type": adapter_type,
            }

        # Fix toast message: replace "LoRA" with "LoKr" for lokr adapters
        adapter_type = self._known_adapters.get(adapter_name, {}).get("adapter_type", "lora")
        if adapter_type == "lokr" and "LoRA" in result:
            result = result.replace("LoRA", "LoKr")

        # Track which adapter the user loaded (LoKr won't appear in
        # handler.get_lora_status().active_adapter)
        self._active_selection = adapter_name

        return result

    def unload_lora(self, name: str) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        result = handler.remove_lora(name)
        if self._active_selection == name:
            self._active_selection = None
        return result

    def unload_all(self) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        result = handler.unload_lora()
        self._active_selection = None
        return result

    def set_active(self, name: str) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        self._active_selection = name
        return handler.set_active_lora_adapter(name)

    def set_scale(self, name: str, scale: float) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        return handler.set_lora_scale(name, scale)

    def toggle(self, enabled: bool) -> str:
        handler = self._get_handler()
        if handler is None:
            return "DiT model not loaded"
        if not enabled:
            self._active_selection = None
        return handler.set_use_lora(enabled)

    def get_status(self) -> dict:
        handler = self._get_handler()
        if handler is None:
            return {
                "loaded": False,
                "active": False,
                "scale": 1.0,
                "active_adapter": None,
                "adapters": [],
                "scales": {},
            }
        return handler.get_lora_status()

    def get_lora_snapshot(self) -> dict | None:
        """Return current LoRA state for embedding in generation params."""
        status = self.get_status()
        if not status.get("active", False):
            return None
        adapter = status.get("active_adapter")
        if not adapter:
            return None
        scale = status.get("scales", {}).get(adapter, 1.0)
        return {
            "active_adapter": adapter,
            "scale": scale,
            "enabled": True,
        }

    def get_persistable_state(self) -> list[dict]:
        """Return library state suitable for saving to the DB."""
        return [
            {
                "name": name,
                "path": info["path"],
                "adapter_type": info["adapter_type"],
            }
            for name, info in self._known_adapters.items()
        ]

    def restore_loras(self, saved_state: list[dict]) -> None:
        """Restore the adapter library from a previously saved state list.

        Only restores the library (known_adapters); does NOT load to GPU.
        """
        for entry in saved_state:
            path = entry.get("path", "")
            name = entry.get("name")
            adapter_type = entry.get("adapter_type", "lora")
            if not path or not name:
                continue
            self._known_adapters[name] = {
                "path": path,
                "adapter_type": adapter_type,
            }
            logger.info(f"Restored adapter '{name}' to library ({adapter_type})")


    async def persist_before_unload(self) -> None:
        """Save current library state to DB (for backend switches)."""
        from tadpole_studio.db.connection import get_db
        try:
            state = self.get_persistable_state()
            db = await get_db()
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) "
                "VALUES ('lora_state', ?, datetime('now'))",
                (json.dumps(state),),
            )
            await db.commit()
            logger.info(f"Persisted {len(state)} adapter(s) before backend switch")
        except Exception as e:
            logger.warning(f"Failed to persist LoRA state before switch: {e}")

    async def restore_after_init(self) -> None:
        """Restore adapter library from DB after backend re-initialization."""
        from tadpole_studio.db.connection import get_db
        try:
            db = await get_db()
            row = await db.execute(
                "SELECT value FROM settings WHERE key = 'lora_state'"
            )
            result = await row.fetchone()
            if result:
                saved = json.loads(result[0])
                if saved:
                    logger.info(f"Restoring {len(saved)} adapter(s) to library after backend switch")
                    self.restore_loras(saved)
        except Exception as e:
            logger.warning(f"Failed to restore LoRA state after switch: {e}")


lora_service = LoraService()
