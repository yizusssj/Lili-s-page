import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

const DEFAULT_WIDTH = 760;
const DEFAULT_RATIO = 4 / 3;

function buildRows(memories, width, ratios) {
  const safeWidth = Math.max(260, width || DEFAULT_WIDTH);
  const gap = safeWidth < 520 ? 5 : 8;
  const targetHeight = safeWidth < 520 ? 148 : safeWidth < 900 ? 188 : 218;
  const rows = [];
  let pending = [];
  let ratioSum = 0;

  function finishRow(last = false) {
    if (pending.length === 0) return;
    const availableWidth = safeWidth - gap * Math.max(0, pending.length - 1);
    const fittedHeight = availableWidth / ratioSum;
    const height = Math.max(84, Math.min(last ? targetHeight : targetHeight * 1.12, fittedHeight));
    rows.push({
      gap,
      height,
      items: pending.map((item) => ({
        ...item,
        width: item.ratio * height,
      })),
    });
    pending = [];
    ratioSum = 0;
  }

  memories.forEach((memory, index) => {
    const ratio = Math.max(0.42, Math.min(2.4, ratios[memory.id] ?? DEFAULT_RATIO));
    pending.push({ index, memory, ratio });
    ratioSum += ratio;
    const projectedWidth = ratioSum * targetHeight + gap * Math.max(0, pending.length - 1);
    if (projectedWidth >= safeWidth * 0.92) finishRow(false);
  });

  finishRow(true);
  return rows;
}

export default function MemoryCollage({ getLabel, memories, onSelect }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_WIDTH);
  const [ratios, setRatios] = useState({});

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const updateWidth = (width) => {
      if (width > 0) setContainerWidth(Math.round(width));
    };
    updateWidth(element.getBoundingClientRect().width || element.clientWidth);

    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(
    () => buildRows(memories, containerWidth, ratios),
    [containerWidth, memories, ratios],
  );

  function rememberRatio(memoryId, image) {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    setRatios((current) => (
      Math.abs((current[memoryId] ?? 0) - ratio) < 0.01
        ? current
        : { ...current, [memoryId]: ratio }
    ));
  }

  return (
    <div ref={containerRef} className="memoryCollage">
      {rows.map((row, rowIndex) => (
        <div
          className="memoryCollageRow"
          key={`${row.items[0]?.memory.id ?? rowIndex}-${rowIndex}`}
          style={{ gap: `${row.gap}px`, height: `${row.height}px` }}
        >
          {row.items.map(({ index, memory, width }) => (
            <button
              type="button"
              className="memoryCollageItem"
              key={memory.id}
              onClick={() => onSelect(memory.id)}
              aria-label={getLabel(memory)}
              style={{
                "--memory-index": index,
                height: `${row.height}px`,
                width: `${width}px`,
              }}
            >
              {memory.imageUrl ? (
                <img
                  src={memory.imageUrl}
                  alt=""
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={(event) => rememberRatio(memory.id, event.currentTarget)}
                />
              ) : (
                <ImagePlus aria-hidden="true" size={28} strokeWidth={1.5} />
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
