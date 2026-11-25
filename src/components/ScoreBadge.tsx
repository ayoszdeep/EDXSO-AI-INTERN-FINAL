"use client";

import { PersonaTier, ScoreBreakdown } from "@/lib/types";

export function ScoreRing({
  score,
  label = "Score",
  tone = "primary",
}: {
  score: number;
  label?: string;
  tone?: "primary" | "teal" | "violet";
}) {
  const colorClasses =
    score >= 80
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : score >= 60
        ? "bg-blue-50 text-blue-800 border-blue-200"
        : score >= 42
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-slate-100 text-slate-600 border-slate-200";

  const accentBorder =
    tone === "teal" && score >= 60
      ? "ring-1 ring-teal-500/20"
      : tone === "violet" && score >= 60
        ? "ring-1 ring-violet-500/20"
        : "";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-3.5 py-2 min-w-[74px] ${colorClasses} ${accentBorder}`}
    >
      <span className="text-xl font-extrabold leading-none tabular-nums">
        {score}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </span>
    </div>
  );
}

export function TierBadge({ tier }: { tier: PersonaTier }) {
  const styles: Record<PersonaTier, string> = {
    "Primary Decision-Maker / Advisor":
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Ecosystem Multiplier": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Adjacent EdTech Operator": "bg-amber-50 text-amber-800 border-amber-200",
    "Low Fit": "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[tier]}`}
    >
      {tier}
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
    {
      label: "Ecosystem Fit",
      value: breakdown.ecosystemFit,
      max: 35,
      color: "bg-blue-600",
    },
    {
      label: "Network Reach",
      value: breakdown.networkReach,
      max: 25,
      color: "bg-teal-600",
    },
    {
      label: "Semantic Match",
      value: breakdown.semanticAlignment,
      max: 25,
      color: "bg-violet-600",
    },
    {
      label: isLookalike ? "Seed Match" : "Engagement",
      value: breakdown.engagementOrSimilaritySignal,
      max: 15,
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {bars.map((bar) => {
        const pct = Math.min(100, Math.round((bar.value / bar.max) * 100));
        return (
          <div key={bar.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="truncate font-medium">{bar.label}</span>
              <span className="font-semibold text-[#17233B] tabular-nums">
                {bar.value}/{bar.max}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${bar.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
