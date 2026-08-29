export type PageFitMeasurement = {
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
};

type HeightFallbackInput = PageFitMeasurement & {
  viewportWidth: number;
  viewportHeight: number;
};

export const MIN_READABLE_WIDTH = 240;
export const MOBILE_READER_MAX_WIDTH = 768;

export function shouldFallbackHeightToWidth({
  naturalWidth,
  naturalHeight,
  renderedWidth,
  renderedHeight,
  viewportWidth,
  viewportHeight,
}: HeightFallbackInput): boolean {
  if (viewportWidth > MOBILE_READER_MAX_WIDTH || naturalWidth <= 0 || naturalHeight <= 0) return false;

  const readableWidth = Math.min(MIN_READABLE_WIDTH, viewportWidth * 0.68);
  const availableHeight = Math.max(1, viewportHeight - 128);
  const projectedHeightFitWidth = availableHeight * (naturalWidth / naturalHeight);
  const observedHeightFitIsUnreadable = renderedWidth > 0
    && renderedHeight <= availableHeight + 2
    && renderedWidth < readableWidth;

  return projectedHeightFitWidth < readableWidth || observedHeightFitIsUnreadable;
}
