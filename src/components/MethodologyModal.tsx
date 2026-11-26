"use client";

import { DiscoveryResult } from "@/lib/types";
import { ShieldCheck, Cpu, Scale, X } from "lucide-react";

export function MethodologyModal({
  open,
  onClose,
  methodology,
}: {
  open: boolean;
  onClose: () => void;
  methodology: DiscoveryResult["methodology"] | null;
}) {
  if (!open || !methodology) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI Ranking & Compliance Methodology"
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-2xl sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-cream-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Close methodology dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">
              AI Ranking, Embeddings & Compliance Architecture
            </h2>
            <p className="text-sm text-muted">
              How EDXSO scores commenters, discovers lookalikes, and preserves provenance
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6 text-sm text-ink-soft">
          <div className="rounded-xl border border-line bg-cream p-4">
            <h3 className="flex items-center gap-2 font-bold text-ink">
              <Scale className="h-4 w-4 text-brand" />
              Scoring Rubric (0–100 Points)
            </h3>
            <p className="mt-2 leading-relaxed">{methodology.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-paper p-3">
                <div className="text-xs font-medium text-muted">Ecosystem Fit</div>
                <div className="mt-1 text-lg font-bold text-brand tabular-nums">
                  {methodology.weights.ecosystemFit} pts
                </div>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3">
                <div className="text-xs font-medium text-muted">Network Reach</div>
                <div className="mt-1 text-lg font-bold text-teal-700 tabular-nums">
                  {methodology.weights.networkReach} pts
                </div>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3">
                <div className="text-xs font-medium text-muted">Semantic Match</div>
                <div className="mt-1 text-lg font-bold text-violet-700 tabular-nums">
                  {methodology.weights.semanticAlignment} pts
                </div>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3">
                <div className="text-xs font-medium text-muted">Signal / Seed Sim</div>
                <div className="mt-1 text-lg font-bold text-amber-600 tabular-nums">
                  {methodology.weights.engagementOrSimilaritySignal} pts
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-ink">
              12-Dimensional K12 Semantic Embedding Space
            </h3>
            <p className="mt-1 text-xs text-muted">
              Evaluates synonym-expanded role & ecosystem concepts rather than brittle exact keyword matching:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {methodology.embeddingDimensions.map((dim) => (
                <span
                  key={dim}
                  className="rounded-lg border border-line bg-cream px-2.5 py-1 text-xs font-medium text-ink-soft"
                >
                  {dim}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <h3 className="flex items-center gap-2 font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Compliant Data Access & Path to Production
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-emerald-950">
              {methodology.compliancePathToProduction.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
