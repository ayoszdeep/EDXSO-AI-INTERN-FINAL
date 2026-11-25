"use client";

import { useState } from "react";
import { ManualEngagementInput } from "@/lib/types";
import { KeyRound, Upload, X, CheckCircle2, ShieldAlert } from "lucide-react";

export interface OptionalApiKeys {
  geminiApiKey: string;
  openAiApiKey: string;
  serperApiKey: string;
  tavilyApiKey: string;
}

export function parseCommentersText(
  raw: string
): NonNullable<ManualEngagementInput["commenters"]> {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Array<Record<string, string>>;
    return parsed
      .filter((row) => row.name && (row.linkedinUrl || row.linkedin_url || row.url))
      .map((row) => ({
        name: String(row.name),
        linkedinUrl: String(row.linkedinUrl || row.linkedin_url || row.url),
        currentRole: row.currentRole || row.role || "",
        organization: row.organization || row.org || "",
        location: row.location || "",
        commentText: row.commentText || row.comment || "",
      }));
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("name|"))
    .map((line) => {
      const parts = line.includes("|")
        ? line.split("|").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());
      return {
        name: parts[0] || "",
        linkedinUrl: parts[1] || "",
        currentRole: parts[2] || "",
        organization: parts[3] || "",
        location: parts[4] || "",
        commentText: parts[5] || "",
      };
    })
    .filter((c) => c.name && c.linkedinUrl);
}

const SAMPLE_MANUAL_COMMENTERS = `Dr. Sunanda Rao | https://www.linkedin.com/in/sunanda-rao-edu-sample | Former Principal & School Accreditation Advisor | Samarth K12 Advisory | Pune, India | Trustees across the 18 schools I advise evaluate EdTech partners in Q4 based on teacher adoption.
Vikramaditya Mehta | https://www.linkedin.com/in/vikramaditya-mehta-k12-sample | Managing Trustee & School Director | Meridian Global Schools | Ahmedabad, India | Multi-campus governance requires reliable academic and fee-management partners recommended by peer principals.`;

export function SettingsModal({
  open,
  onClose,
  apiKeys,
  onSaveApiKeys,
  manualCommentersRaw,
  onSaveManualCommentersRaw,
}: {
  open: boolean;
  onClose: () => void;
  apiKeys: OptionalApiKeys;
  onSaveApiKeys: (keys: OptionalApiKeys) => void;
  manualCommentersRaw: string;
  onSaveManualCommentersRaw: (raw: string) => void;
}) {
  const [localKeys, setLocalKeys] = useState<OptionalApiKeys>(apiKeys);
  const [localRaw, setLocalRaw] = useState<string>(manualCommentersRaw);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  let parsedCount = 0;
  try {
    parsedCount = parseCommentersText(localRaw).length;
  } catch {
    parsedCount = 0;
  }

  const handleSave = () => {
    try {
      parseCommentersText(localRaw);
      setParseError(null);
      onSaveApiKeys(localKeys);
      onSaveManualCommentersRaw(localRaw);
      onClose();
    } catch {
      setParseError(
        "Invalid JSON format. Use a JSON array or pipe-delimited lines: Name | LinkedIn URL | Role | Organization | Location | Comment"
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233B]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Provider Keys and Manual Engagement Import"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_-16px_rgba(23,35,59,0.22)] sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label="Close settings"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-[#17233B]">
          Authorized Providers & User-Exported Engagement
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Optional configuration for live authorized search APIs, LLM enrichment, or user-exported commenter records for direct LinkedIn Post URL runs.
        </p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
          <span>
            Keys are kept only in your browser session memory and sent per request—never persisted on disk. Leave blank to run the built-in 12-dimension Semantic Engine + Clearly Labelled Test Dataset.
          </span>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#17233B]">
              <KeyRound className="h-4 w-4 text-blue-700" />
              Optional API Keys (Live Provider & LLM Hybrid Mode)
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">
                  Gemini API Key (LLM Insight)
                </span>
                <input
                  type="password"
                  value={localKeys.geminiApiKey}
                  onChange={(e) =>
                    setLocalKeys({ ...localKeys, geminiApiKey: e.target.value })
                  }
                  placeholder="AIza..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">
                  OpenAI API Key (Alternative LLM)
                </span>
                <input
                  type="password"
                  value={localKeys.openAiApiKey}
                  onChange={(e) =>
                    setLocalKeys({ ...localKeys, openAiApiKey: e.target.value })
                  }
                  placeholder="sk-..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">
                  Serper API Key (Public LinkedIn Post Index)
                </span>
                <input
                  type="password"
                  value={localKeys.serperApiKey}
                  onChange={(e) =>
                    setLocalKeys({ ...localKeys, serperApiKey: e.target.value })
                  }
                  placeholder="serper key..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">
                  Tavily API Key (Alternative Search Index)
                </span>
                <input
                  type="password"
                  value={localKeys.tavilyApiKey}
                  onChange={(e) =>
                    setLocalKeys({ ...localKeys, tavilyApiKey: e.target.value })
                  }
                  placeholder="tvly-..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#17233B]">
                <Upload className="h-4 w-4 text-teal-700" />
                User-Supplied Commenters (For Direct Post URL Mode)
              </h3>
              <button
                type="button"
                onClick={() => setLocalRaw(SAMPLE_MANUAL_COMMENTERS)}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Load sample import rows
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Paste JSON array or pipe-separated lines: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">Name | LinkedIn URL | Role | Organization | Location | Comment</code>
            </p>
            <textarea
              rows={5}
              value={localRaw}
              onChange={(e) => setLocalRaw(e.target.value)}
              placeholder="Dr. Sunanda Rao | https://www.linkedin.com/in/... | Former Principal | ..."
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                Detected {parsedCount} valid manual commenter record{parsedCount === 1 ? "" : "s"}
              </span>
              {localRaw && (
                <button
                  type="button"
                  onClick={() => setLocalRaw("")}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              )}
            </div>
            {parseError && (
              <p className="mt-2 text-xs font-medium text-red-600">{parseError}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-11 rounded-xl bg-[#0F3FBF] px-5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
