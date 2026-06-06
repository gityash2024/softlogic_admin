import { Presentation } from 'lucide-react';

export interface WhiteboardPreviewSlide {
  id?: string;
  title?: string | null;
  name?: string | null;
  thumbnail?: string | null;
  elements?: unknown;
}

type PreviewPoint = { x: number; y: number };
type PreviewRect = { left: number; top: number; right: number; bottom: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pointFrom(value: unknown): PreviewPoint | null {
  const record = asRecord(value);
  if (!record) return null;
  const x = asNumber(record.x) ?? asNumber(record.dx) ?? asNumber(record.left);
  const y = asNumber(record.y) ?? asNumber(record.dy) ?? asNumber(record.top);
  return x == null || y == null ? null : { x, y };
}

function rectFromStroke(stroke: Record<string, unknown>): PreviewRect | null {
  const start = pointFrom(stroke.startPoint);
  const end = pointFrom(stroke.endPoint);
  if (!start || !end) return null;
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function colorFrom(value: unknown, fallback = '#111827') {
  if (typeof value === 'string' && value.trim()) return value;
  const numeric = asNumber(value);
  if (numeric == null) return fallback;
  const rgb = (numeric >>> 0) & 0x00ffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

function pointsFromStroke(stroke: Record<string, unknown>): PreviewPoint[] {
  const rawPoints = Array.isArray(stroke.points) ? stroke.points : [];
  return rawPoints.map(pointFrom).filter((point): point is PreviewPoint => Boolean(point));
}

function strokesFromSlide(slide?: WhiteboardPreviewSlide | null): Record<string, unknown>[] {
  const elements = asRecord(slide?.elements);
  const rawStrokes = Array.isArray(elements?.strokes)
    ? elements.strokes
    : Array.isArray(slide?.elements)
      ? slide.elements
      : [];
  return rawStrokes
    .map(asRecord)
    .filter((stroke): stroke is Record<string, unknown> => Boolean(stroke));
}

function strokeBounds(stroke: Record<string, unknown>): PreviewRect | null {
  const rect = rectFromStroke(stroke);
  const points = pointsFromStroke(stroke);
  if (rect) return rect;
  if (points.length === 0) return null;
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function combinedBounds(strokes: Record<string, unknown>[]): PreviewRect {
  const bounds = strokes.map(strokeBounds).filter((rect): rect is PreviewRect => Boolean(rect));
  if (bounds.length === 0) {
    return { left: 0, top: 0, right: 1280, bottom: 720 };
  }
  const left = Math.min(...bounds.map((rect) => rect.left));
  const top = Math.min(...bounds.map((rect) => rect.top));
  const right = Math.max(...bounds.map((rect) => rect.right));
  const bottom = Math.max(...bounds.map((rect) => rect.bottom));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const pad = Math.max(48, Math.max(width, height) * 0.12);
  return { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
}

function pathFromPoints(points: PreviewPoint[]) {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest
    .map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')}`;
}

function hasDrawableSlide(slide?: WhiteboardPreviewSlide | null) {
  return strokesFromSlide(slide).some((stroke) => {
    const contentType = String(stroke.contentType ?? '');
    return (
      pointsFromStroke(stroke).length > 1 ||
      rectFromStroke(stroke) != null ||
      Boolean(String(stroke.contentText ?? '').trim()) ||
      Boolean(String(stroke.mediaPath ?? '').trim()) ||
      contentType === 'image'
    );
  });
}

function WhiteboardSlidePreview({
  slide,
  title,
}: {
  slide?: WhiteboardPreviewSlide | null;
  title: string;
}) {
  const strokes = strokesFromSlide(slide);
  const bounds = combinedBounds(strokes);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);

  return (
    <svg
      className="h-full w-full"
      role="img"
      aria-label={`${title} preview`}
      viewBox={`${bounds.left} ${bounds.top} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {strokes.map((stroke, index) => {
        const contentType = String(stroke.contentType ?? '');
        const strokeColor = colorFrom(stroke.strokeColor ?? stroke.color);
        const fillColor = colorFrom(stroke.fillColor, 'transparent');
        const strokeWidth = asNumber(stroke.strokeWidth) ?? 3;
        const opacity = (asNumber(stroke.shapeOpacity) ?? 1).toString();
        const rect = rectFromStroke(stroke);
        const points = pointsFromStroke(stroke);
        const key = `${String(stroke.id ?? index)}-${index}`;
        const mediaPath = String(stroke.mediaPath ?? '').trim();

        if (contentType === 'image' && mediaPath && rect) {
          return (
            <image
              key={key}
              href={mediaPath}
              x={rect.left}
              y={rect.top}
              width={Math.max(1, rect.right - rect.left)}
              height={Math.max(1, rect.bottom - rect.top)}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        }

        if (contentType === 'text' && rect) {
          return (
            <text
              key={key}
              x={rect.left + 8}
              y={rect.top + Math.max(18, asNumber(stroke.fontSize) ?? 18)}
              fill={colorFrom(stroke.color)}
              fontSize={asNumber(stroke.fontSize) ?? 18}
              fontWeight={stroke.isBold ? 700 : 500}
            >
              {String(stroke.contentText ?? '')}
            </text>
          );
        }

        if (stroke.isShape && rect) {
          const shapeType = String(stroke.shapeType ?? '');
          if (shapeType === 'ellipse' || shapeType === 'circle') {
            return (
              <ellipse
                key={key}
                cx={(rect.left + rect.right) / 2}
                cy={(rect.top + rect.bottom) / 2}
                rx={Math.max(1, (rect.right - rect.left) / 2)}
                ry={Math.max(1, (rect.bottom - rect.top) / 2)}
                fill={stroke.shapeFillEnabled ? fillColor : 'none'}
                opacity={opacity}
                stroke={stroke.shapeStrokeEnabled === false ? 'none' : strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          }
          if (shapeType === 'line' || shapeType === 'arrow') {
            return (
              <line
                key={key}
                x1={rect.left}
                y1={rect.top}
                x2={rect.right}
                y2={rect.bottom}
                stroke={strokeColor}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />
            );
          }
          return (
            <rect
              key={key}
              x={rect.left}
              y={rect.top}
              width={Math.max(1, rect.right - rect.left)}
              height={Math.max(1, rect.bottom - rect.top)}
              rx={Math.max(0, asNumber(stroke.shapeCornerRadius) ?? 0)}
              fill={stroke.shapeFillEnabled ? fillColor : 'none'}
              opacity={opacity}
              stroke={stroke.shapeStrokeEnabled === false ? 'none' : strokeColor}
              strokeWidth={strokeWidth}
            />
          );
        }

        if (points.length > 1) {
          return (
            <path
              key={key}
              d={pathFromPoints(points)}
              fill="none"
              stroke={stroke.isEraser ? '#ffffff' : colorFrom(stroke.color)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth}
            />
          );
        }

        return null;
      })}
    </svg>
  );
}

export function BoardPreviewTile({
  title,
  thumbnail,
  slide,
  pageCount,
  compact = false,
}: {
  title: string;
  thumbnail?: string | null;
  slide?: WhiteboardPreviewSlide | null;
  pageCount?: number;
  compact?: boolean;
}) {
  const canRenderSlide = !thumbnail && hasDrawableSlide(slide);
  return (
    <div
      data-board-preview-tile
      className={`relative overflow-hidden rounded-lg border border-line bg-white ${
        compact ? 'aspect-[16/10]' : 'aspect-[16/9]'
      }`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt={title} className="h-full w-full object-cover" loading="lazy" />
      ) : canRenderSlide ? (
        <div className="h-full w-full bg-[linear-gradient(#edf2fa_1px,transparent_1px),linear-gradient(90deg,#edf2fa_1px,transparent_1px)] bg-[size:22px_22px] p-2">
          <WhiteboardSlidePreview slide={slide} title={title} />
        </div>
      ) : (
        <div className="h-full w-full bg-[linear-gradient(#e8edf7_1px,transparent_1px),linear-gradient(90deg,#e8edf7_1px,transparent_1px)] bg-[size:22px_22px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <Presentation className="h-8 w-8 text-brand-primary/50" />
          </div>
        </div>
      )}
      {pageCount != null && (
        <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink-600 shadow-sm">
          {pageCount} page{pageCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}
