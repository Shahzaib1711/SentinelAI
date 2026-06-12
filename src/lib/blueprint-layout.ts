/** object-contain layout for blueprint images inside a fixed aspect container. */

export interface ImageLayout {
  offsetX: number;
  offsetY: number;
  displayW: number;
  displayH: number;
  containerW: number;
  containerH: number;
}

export function computeImageLayout(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): ImageLayout | null {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return null;
  }

  const scale = Math.min(containerW / imageW, containerH / imageH);
  const displayW = imageW * scale;
  const displayH = imageH * scale;

  return {
    offsetX: (containerW - displayW) / 2,
    offsetY: (containerH - displayH) / 2,
    displayW,
    displayH,
    containerW,
    containerH,
  };
}

export function layoutBoxStyle(layout: ImageLayout): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(layout.offsetX / layout.containerW) * 100}%`,
    top: `${(layout.offsetY / layout.containerH) * 100}%`,
    width: `${(layout.displayW / layout.containerW) * 100}%`,
    height: `${(layout.displayH / layout.containerH) * 100}%`,
  };
}
