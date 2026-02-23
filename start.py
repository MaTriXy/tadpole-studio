#!/usr/bin/env python3
"""Tadpole Studio Launcher — starts backend + frontend in one command."""

import os
import signal
import subprocess
import sys
import shutil
import threading
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

# Colors for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log(msg: str, color: str = GREEN) -> None:
    print(f"{color}{BOLD}[Tadpole Studio]{RESET} {msg}")


def ensure_data_dirs() -> None:
    """Create data directories if they don't exist."""
    data_dir = BACKEND_DIR / "data"
    (data_dir / "checkpoints").mkdir(parents=True, exist_ok=True)
    (data_dir / "audio").mkdir(parents=True, exist_ok=True)

    checkpoints_dir = data_dir / "checkpoints"
    has_models = any(checkpoints_dir.iterdir()) if checkpoints_dir.exists() else False
    if not has_models:
        log("No model checkpoints found.", YELLOW)
        log("Models will auto-download on first generation (~10 GB).", YELLOW)
        log(f"Checkpoint directory: {checkpoints_dir}", YELLOW)
        print()


def check_prerequisites() -> bool:
    ok = True

    # Python version
    if sys.version_info < (3, 11):
        log(f"Python 3.11+ required, found {sys.version}", RED)
        ok = False

    # uv
    if not shutil.which("uv"):
        log("'uv' not found. Install: https://docs.astral.sh/uv/getting-started/installation/", RED)
        ok = False

    # Node.js
    if not shutil.which("node"):
        log("'node' not found. Install: https://nodejs.org/", RED)
        ok = False

    # pnpm
    if not shutil.which("pnpm"):
        log("'pnpm' not found. Install: https://pnpm.io/installation", RED)
        ok = False

    return ok


def open_browser_when_ready(url: str, timeout: int = 60) -> None:
    """Poll the frontend URL and open the browser once it responds."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            urlopen(url, timeout=2)
            log(f"Opening {CYAN}{BOLD}{url}{RESET} in your browser...")
            webbrowser.open(url)
            return
        except (URLError, OSError):
            time.sleep(1)
    log("Frontend didn't respond in time — open http://localhost:3000 manually.", YELLOW)


def _run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, using shell=True on Windows so .cmd wrappers are found."""
    if sys.platform == "win32":
        return subprocess.run(cmd, shell=True, **kwargs)
    return subprocess.run(cmd, **kwargs)


def _popen(cmd: list[str], **kwargs) -> subprocess.Popen:
    """Open a subprocess, using shell=True on Windows so .cmd wrappers are found."""
    if sys.platform == "win32":
        return subprocess.Popen(cmd, shell=True, **kwargs)
    return subprocess.Popen(cmd, **kwargs)


def _has_nvidia_gpu() -> bool:
    """Check if an NVIDIA GPU is available (Windows/Linux)."""
    if shutil.which("nvidia-smi") is None:
        return False
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0 and bool(result.stdout.strip())
    except Exception:
        return False


def _torch_has_cuda() -> bool:
    """Check if the installed torch build has CUDA support."""
    venv_python = BACKEND_DIR / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / "python"
    if not venv_python.exists():
        return False
    try:
        result = subprocess.run(
            [str(venv_python), "-c", "import torch; print(torch.cuda.is_available())"],
            capture_output=True, text=True, timeout=30,
        )
        return "True" in result.stdout
    except Exception:
        return False


def _install_cuda_torch() -> None:
    """Replace CPU-only torch with the CUDA build for NVIDIA GPUs."""
    log("NVIDIA GPU detected but torch has no CUDA support.", YELLOW)
    log("Installing PyTorch with CUDA (this may take a few minutes)...")
    _run(
        ["uv", "pip", "install",
         "--reinstall-package", "torch",
         "--reinstall-package", "torchvision",
         "--reinstall-package", "torchaudio",
         "torch", "torchvision", "torchaudio",
         "--index-url", "https://download.pytorch.org/whl/cu128"],
        cwd=BACKEND_DIR, check=True,
    )
    log("PyTorch with CUDA installed successfully.")


def install_dependencies() -> None:
    log("Installing backend dependencies...")
    _run(["uv", "sync"], cwd=BACKEND_DIR, check=True)

    # On Windows/Linux with NVIDIA GPU, ensure torch has CUDA support
    if sys.platform != "darwin" and _has_nvidia_gpu() and not _torch_has_cuda():
        _install_cuda_torch()

    log("Installing frontend dependencies...")
    _run(["pnpm", "install", "--frozen-lockfile"], cwd=FRONTEND_DIR, check=True)


def main() -> None:
    print(f"\n{CYAN}{BOLD}  Tadpole Studio  {RESET}")
    print(f"  {CYAN}Local AI Music Generation{RESET}\n")

    if not check_prerequisites():
        log("Missing prerequisites. See above.", RED)
        sys.exit(1)

    ensure_data_dirs()

    # Install deps if needed
    if not (BACKEND_DIR / ".venv").exists():
        install_dependencies()
    elif not (FRONTEND_DIR / "node_modules").exists():
        install_dependencies()
    else:
        log("Dependencies already installed. Use --install to force reinstall.", YELLOW)

    if "--install" in sys.argv:
        install_dependencies()

    log(f"Starting backend on {CYAN}http://localhost:8000{RESET}")
    log(f"Starting frontend on {CYAN}http://localhost:3000{RESET}")
    print()

    procs: list[subprocess.Popen] = []

    def shutdown(sig=None, frame=None):
        print()
        log("Shutting down...")
        for p in procs:
            if sys.platform == "win32":
                # shell=True means p.terminate() only kills cmd.exe, not the
                # child process tree.  taskkill /T /F kills the entire tree.
                subprocess.run(
                    ["taskkill", "/T", "/F", "/PID", str(p.pid)],
                    capture_output=True,
                )
            else:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Start backend
    backend = _popen(
        ["uv", "run", "--no-sync", "tadpole-studio"],
        cwd=BACKEND_DIR,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    procs.append(backend)

    # Start frontend
    frontend = _popen(
        ["pnpm", "dev"],
        cwd=FRONTEND_DIR,
        env={**os.environ, "NEXT_TELEMETRY_DISABLED": "1"},
    )
    procs.append(frontend)

    # Auto-open browser unless --no-open is passed
    if "--no-open" not in sys.argv:
        opener = threading.Thread(
            target=open_browser_when_ready,
            args=("http://localhost:3000",),
            daemon=True,
        )
        opener.start()

    log("Press Ctrl+C to stop.\n")

    # Wait for either process to exit
    try:
        while True:
            for p in procs:
                ret = p.poll()
                if ret is not None:
                    name = "Backend" if p == backend else "Frontend"
                    log(f"{name} exited with code {ret}", RED if ret != 0 else YELLOW)
                    shutdown()
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
