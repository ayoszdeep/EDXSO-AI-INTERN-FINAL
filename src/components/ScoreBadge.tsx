"use client";

import { PersonaTier, ScoreBreakdown } from "@/lib/types";

export function scoreTone(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (score >= 62) return "bg-brand-soft text-brand-ink ring-blue-200";
  if (score >= 42) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-cream-2 text-muted ring-line-strong";
}

export function ScorePill({ score }: { score: number }) {
  return (
    <div
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ${scoreTone(score)}`}
      title={`EDXSO relevance score ${score}/100`}
    >
      <span className="text-lg font-extrabold leading-none tabular-nums">{score}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-75">score</span>
    </div>
  );
}

const TIER_STYLES: Record<PersonaTier, { label: string; cls: string }> = {
  "Primary Decision-Maker / Advisor": {
    label: "Decision-maker",
    cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  "Ecosystem Multiplier": { label: "Multiplier", cls: "bg-brand-soft text-brand-ink ring-blue-200" },
  "Adjacent EdTech Operator": { label: "Adjacent", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  "Low Fit": { label: "Low fit", cls: "bg-cream-2 text-muted ring-line-strong" },
};

export function TierBadge({ tier }: { tier: PersonaTier }) {
  const t = TIER_STYLES[tier];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${t.cls}`}
      title={tier}
    >
      {t.label}
    </span>
  );
}

export function BreakdownBars({
  breakdown,
  isLookalike,
}: {
  breakdown: ScoreBreakdown;
  isLookalike?: boolean;
}) {
  const bars = [
    { label: "Ecosystem fit", value: breakdown.ecosystemFit, max: 35, color: "bg-brand" },
    { label: "Network reach", value: breakdown.networkReach, max: 25, color: "bg-teal-600" },
    { label: "Semantic match", value: breakdown.semanticAlignment, max: 25, color: "bg-violet-600" },
    {
      label: isLookalike ? "Seed similarity" : "Engagement",
      value: breakdown.engagementOrSimilaritySignal,
      max: 15,
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
      {bars.map((bar) => {
        const pct = Math.min(100, Math.round((bar.value / bar.max) * 100));
        return (
          <div key={bar.label}>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>{bar.label}</span>
              <span className="font-semibold text-ink tabular-nums">
                {bar.value}/{bar.max}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cream-2">
              <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
