// Size vs behaviour: every compression setting of the sweep (tools/calibrate/results/compression_sweep.json) as a
// point — model size on a log axis, number of behaviours kept on the other. Click a point to try it on fly B.
import { useEffect, useMemo, useState } from "react";
import { useI18n, type StringKey } from "../i18n";

export interface SweepRow {
  minSynapses: number;
  weightBits: number | null;
  merge: boolean;
  size: { bytes: number };
  kept: string[];
}
type Method = "prune" | "bits" | "merge";
type Settings = Pick<SweepRow, "minSynapses" | "weightBits" | "merge">;

const BEHAVIOURS = 3;
const W = 900;
const H = 300;
const PAD = { l: 44, r: 16, t: 8, b: 40 };
const X_MIN = 0.1; // MB
const X_MAX = 20;
/** categorical slots 1–3 of the dataviz reference palette, validated all-pairs on this site's light and dark surfaces */
const COLOR: Record<"light" | "dark", Record<Method, string>> = {
  light: { prune: "#2a78d6", bits: "#eb6834", merge: "#1baf7a" },
  dark: { prune: "#3987e5", bits: "#d95926", merge: "#199e70" },
};
/** settings with the same number of behaviours kept sit in three lanes, one per method */
const LANE: Record<Method, number> = { prune: -0.22, bits: 0, merge: 0.22 };

export const methodOf = (r: Settings): Method =>
  r.merge ? "merge" : r.weightBits !== null ? "bits" : "prune";
const same = (a: Settings, b: Settings) =>
  a.minSynapses === b.minSynapses &&
  a.weightBits === b.weightBits &&
  a.merge === b.merge;
const x = (mb: number) =>
  PAD.l +
  ((Math.log10(mb) - Math.log10(X_MIN)) /
    (Math.log10(X_MAX) - Math.log10(X_MIN))) *
    (W - PAD.l - PAD.r);
/** half a step of room below 0 and above 3, so the lanes around each level stay inside the plot */
const y = (kept: number) =>
  H - PAD.b - ((kept + 0.5) / (BEHAVIOURS + 1)) * (H - PAD.t - PAD.b);

function useDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function Mark({
  method,
  cx,
  cy,
  color,
  r = 4.5,
}: {
  method: Method;
  cx: number;
  cy: number;
  color: string;
  r?: number;
}) {
  if (method === "bits")
    return (
      <rect
        x={cx - r}
        y={cy - r}
        width={2 * r}
        height={2 * r}
        rx={1}
        fill={color}
      />
    );
  if (method === "merge")
    return (
      <path
        d={`M${cx},${cy - r * 1.2} L${cx + r * 1.1},${cy + r * 0.8} L${cx - r * 1.1},${cy + r * 0.8} Z`}
        fill={color}
      />
    );
  return <circle cx={cx} cy={cy} r={r} fill={color} />;
}

export function SizeBehaviourChart({
  rows,
  current,
  onPick,
}: {
  rows: SweepRow[];
  current: Settings;
  onPick: (s: Settings) => void;
}) {
  const { t, n } = useI18n();
  const palette = COLOR[useDark() ? "dark" : "light"];
  const [hover, setHover] = useState<SweepRow | null>(null);
  const original = rows.find(
    (r) => r.minSynapses === 5 && r.weightBits === null && !r.merge,
  );
  const best = useMemo(
    () =>
      rows
        .filter((r) => r.kept.length === BEHAVIOURS)
        .reduce<SweepRow | null>(
          (a, r) => (!a || r.size.bytes < a.size.bytes ? r : a),
          null,
        ),
    [rows],
  );
  const label = (r: Settings) =>
    [
      t("zip.prune", { n: r.minSynapses }),
      r.weightBits === null
        ? t("cmp.exact")
        : t("cmp.bitsN", { n: r.weightBits }),
      ...(r.merge ? [t("zip.curve.merged")] : []),
    ].join(" · ");
  const keptNames = (r: SweepRow) =>
    r.kept.length
      ? r.kept.map((b) => t(`beh.${b}` as StringKey)).join(", ")
      : t("beh.none");
  const ticks = [0.1, 0.3, 1, 3, 10];
  const focus = hover ?? rows.find((r) => same(r, current)) ?? null;
  const axis = "rgb(var(--muted))";

  return (
    <div data-testid="zip-curve">
      {best && original && (
        <p className="mb-2 text-sm" data-testid="zip-curve-best">
          {t("zip.curve.best", {
            mb: n(best.size.bytes / 1e6, 2),
            x: n(original.size.bytes / best.size.bytes, 0),
            settings: label(best),
          })}
        </p>
      )}
      {/* on phones the plot keeps a readable width and scrolls sideways inside its panel */}
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[620px]"
          role="img"
          aria-label={t("zip.curve.title")}
        >
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(k)}
                y2={y(k)}
                stroke="rgb(var(--border))"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={y(k) + 4}
                textAnchor="end"
                fontSize={11}
                fill={axis}
              >
                {k}
              </text>
            </g>
          ))}
          {ticks.map((v) => (
            <text
              key={v}
              x={x(v)}
              y={H - PAD.b + 16}
              textAnchor="middle"
              fontSize={11}
              fill={axis}
            >
              {n(v, v < 1 ? 1 : 0)}
            </text>
          ))}
          <text
            x={(PAD.l + W - PAD.r) / 2}
            y={H - 6}
            textAnchor="middle"
            fontSize={11}
            fill={axis}
          >
            {t("zip.curve.x")}
          </text>
          <text
            x={12}
            y={(PAD.t + H - PAD.b) / 2}
            textAnchor="middle"
            fontSize={11}
            fill={axis}
            transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}
          >
            {t("zip.curve.y")}
          </text>
          {rows.map((r, i) => {
            const m = methodOf(r);
            const cx = x(Math.min(X_MAX, Math.max(X_MIN, r.size.bytes / 1e6)));
            const cy = y(r.kept.length + LANE[m]);
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHover(r)}
                onMouseLeave={() => setHover(null)}
                onClick={() =>
                  onPick({
                    minSynapses: r.minSynapses,
                    weightBits: r.weightBits,
                    merge: r.merge,
                  })
                }
                data-testid={`zip-point-${r.minSynapses}-${r.weightBits ?? "x"}-${r.merge ? "m" : "n"}`}
              >
                {/* hit target bigger than the mark */}
                <circle cx={cx} cy={cy} r={9} fill="transparent" />
                {same(r, current) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8.5}
                    fill="none"
                    stroke="rgb(var(--text))"
                    strokeWidth={2}
                  />
                )}
                <g stroke="rgb(var(--surface))" strokeWidth={1.5}>
                  <Mark method={m} cx={cx} cy={cy} color={palette[m]} />
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {(["prune", "bits", "merge"] as Method[]).map((m) => (
          <span key={m} className="flex items-center gap-1.5">
            <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
              <Mark method={m} cx={6} cy={6.5} color={palette[m]} r={4.5} />
            </svg>
            {t(`zip.curve.${m}` as StringKey)}
          </span>
        ))}
      </div>
      <p
        className="mt-2 min-h-[2.5rem] text-xs"
        aria-live="polite"
        data-testid="zip-curve-focus"
      >
        {focus && (
          <>
            <span className="font-mono">
              {t("zip.mb", { mb: n(focus.size.bytes / 1e6, 2) })}
            </span>{" "}
            · {label(focus)} — {keptNames(focus)}
          </>
        )}
      </p>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted">
          {t("zip.curve.table")}
        </summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-0.5 font-normal">{t("zip.curve.setting")}</th>
              <th className="py-0.5 text-right font-normal">MB</th>
              <th className="py-0.5 pl-3 font-normal">{t("zip.curve.y")}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => a.size.bytes - b.size.bytes)
              .map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-0.5">{label(r)}</td>
                  <td className="py-0.5 text-right font-mono">
                    {n(r.size.bytes / 1e6, 2)}
                  </td>
                  <td className="py-0.5 pl-3">{keptNames(r)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
