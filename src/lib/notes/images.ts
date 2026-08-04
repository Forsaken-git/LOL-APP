/** Compress an image file/blob to a JPEG data URL for embedding in notes. */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

export async function compressImageToDataUrl(
  source: Blob | File,
): Promise<string> {
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Image conversion failed");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
