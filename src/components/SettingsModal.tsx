"use client";

import { useMemo, useState } from "react";
import { ImportedCommenter } from "@/lib/types";
import { parseImportedCommenters } from "@/lib/data/import-parser";
import { CheckCircle2, FileUp, KeyRound, ShieldAlert, Upload, X } from "lucide-react";

export interface OptionalApiKeys {
  geminiApiKey: string;
  serperApiKey: string;
  tavilyApiKey: string;
  apifyApiToken: string;
}

export interface ServerProviders {
  serper: boolean;
  tavily: boolean;
  apify: boolean;
  gemini: boolean;
}

/** Safe wrapper used by the dashboard: never throws on malformed input. */
export function parseCommentersText(raw: string): ImportedCommenter[] {
  try {
    return parseImportedCommenters(raw);
  } catch {
    return [];
  }
}

const FORMAT_HELP = `CSV with a header row (any of these columns):
name,linkedin_url,role,organization,location,comment,post_url

Pipe lines:
Name | LinkedIn URL | Role | Organization | Location | Comment | Post URL

JSON array: [{"name": "...", "linkedinUrl": "...", "comment": "...", "postUrl": "..."}]
(Apify comment exports with actor.name / actor.linkedinUrl also work.)

Or paste text copied straight from a LinkedIn comment section.
Copied text has no profile links, so those rows show "URL not available".`;

function KeyField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  serverConfigured,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  serverConfigured: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
        {label}
        {serverConfigured && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Set on server
          </span>
        )}
      </span>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={serverConfigured ? "Using server key (optional override)" : placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      />
      <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>
    </label>
  );
}

export function SettingsModal({
  open,
  onClose,
  apiKeys,
  onSaveApiKeys,
  manualCommentersRaw,
  onSaveManualCommentersRaw,
  serverProviders,
}: {
  open: boolean;
  onClose: () => void;
  apiKeys: OptionalApiKeys;
  onSaveApiKeys: (keys: OptionalApiKeys) => void;
  manualCommentersRaw: string;
  onSaveManualCommentersRaw: (raw: string) => void;
  serverProviders: ServerProviders;
}) {
  const [localKeys, setLocalKeys] = useState<OptionalApiKeys>(apiKeys);
  const [localRaw, setLocalRaw] = useState<string>(manualCommentersRaw);
  const [fileError, setFileError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { rows: parseImportedCommenters(localRaw), error: null as string | null };
    } catch {
      return { rows: [] as ImportedCommenter[], error: "Could not parse this input. Check the JSON/CSV format." };
    }
  }, [localRaw]);

  if (!open) return null;

  const withUrl = parsed.rows.filter((r) => r.linkedinUrl).length;
  const withPost = parsed.rows.filter((r) => r.postUrl).length;

  const handleFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFileError("File is larger than 2 MB.");
      return;
    }
    setLocalRaw(await file.text());
  };

  const handleSave = () => {
    onSaveApiKeys(localKeys);
    onSaveManualCommentersRaw(localRaw);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233B]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Data providers and commenter import"
    >
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_-16px_rgba(23,35,59,0.22)] sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          aria-label="Close settings"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-[#17233B]">Data Providers & Commenter Import</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live runs use authorised sources only: a public search index for posts and profiles, a licensed
          provider for public comments, and exports you supply. LinkedIn is never logged into or scraped.
        </p>

        <div className="mt-5 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>
            Keys typed here stay in this browser tab&apos;s memory and are sent only with your own requests. They
            are never stored on the server. Keys marked &quot;Set on server&quot; are already configured by the
            deployment.
          </span>
        </div>

        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#17233B]">
            <KeyRound className="h-4 w-4 text-blue-700" />
            Provider Keys
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KeyField
              label="Serper API key (posts + lookalike search)"
              hint="serper.dev: Google index of public LinkedIn posts and profiles."
              value={localKeys.serperApiKey}
              onChange={(v) => setLocalKeys({ ...localKeys, serperApiKey: v })}
              placeholder="serper key"
              serverConfigured={serverProviders.serper}
            />
            <KeyField
              label="Apify API token (post commenters)"
              hint="Licensed provider for public post comments (no LinkedIn cookies)."
              value={localKeys.apifyApiToken}
              onChange={(v) => setLocalKeys({ ...localKeys, apifyApiToken: v })}
              placeholder="apify_api_..."
              serverConfigured={serverProviders.apify}
            />
            <KeyField
              label="Gemini API key (AI ranking)"
              hint="Embeddings + persona classification for each profile."
              value={localKeys.geminiApiKey}
              onChange={(v) => setLocalKeys({ ...localKeys, geminiApiKey: v })}
              placeholder="AIza..."
              serverConfigured={serverProviders.gemini}
            />
            <KeyField
              label="Tavily API key (alternative search index)"
              hint="Used only when no Serper key is available."
              value={localKeys.tavilyApiKey}
              onChange={(v) => setLocalKeys({ ...localKeys, tavilyApiKey: v })}
              placeholder="tvly-..."
              serverConfigured={serverProviders.tavily}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#17233B]">
              <Upload className="h-4 w-4 text-teal-700" />
              Import Commenters (any post URL)
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <FileUp className="h-3.5 w-3.5" />
              Upload CSV / JSON / TXT
              <input
                type="file"
                accept=".csv,.json,.txt,.tsv,text/csv,application/json,text/plain"
                className="sr-only"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            In <b>Direct Post URL</b> mode every row is attributed to that post. In <b>Keyword</b> mode add a{" "}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">post_url</code> column so each
            comment is traced to the discovered post it belongs to.
          </p>
          <textarea
            rows={7}
            value={localRaw}
            onChange={(e) => setLocalRaw(e.target.value)}
            placeholder={FORMAT_HELP}
            aria-label="Commenter import data"
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
              {parsed.rows.length} commenter{parsed.rows.length === 1 ? "" : "s"} detected · {withUrl} with profile
              URL · {withPost} with post URL
            </span>
            {localRaw && (
              <button type="button" onClick={() => setLocalRaw("")} className="text-slate-500 hover:text-slate-800">
                Clear
              </button>
            )}
          </div>
          {(parsed.error || fileError) && (
            <p className="mt-2 text-xs font-medium text-red-600">{parsed.error ?? fileError}</p>
          )}

          {parsed.rows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Name</th>
                    <th className="px-2 py-1.5 font-semibold">Role / Org</th>
                    <th className="px-2 py-1.5 font-semibold">Profile URL</th>
                    <th className="px-2 py-1.5 font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <tr key={`${r.name}-${i}`} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-1.5 font-semibold text-[#17233B]">{r.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {[r.currentRole, r.organization].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-2 py-1.5 font-mono text-blue-700">
                        {r.linkedinUrl || <span className="text-slate-400">not available</span>}
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-1.5 text-slate-600">{r.commentText || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 5 && (
                <p className="border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-500">
                  + {parsed.rows.length - 5} more
                </p>
              )}
            </div>
          )}
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
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
