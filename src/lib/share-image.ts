/** Saving, copying and natively sharing a rendered share card. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Copies the image, falling back to a download where the clipboard refuses images. */
export async function copyBlob(blob: Blob, filename: string): Promise<boolean> {
  if (!navigator.clipboard?.write) {
    downloadBlob(blob, filename);
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
    return true;
  } catch {
    downloadBlob(blob, filename);
    return false;
  }
}

/** The system share sheet with the image attached; downloads where that is unavailable. */
export async function shareBlob(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    downloadBlob(blob, filename);
    return "downloaded";
  }
  try {
    await navigator.share({ files: [file], title: "Codey", text });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

/** A card drawn by the server, as an image blob; throws when it is unavailable (e.g. local dev). */
export async function fetchCardImage(url: string): Promise<Blob> {
  const response = await fetch(url);
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) throw new Error(`Card unavailable (${response.status})`);
  return response.blob();
}
