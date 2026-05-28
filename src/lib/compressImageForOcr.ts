import type { TFunction } from "i18next";

/** Nginx on production rejects multipart bodies above ~1 MB. */
const MAX_UPLOAD_BYTES = 900_000;
const MAX_EDGE_PX = 1600;

export type ImageCompressErrorCode =
  | "imageReadFailed"
  | "imageInvalidType"
  | "imageProcessFailed"
  | "imageCompressFailed";

export class ImageCompressError extends Error {
  readonly code: ImageCompressErrorCode;

  constructor(code: ImageCompressErrorCode) {
    super(code);
    this.name = "ImageCompressError";
    this.code = code;
  }
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageCompressError("imageReadFailed"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Downscale and re-encode camera photos so they pass the ~1 MB upload limit
 * and work reliably with the OCR API (JPEG, reasonable resolution).
 */
export async function compressImageForOcr(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new ImageCompressError("imageInvalidType");
  }
  if (file.size <= MAX_UPLOAD_BYTES && file.type === "image/jpeg") {
    return file;
  }

  const img = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageCompressError("imageProcessFailed");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.88;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await canvasToJpegBlob(canvas, quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.08;
  }

  if (!blob) {
    throw new ImageCompressError("imageCompressFailed");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "medication-label";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Maps compression / OCR upload errors to translated caregiver-facing messages. */
export function resolveWizardImageError(err: unknown, t: TFunction): string {
  if (err instanceof ImageCompressError) {
    return t(`careEvents.wizard.${err.code}`);
  }
  const msg = err instanceof Error ? err.message : "";
  if (/413|entity too large|request entity too large/i.test(msg)) {
    return t("careEvents.wizard.labelScanUploadTooLarge");
  }
  if (msg && !/unexpected error/i.test(msg)) {
    return msg;
  }
  return t("careEvents.wizard.labelScanFailed");
}
