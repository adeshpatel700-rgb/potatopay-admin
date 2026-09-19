"use client";

/**
 * Two marks, drawn by hand.
 *
 * A charting library would be a dependency, a bundle and a theme to fight for
 * a sparkline and a column of bars. Both are a path and some rects; what makes
 * them read well is the spec, not the library — thin marks, one hue, a 2px gap
 * doing the separating, and a label only on the point worth naming.
 */

const ACCENT = "#c0672b";
const SURFACE = "#fffdfa";

function path(values: number[], width: number, height: number, pad: number): { line: string; area: string; last: { x: number; y: number } } {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: pad + index * step,
    y: pad + (height - pad * 2) * (1 - (value - min) / span),
  }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${height} L${points[0].x.toFixed(1)} ${height} Z`;
  return { line, area, last: points[points.length - 1] };
}

/**
 * The trend line on a stat tile.
 *
 * Deliberately axis-less and label-less: a sparkline answers "which way, and
 * how steadily", and gridlines on something 34px tall answer nothing while
 * adding ink. The end dot carries a surface-coloured ring so it stays legible
 * where it sits on top of the line.
 */
export function Sparkline({ values, width = 120, height = 34 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="ov-spark-empty" aria-hidden="true" />;
  const { line, area, last } = path(values, width, height, 5);
  return (
    <svg className="ov-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend over the selected period" focusable="false">
      <path d={area} fill={ACCENT} opacity="0.1" />
      <path d={line} fill="none" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="4" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
    </svg>
  );
}

/**
 * Daily columns.
 *
 * One series, so no legend — the panel title says what is plotted. Only the
 * tallest column is labelled: a number on every bar is chaos and goes unread,
 * and the axis plus the hover title carry the rest.
 */
export function DayBars({
  days,
  values,
  format,
  height = 168,
}: {
  days: string[];
  values: number[];
  format: (value: number) => string;
  height?: number;
}) {
  if (values.length === 0) return <p className="empty">Nothing in this period.</p>;
  const max = Math.max(...values, 1);
  const peak = values.indexOf(max);
  const label = (day: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00+05:30`));

  return (
    <div className="ov-chart" style={{ height }}>
      {values.map((value, index) => {
        const share = value / max;
        return (
          <div className="ov-col" key={days[index] ?? index} title={`${label(days[index] ?? "")} · ${format(value)}`}>
            {index === peak && value > 0 && <span className="ov-col-value">{format(value)}</span>}
            <span
              className={`ov-col-fill${value === 0 ? " zero" : ""}`}
              style={{ height: `${Math.max(share * 100, value > 0 ? 3 : 1)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Rank rows with a share bar, for the two leaderboards. */
export function ShareBar({ share }: { share: number }) {
  return (
    <span className="ov-share" aria-hidden="true">
      <span className="ov-share-fill" style={{ width: `${Math.max(2, Math.min(100, share * 100))}%` }} />
    </span>
  );
}
