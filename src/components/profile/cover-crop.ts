import type { CoverCrop } from "@/modules/profiles/cover";

function sourceIsValid(width: number, height: number) {
  return Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1 && width <= 2048 && height <= 2048;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function position(value: number, max: number) {
  return clamp(Math.round(value), 0, max);
}

export function maxCoverCropWidth(width: number, height: number) {
  return sourceIsValid(width, height) ? Math.min(width, height * 3) : 0;
}

export function initialCoverCrop(width: number, height: number): CoverCrop | null {
  const cropWidth = maxCoverCropWidth(width, height);
  if (cropWidth < 600) return null;
  const cropHeight = Math.round(cropWidth / 3);
  return { x: position((width - cropWidth) / 2, width - cropWidth), y: position((height - cropHeight) / 2, height - cropHeight), width: cropWidth };
}

export function moveCoverCrop(crop: CoverCrop, sourceWidth: number, sourceHeight: number, dx: number, dy: number): CoverCrop {
  const cropHeight = Math.round(crop.width / 3);
  return {
    ...crop,
    x: position(crop.x + dx, sourceWidth - crop.width),
    y: position(crop.y + dy, sourceHeight - cropHeight),
  };
}

export function resizeCoverCrop(crop: CoverCrop, sourceWidth: number, sourceHeight: number, nextWidth: number): CoverCrop {
  const width = Math.round(clamp(nextWidth, 600, maxCoverCropWidth(sourceWidth, sourceHeight)));
  const height = Math.round(width / 3);
  const centreX = crop.x + crop.width / 2;
  const centreY = crop.y + Math.round(crop.width / 3) / 2;
  return {
    x: position(centreX - width / 2, sourceWidth - width),
    y: position(centreY - height / 2, sourceHeight - height),
    width,
  };
}
