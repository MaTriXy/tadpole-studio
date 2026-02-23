declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
}

const MIME_TYPES: Record<string, string> = {
  flac: "audio/flac",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  aac: "audio/aac",
};

function hasSaveFilePicker(): boolean {
  return typeof window.showSaveFilePicker === "function";
}

/**
 * Chromium path: fetch blob → show OS Save-As picker → write blob to chosen file.
 * Returns true if handled (including user cancel), false if picker unavailable.
 */
async function saveWithPicker(
  url: string,
  filename: string,
  description: string,
  mimeType: string,
  extensions: string[],
): Promise<boolean> {
  if (!hasSaveFilePicker()) return false;
  try {
    // Show the picker first (synchronous from user gesture), then fetch.
    const handle = await window.showSaveFilePicker!({
      suggestedName: filename,
      types: [{ description, accept: { [mimeType]: extensions } }],
    });
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }
}

/**
 * Safari / Firefox fallback: direct anchor click — must be called synchronously
 * from the click handler so the user gesture is still active.
 */
function anchorDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportSongFile(url: string, filename: string): Promise<void> {
  if (!hasSaveFilePicker()) {
    anchorDownload(url, filename);
    return;
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_TYPES[ext] ?? "audio/flac";
  await saveWithPicker(url, filename, "Audio file", mimeType, [`.${ext}`]);
}

export async function exportPlaylistZip(url: string, filename: string): Promise<void> {
  if (!hasSaveFilePicker()) {
    anchorDownload(url, filename);
    return;
  }
  await saveWithPicker(url, filename, "ZIP archive", "application/zip", [".zip"]);
}
