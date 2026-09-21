"use client";

import { useId, useMemo, useState } from "react";

/**
 * Charts, drawn by hand in SVG.
 *
 * No charting library. Three shapes are needed here — an area line, a labelled
 * bar row, a donut — and the smallest credible library is several hundred
 * kilobytes shipped to a page four people look at. These are about a hundred
 * lines of arithmetic and they inherit the console's own type and colour.
 */

const TONES: Record<string, string> = {
  blue: "var(--blue)",
  green: "var(--green)",
  red: "var(--red)",
  grey: "var(--faint)",
};

const WIDTH = 720;
const HEIGHT = 168;
const PAD_Y = 14;

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00`));
}

type Point = { label: string; value: number };

/**
 * A filled line, optionally with a second line over it.
 *
 * The overlay exists for one comparison — attempts against captures — where the
 * gap between the two lines IS the metric. Two separate charts would make the
 * reader hold one shape in their head while looking at the other.
 */
export function AreaChart({
  points,
  overlay,
  format,
}: {
  points: Point[];
  overlay?: Point[];
  format: (value: number) => string;
}) {
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const peak = Math.max(1, ...points.map((point) => point.value), ...(overlay ?? []).map((point) => point.value));
    const step = points.length > 1 ? WIDTH / (points.length - 1) : WIDTH;
    const usable = HEIGHT - PAD_Y * 2;
    const y = (value: number) => HEIGHT - PAD_Y - (value / peak) * usable;

    const path = (source: Point[]) =>
      source.map((point, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");

    const line = path(points);
    return {
      peak,
      step,
      y,
      line,
      area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`,
      overlayLine: overlay && overlay.length > 0 ? path(overlay) : null,
    };
  }, [overlay, points]);

  if (!geometry) return <p className="empty">No data in this period.</p>;

  const active = hovered !== null ? points[hovered] : null;
  const activeOverlay = hovered !== null && overlay ? overlay[hovered] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Daily trend">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TONES.blue} stopOpacity="0.18" />
            <stop offset="100%" stopColor={TONES.blue} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path d={geometry.line} fill="none" stroke={TONES.blue} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {geometry.overlayLine && (
          <path
            d={geometry.overlayLine}
            fill="none"
            stroke={TONES.green}
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {active && (
          <circle
            cx={(hovered ?? 0) * geometry.step}
            cy={geometry.y(active.value)}
            r="4"
            fill={TONES.blue}
            stroke="#fff"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Full-height columns rather than dots: a 2px point cannot be hovered,
            and a column reads unambiguously as "this day". */}
        {points.map((point, index) => (
          <rect
            key={point.label}
            x={index * geometry.step - geometry.step / 2}
            y={0}
            width={geometry.step}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      <div className="chart-foot">
        <span>{dayLabel(points[0].label)}</span>
        {active ? (
          <strong>
            {dayLabel(active.label)} · {format(active.value)}
            {activeOverlay ? ` · ${format(activeOverlay.value)} captured` : ""}
          </strong>
        ) : (
          <strong>peak {format(geometry.peak)}</strong>
        )}
        <span>{dayLabel(points[points.length - 1].label)}</span>
      </div>
    </div>
  );
}

/**
 * Horizontal bars with a label and a count.
 *
 * `percent: null` means the caller wants the bars sized relative to each other
 * rather than as shares of a whole — right for a status breakdown where the
 * categories are not proportions of one population.
 */
export function BarRow({
  rows,
}: {
  rows: Array<{ label: string; value: number; percent: number | null; tone: keyof typeof TONES }>;
}) {
  const peak = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="bars">
      {rows.map((row) => {
        const width = row.percent === null ? (row.value / peak) * 100 : row.percent;
        return (
          <div className="bar" key={row.label}>
            <div className="bar-head">
              <span>{row.label}</span>
              <strong>
                {row.value}
                {row.percent !== null && <em> · {row.percent}%</em>}
              </strong>
            </div>
            <div className="bar-track">
              <span style={{ width: `${Math.max(width, row.value > 0 ? 1.5 : 0)}%`, background: TONES[row.tone] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Donut with a legend.
 *
 * Drawn as stroked arcs on one circle using dash offsets, which is a single
 * element per slice and no path arithmetic.
 */
type Slice = { label: string; value: number; tone: keyof typeof TONES };
type Arc = Slice & { share: number; dash: number; offset: number };

export function Donut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  // Each arc starts where the previous one ended, so the offsets are a running
  // total. Carried in the reduce accumulator rather than a `let` mutated from
  // inside a callback: React 19's immutability rule rejects the latter, and it
  // is right to — a closure variable written during render is exactly what
  // breaks when a render gets replayed. Four slices, so the spread is free.
  const arcs = useMemo(
    () =>
      slices.reduce<{ items: Arc[]; consumed: number }>(
        (acc, slice) => {
          const share = total === 0 ? 0 : slice.value / total;
          return {
            items: [
              ...acc.items,
              { ...slice, share, dash: share * circumference, offset: -acc.consumed * circumference },
            ],
            consumed: acc.consumed + share,
          };
        },
        { items: [], consumed: 0 },
      ).items,
    [circumference, slices, total],
  );

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Distribution">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--line-soft)" strokeWidth="18" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={TONES[arc.tone]}
            strokeWidth="18"
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={arc.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className="donut-total">
          {total}
        </text>
        <text x="70" y="82" textAnchor="middle" className="donut-caption">
          creators
        </text>
      </svg>
      <ul className="legend">
        {arcs.map((arc) => (
          <li key={arc.label}>
            <span className="swatch" style={{ background: TONES[arc.tone] }} />
            <span className="legend-label">{arc.label}</span>
            <strong>{arc.value}</strong>
            <em>{Math.round(arc.share * 1000) / 10}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
