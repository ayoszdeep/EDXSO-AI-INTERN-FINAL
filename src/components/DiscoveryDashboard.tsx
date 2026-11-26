"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AiClassification,
  AnalyzedCommenter,
  DataSourceMode,
  DiscoveryRequest,
  DiscoveryResult,
  LookalikeProfile,
  SearchInputMode,
} from "@/lib/types";
import { BreakdownBars, ScoreRing, TierBadge } from "@/components/ScoreBadge";
import { MethodologyModal } from "@/components/MethodologyModal";
import {
  OptionalApiKeys,
  parseCommentersText,
  ServerProviders,
  SettingsModal,
} from "@/components/SettingsModal";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  Filter,
  GitBranch,
  Info,
  Link2,
  Loader2,
  MapPin,
  MessageSquareText,
  Search,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";

const SAMPLE_TEST_POST_URL =
  "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001";

const PRESET_QUERIES = [
  "K12 B2B Sales",
  "School Trustees & Principals",
  "Retired Principals School Consultants",
  "Multi-School EdTech Partnerships",
];

const WORKFLOW_STAGES = [
  { id: 1, label: "Search Input" },
  { id: 2, label: "Post Discovery" },
  { id: 3, label: "Commenter Extraction" },
  { id: 4, label: "AI Profile Analysis" },
  { id: 5, label: "Lookalike Discovery" },
  { id: 6, label: "Ranking & Export" },
];

export function DiscoveryDashboard() {
  const [mode, setMode] = useState<SearchInputMode>("keyword");
  const [query, setQuery] = useState("K12 B2B Sales");
  const [postUrl, setPostUrl] = useState("");
  const [dataSourcePref, setDataSourcePref] = useState<DataSourceMode>(
    "labelled_test_dataset"
  );

  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTrack, setActiveTrack] = useState<
    "commenters" | "lookalikes" | "split"
  >("split");
  const [minScore, setMinScore] = useState<number>(0);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [textFilter, setTextFilter] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCommenterIds, setExpandedCommenterIds] = useState<
    Record<string, boolean>
  >({});

  const [showMethodology, setShowMethodology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<OptionalApiKeys>({
    geminiApiKey: "",
    serperApiKey: "",
    tavilyApiKey: "",
    apifyApiToken: "",
  });
  const [serverProviders, setServerProviders] = useState<ServerProviders>({
    serper: false,
    tavily: false,
    apify: false,
    gemini: false,
  });
  const [manualCommentersRaw, setManualCommentersRaw] = useState("");
  const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(
    null
  );

  const executeDiscovery = useCallback(
    async (override?: Partial<DiscoveryRequest>) => {
      setLoading(true);
      setError(null);
      try {
        const effectiveMode = override?.mode ?? mode;
        const parsedManual = parseCommentersText(manualCommentersRaw);
        const targetPostUrl = override?.postUrl ?? postUrl;

        const payload: DiscoveryRequest = {
          mode: effectiveMode,
          query: override?.query ?? query,
          postUrl: targetPostUrl,
          dataSource: override?.dataSource ?? dataSourcePref,
          maxPosts: 5,
          maxLookalikes: 12,
          manualInput:
            parsedManual.length > 0
              ? {
                  postUrl: effectiveMode === "post_url" ? targetPostUrl : undefined,
                  commenters: parsedManual,
                }
              : undefined,
          apiKeys: {
            geminiApiKey: apiKeys.geminiApiKey.trim() || undefined,
            serperApiKey: apiKeys.serperApiKey.trim() || undefined,
            tavilyApiKey: apiKeys.tavilyApiKey.trim() || undefined,
            apifyApiToken: apiKeys.apifyApiToken.trim() || undefined,
          },
        };

        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Discovery request failed");
        }
        setResult(data as DiscoveryResult);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to execute workflow"
        );
      } finally {
        setLoading(false);
      }
    },
    [apiKeys, dataSourcePref, manualCommentersRaw, mode, postUrl, query]
  );

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { providersConfigured?: ServerProviders } | null) => {
        if (!active || !data?.providersConfigured) return;
        setServerProviders(data.providersConfigured);
        if (data.providersConfigured.serper || data.providersConfigured.tavily) {
          setDataSourcePref("authorized_provider");
        }
      })
      .catch(() => {
        // health is advisory only
      });
    // First paint runs the free, clearly labelled test dataset so no provider credit is spent on page load
    fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "keyword",
        query: "K12 B2B Sales",
        dataSource: "labelled_test_dataset",
        maxPosts: 5,
        maxLookalikes: 12,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Discovery request failed");
        return data as DiscoveryResult;
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to execute workflow"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeDiscovery();
  };

  const handleAnalyzeSinglePost = (url: string) => {
    setMode("post_url");
    setPostUrl(url);
    void executeDiscovery({ mode: "post_url", postUrl: url });
  };

  const handleCopyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    if (!result) return;
    setExportingFormat(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, result }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `edxso-prospects-${result.runId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingFormat(null);
    }
  };

  const filteredCommenters = useMemo(() => {
    if (!result) return [];
    const q = textFilter.trim().toLowerCase();
    return result.commenters.filter((c) => {
      if (c.relevanceScore < minScore) return false;
      if (tierFilter !== "all" && c.personaTier !== tierFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.currentRole} ${c.organization} ${c.location ?? ""} ${c.schoolEcosystemIndicators.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [result, minScore, tierFilter, textFilter]);

  const filteredLookalikes = useMemo(() => {
    if (!result) return [];
    const q = textFilter.trim().toLowerCase();
    return result.lookalikes.filter((l) => {
      if (l.relevanceScore < minScore) return false;
      if (tierFilter !== "all" && l.personaTier !== tierFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.currentRole} ${l.organization} ${l.location ?? ""} ${l.schoolEcosystemIndicators.join(" ")} ${l.seedProfiles.map((s) => s.seedCommenterName).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [result, minScore, tierFilter, textFilter]);

  const hasLiveSearchKey = Boolean(
    apiKeys.serperApiKey.trim() ||
      apiKeys.tavilyApiKey.trim() ||
      serverProviders.serper ||
      serverProviders.tavily
  );
  const hasCommentsSource = Boolean(
    apiKeys.apifyApiToken.trim() || serverProviders.apify || manualCommentersRaw.trim()
  );
  const importedCount = useMemo(
    () => parseCommentersText(manualCommentersRaw).length,
    [manualCommentersRaw]
  );

  // Verify (not just claim) that no lookalike is also a commenter
  const overlapCount = useMemo(() => {
    if (!result) return 0;
    const urls = new Set(
      result.commenters.map((c) => c.canonicalLinkedinUrl).filter(Boolean)
    );
    return result.lookalikes.filter((l) => urls.has(l.canonicalLinkedinUrl)).length;
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F3FBF] text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[#17233B] sm:text-lg">
                  EDXSO Prospect Intelligence
                </span>
                <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 sm:inline-flex">
                  K12 Ecosystem AI
                </span>
              </div>
              <p className="text-xs text-slate-600">
                LinkedIn Engagement Extraction, Deduplication & Lookalike Discovery
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMethodology(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <BookOpen className="h-4 w-4 text-blue-700" />
              <span>Scoring Logic</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Settings2 className="h-4 w-4 text-slate-700" />
              <span>Providers & Import</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <button
              type="button"
              disabled={!result || exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#17233B] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Download className="h-4 w-4 text-teal-700" />
              <span>{exportingFormat === "csv" ? "Exporting..." : "Export CSV"}</span>
            </button>
            <button
              type="button"
              disabled={!result || exportingFormat !== null}
              onClick={() => void handleExport("json")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#17233B] px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Download className="h-4 w-4" />
              <span>{exportingFormat === "json" ? "Exporting..." : "Export JSON"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Compliance & Provenance Banner */}
        {result && (
          <div
            className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              result.isTestData
                ? "border-amber-200 bg-amber-50/85 text-amber-950"
                : "border-emerald-200 bg-emerald-50/85 text-emerald-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  result.isTestData ? "text-amber-700" : "text-emerald-700"
                }`}
              />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">
                  {result.isTestData
                    ? "Data Provenance: Clearly Labelled Test Dataset"
                    : `Data Provenance: ${result.dataSource === "authorized_provider" ? "Authorized Search Index" : "User-Supplied Post URL & Engagement"}`}
                </span>
                <p className="mt-0.5 leading-relaxed opacity-90">
                  {result.complianceNotice}
                </p>
                <p className="mt-1 text-[11px] opacity-80">
                  Posts: {result.providers.posts} · Comments: {result.providers.comments} · Lookalikes:{" "}
                  {result.providers.lookalikes} · Ranking: {result.providers.ai}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
              <span className="rounded-lg border border-current/20 bg-white/70 px-2.5 py-1">
                AI: {result.aiMethod}
              </span>
            </div>
          </div>
        )}

        {result && result.warnings.length > 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
            <div className="flex items-center gap-2 font-bold">
              <Info className="h-4 w-4 text-blue-700" />
              Run notes
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Stage 1: Search Input Studio */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(23,35,59,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#17233B] sm:text-2xl">
                Discover School-Ecosystem Decision Makers & Lookalikes
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Start from a search phrase (e.g., <span className="font-semibold text-[#17233B]">“K12 B2B Sales”</span>) or supply a direct LinkedIn post URL to extract commenters, deduplicate across posts, and rank AI lookalikes.
              </p>
            </div>

            {/* Input Mode Switch */}
            <div
              className="inline-flex self-start rounded-xl border border-slate-200 bg-[#F7F9FC] p-1"
              role="tablist"
              aria-label="Discovery input mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "keyword"}
                onClick={() => setMode("keyword")}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold transition ${
                  mode === "keyword"
                    ? "bg-white text-[#0F3FBF] shadow-sm"
                    : "text-slate-600 hover:text-[#17233B]"
                }`}
              >
                <Search className="h-4 w-4" />
                Keyword / Phrase
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "post_url"}
                onClick={() => setMode("post_url")}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold transition ${
                  mode === "post_url"
                    ? "bg-white text-[#0F3FBF] shadow-sm"
                    : "text-slate-600 hover:text-[#17233B]"
                }`}
              >
                <Link2 className="h-4 w-4" />
                Direct Post URL
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              {mode === "keyword" ? (
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter search phrase (e.g., K12 B2B Sales)"
                    aria-label="Search phrase"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-base text-[#17233B] placeholder:text-slate-400 focus:border-[#0F3FBF] focus:outline-none focus:ring-2 focus:ring-[#0F3FBF]/20"
                  />
                </div>
              ) : (
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/posts/..."
                    aria-label="LinkedIn post URL"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm text-[#17233B] placeholder:text-slate-400 focus:border-[#0F3FBF] focus:outline-none focus:ring-2 focus:ring-[#0F3FBF]/20"
                  />
                </div>
              )}

              {mode === "keyword" && (
                <select
                  value={dataSourcePref}
                  onChange={(e) =>
                    setDataSourcePref(e.target.value as DataSourceMode)
                  }
                  aria-label="Data source mode"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-[#17233B] focus:border-[#0F3FBF] focus:outline-none"
                >
                  <option value="authorized_provider" disabled={!hasLiveSearchKey}>
                    Live LinkedIn data{hasLiveSearchKey ? "" : " (add Serper key)"}
                  </option>
                  <option value="labelled_test_dataset">Labelled test dataset</option>
                </select>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0F3FBF] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {dataSourcePref === "authorized_provider" || mode === "post_url"
                      ? "Fetching live data (up to ~1 min)..."
                      : "Running Pipeline..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Run Discovery
                  </>
                )}
              </button>
            </div>

            {mode === "keyword" ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500">Demo presets:</span>
                {PRESET_QUERIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setQuery(preset);
                      void executeDiscovery({ mode: "keyword", query: preset });
                    }}
                    className={`rounded-full border px-3 py-1 font-medium transition ${
                      query === preset
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Paste any public LinkedIn post URL, or</span>
                  <button
                    type="button"
                    onClick={() => setPostUrl(SAMPLE_TEST_POST_URL)}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    use a labelled test-dataset post
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  {importedCount > 0
                    ? `${importedCount} imported commenter(s) ready · edit →`
                    : hasCommentsSource
                      ? "Commenters via Apify · import more →"
                      : "Commenters: add Apify token or import a list →"}
                </button>
              </div>
            )}
          </form>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}
        </section>

        {/* 6-Stage Pipeline Stepper + KPI Summary */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {WORKFLOW_STAGES.map((stage) => {
              const completed = Boolean(result) && !loading;
              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition ${
                    completed
                      ? "border-emerald-200/80 bg-white text-[#17233B]"
                      : "border-slate-200 bg-white/70 text-slate-500"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                      completed
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : stage.id}
                  </span>
                  <span className="font-semibold leading-tight">
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>

          {result && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(23,35,59,0.04)]">
                <div className="text-xs font-semibold text-slate-500">
                  Relevant Posts Discovered
                </div>
                <div className="mt-1 text-2xl font-extrabold text-[#17233B] tabular-nums">
                  {result.stats.postsFound}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {result.inputMode === "keyword"
                    ? "Top 5 ranked recent posts"
                    : "Direct URL processed"}
                </div>
              </div>

              <div className="rounded-2xl border border-teal-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(23,35,59,0.04)]">
                <div className="text-xs font-semibold text-teal-800">
                  Unique Original Commenters
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-teal-700 tabular-nums">
                    {result.stats.uniqueCommenters}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    ({result.stats.deduplicatedDuplicatesRemoved} dupes merged)
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Avg score {result.stats.avgCommenterScore}/100 · From {result.stats.rawCommentsExtracted} comments
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(23,35,59,0.04)]">
                <div className="text-xs font-semibold text-violet-800">
                  AI Lookalike Profiles
                </div>
                <div className="mt-1 text-2xl font-extrabold text-violet-700 tabular-nums">
                  {result.stats.lookalikesDiscovered}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Avg score {result.stats.avgLookalikeScore}/100 · Seed-traced
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(23,35,59,0.04)]">
                <div className="text-xs font-semibold text-slate-500">
                  Category Isolation
                </div>
                <div
                  className={`mt-1 text-lg font-extrabold ${overlapCount === 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {overlapCount === 0 ? "Verified" : `${overlapCount} overlap(s)`}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  Commenter/lookalike URL overlap checked in browser
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Stage 2: Discovered Source Posts */}
        {result && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(23,35,59,0.05)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#17233B]">
                  Stage 2 · Discovered Source Posts ({result.posts.length})
                </h2>
                <p className="text-xs text-slate-600">
                  Complete post URLs, authors, publish dates, and snippets used for commenter extraction
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {result.posts.map((post, index) => (
                <article
                  key={post.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[#F7F9FC]/60 p-4 transition hover:border-blue-300 hover:bg-white"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 tabular-nums">
                        Post #{index + 1} · {Math.round(post.relevanceToQuery * 100)}% match
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                        {post.publishedAt ? post.publishedAt.slice(0, 10) : "Date n/a"}
                        {" · "}
                        {post.engagementStats.comments} comment
                        {post.engagementStats.comments === 1 ? "" : "s"}
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-sm font-bold text-[#17233B]">
                      {post.authorName}
                    </h3>
                    <p className="text-xs text-slate-600">{post.authorRole}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-700">
                      “{post.snippet}”
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5 border-t border-slate-200/80 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {post.topics.slice(0, 3).map((topic) => (
                        <span
                          key={topic}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 truncate font-mono text-[11px] font-medium text-blue-700 hover:underline"
                        title={post.url}
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {post.url.replace("https://www.linkedin.com", "")}
                        </span>
                      </a>
                      {result.inputMode === "keyword" && (
                        <button
                          type="button"
                          onClick={() => handleAnalyzeSinglePost(post.url)}
                          className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
                        >
                          Isolate Post
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Stages 3-6: Separated & Ranked Commenters vs Lookalikes */}
        {result && (
          <section className="space-y-4">
            {/* Filter & View Controls */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_8px_rgba(23,35,59,0.04)] lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap gap-1.5 rounded-xl bg-[#F7F9FC] p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTrack("split")}
                  className={`h-9 rounded-lg px-3.5 text-xs font-bold transition ${
                    activeTrack === "split"
                      ? "bg-white text-[#17233B] shadow-sm"
                      : "text-slate-600 hover:text-[#17233B]"
                  }`}
                >
                  Side-by-Side Split View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrack("commenters")}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition ${
                    activeTrack === "commenters"
                      ? "bg-teal-700 text-white shadow-sm"
                      : "text-slate-600 hover:text-[#17233B]"
                  }`}
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Original Commenters ({filteredCommenters.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTrack("lookalikes")}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition ${
                    activeTrack === "lookalikes"
                      ? "bg-violet-700 text-white shadow-sm"
                      : "text-slate-600 hover:text-[#17233B]"
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  AI Lookalikes ({filteredLookalikes.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    placeholder="Filter name, org, city..."
                    aria-label="Filter results"
                    className="h-9 w-48 rounded-lg border border-slate-300 pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  aria-label="Filter by persona tier"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-[#17233B] focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Persona Tiers</option>
                  <option value="Primary Decision-Maker / Advisor">
                    Primary Decision-Maker / Advisor
                  </option>
                  <option value="Ecosystem Multiplier">
                    Ecosystem Multiplier
                  </option>
                  <option value="Adjacent EdTech Operator">
                    Adjacent EdTech Operator
                  </option>
                  <option value="Low Fit">Low Fit</option>
                </select>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Min Score:</span>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="w-24 accent-[#0F3FBF]"
                  />
                  <span className="w-7 font-bold tabular-nums text-[#17233B]">
                    {minScore}
                  </span>
                </label>
              </div>
            </div>

            <div
              className={`grid grid-cols-1 gap-6 ${
                activeTrack === "split" ? "xl:grid-cols-2" : ""
              }`}
            >
              {/* TRACK A: ORIGINAL COMMENTERS */}
              {(activeTrack === "split" || activeTrack === "commenters") && (
                <div className="space-y-4 rounded-2xl border border-teal-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(23,35,59,0.05)]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#17233B]">
                          Original Post Commenters ({filteredCommenters.length})
                        </h2>
                        <p className="text-xs text-slate-600">
                          Deduplicated across posts · Direct engagement provenance preserved
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">
                      Category: original_commenter
                    </span>
                  </div>

                  {filteredCommenters.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-[#F7F9FC] p-6 text-center text-sm text-slate-600">
                      {result.commenters.length === 0 ? (
                        <>
                          No commenters retrieved for these posts yet.{" "}
                          <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="font-semibold text-teal-700 hover:underline"
                          >
                            Add an Apify token or import commenters
                          </button>
                          , then run again.
                        </>
                      ) : (
                        "No commenters match your current score or text filters."
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredCommenters.map((commenter, idx) => (
                        <CommenterCard
                          key={commenter.id}
                          commenter={commenter}
                          rank={idx + 1}
                          copiedId={copiedId}
                          onCopy={handleCopyUrl}
                          expanded={Boolean(expandedCommenterIds[commenter.id])}
                          onToggleExpand={() =>
                            setExpandedCommenterIds((prev) => ({
                              ...prev,
                              [commenter.id]: !prev[commenter.id],
                            }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TRACK B: AI LOOKALIKES */}
              {(activeTrack === "split" || activeTrack === "lookalikes") && (
                <div className="space-y-4 rounded-2xl border border-violet-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(23,35,59,0.05)]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#17233B]">
                          AI-Discovered Lookalike Profiles ({filteredLookalikes.length})
                        </h2>
                        <p className="text-xs text-slate-600">
                          Matched from commenter seeds · Never mislabelled as commenters
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-800">
                      Category: ai_lookalike_profile
                    </span>
                  </div>

                  {filteredLookalikes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-[#F7F9FC] p-6 text-center text-sm text-slate-600">
                      {result.lookalikes.length === 0
                        ? "Lookalike discovery requires at least 1 seed commenter profile."
                        : "No lookalike profiles match your current score or text filters."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredLookalikes.map((lookalike, idx) => (
                        <LookalikeCard
                          key={lookalike.id}
                          lookalike={lookalike}
                          rank={idx + 1}
                          copiedId={copiedId}
                          onCopy={handleCopyUrl}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <MethodologyModal
        open={showMethodology}
        onClose={() => setShowMethodology(false)}
        methodology={result?.methodology ?? null}
      />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        apiKeys={apiKeys}
        onSaveApiKeys={setApiKeys}
        manualCommentersRaw={manualCommentersRaw}
        onSaveManualCommentersRaw={setManualCommentersRaw}
        serverProviders={serverProviders}
      />
    </div>
  );
}

function CommenterCard({
  commenter,
  rank,
  copiedId,
  onCopy,
  expanded,
  onToggleExpand,
}: {
  commenter: AnalyzedCommenter;
  rank: number;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-[#F7F9FC]/45 p-4 transition hover:border-teal-300 hover:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
              #{rank}
            </span>
            <h3 className="text-base font-bold text-[#17233B]">
              {commenter.name}
            </h3>
            <TierBadge tier={commenter.personaTier} />
            {commenter.commentCount > 1 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                Deduplicated · {commenter.commentCount} comments
              </span>
            )}
            <SourceBadge dataSource={commenter.dataSource} isTestData={commenter.isTestData} />
          </div>
          {commenter.headline && commenter.headline !== commenter.currentRole && (
            <p className="text-xs text-slate-500">{commenter.headline}</p>
          )}
          <p className="text-sm font-semibold text-slate-800">
            {commenter.currentRole} ·{" "}
            <span className="text-slate-600">{commenter.organization}</span>
          </p>
          {commenter.location && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {commenter.location}
            </p>
          )}
        </div>

        <ScoreRing score={commenter.relevanceScore} label="EDXSO" tone="teal" />
      </div>

      {/* Complete LinkedIn URL */}
      <ProfileUrlRow id={commenter.id} url={commenter.linkedinUrl} copiedId={copiedId} onCopy={onCopy} />

      {/* School-Ecosystem Indicators */}
      {commenter.schoolEcosystemIndicators.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {commenter.schoolEcosystemIndicators.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-teal-200 bg-teal-50/70 px-2 py-0.5 text-[11px] font-semibold text-teal-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* AI Explanation */}
      <AiChip ai={commenter.aiClassification} />
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        {commenter.relevanceExplanation}
      </p>

      {/* Score Breakdown */}
      <div className="mt-3 border-t border-slate-200/70 pt-3">
        <BreakdownBars breakdown={commenter.scoreBreakdown} />
      </div>

      {/* Post Traceability & Comment Snippets */}
      <div className="mt-3 border-t border-slate-200/70 pt-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs font-semibold text-teal-800 hover:underline"
        >
          {expanded ? "Hide" : "View"} source post traceability & comments (
          {commenter.associatedPostUrls.length})
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {commenter.comments.map((cm, i) => (
              <div
                key={`${cm.postId}-${i}`}
                className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
              >
                <a
                  href={cm.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-mono text-[11px] font-medium text-blue-700 hover:underline"
                >
                  {cm.postUrl}
                </a>
                <p className="mt-1 text-slate-700">“{cm.text}”</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function LookalikeCard({
  lookalike,
  rank,
  copiedId,
  onCopy,
}: {
  lookalike: LookalikeProfile;
  rank: number;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-[#F7F9FC]/45 p-4 transition hover:border-violet-300 hover:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-violet-700 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
              #{rank}
            </span>
            <h3 className="text-base font-bold text-[#17233B]">
              {lookalike.name}
            </h3>
            <TierBadge tier={lookalike.personaTier} />
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-800 tabular-nums">
              {lookalike.similarityScore}% Seed Match
            </span>
            <SourceBadge dataSource={lookalike.dataSource} isTestData={lookalike.isTestData} />
          </div>
          {lookalike.headline && lookalike.headline !== lookalike.currentRole && (
            <p className="text-xs text-slate-500">{lookalike.headline}</p>
          )}
          <p className="text-sm font-semibold text-slate-800">
            {lookalike.currentRole} ·{" "}
            <span className="text-slate-600">{lookalike.organization}</span>
          </p>
          {lookalike.location && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {lookalike.location}
            </p>
          )}
        </div>

        <ScoreRing
          score={lookalike.relevanceScore}
          label="EDXSO"
          tone="violet"
        />
      </div>

      {/* Complete LinkedIn URL */}
      <ProfileUrlRow id={lookalike.id} url={lookalike.linkedinUrl} copiedId={copiedId} onCopy={onCopy} />

      {/* Indicators */}
      {lookalike.schoolEcosystemIndicators.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lookalike.schoolEcosystemIndicators.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-violet-200 bg-violet-50/70 px-2 py-0.5 text-[11px] font-semibold text-violet-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* AI Explanation */}
      <AiChip ai={lookalike.aiClassification} />
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        {lookalike.relevanceExplanation}
      </p>

      {/* Score Breakdown */}
      <div className="mt-3 border-t border-slate-200/70 pt-3">
        <BreakdownBars breakdown={lookalike.scoreBreakdown} isLookalike />
      </div>

      {/* Seed Profile Traceability */}
      <div className="mt-3 rounded-xl border border-violet-200/70 bg-violet-50/40 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-violet-900">
          Seed Profile Traceability & Similarity Evidence
        </div>
        <div className="mt-2 space-y-1.5">
          {lookalike.seedProfiles.map((seed) => (
            <div key={seed.seedCommenterId} className="text-xs text-slate-700">
              <span className="font-semibold text-[#17233B]">
                {seed.seedCommenterName}
              </span>{" "}
              <span className="font-bold text-violet-700 tabular-nums">
                ({seed.similarityScore}%)
              </span>
              : {seed.rationale}
            </div>
          ))}
          {lookalike.discoveredVia && lookalike.discoveredVia.provider !== "labelled_test_dataset" && (
            <div className="mt-1 border-t border-violet-200/70 pt-1.5 text-[11px] text-slate-600">
              Found via public profile search{" "}
              <code className="rounded bg-white px-1 font-mono">{lookalike.discoveredVia.query}</code>, built
              from seed(s): {lookalike.discoveredVia.seedCommenterNames.join(", ")}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ProfileUrlRow({
  id,
  url,
  copiedId,
  onCopy,
}: {
  id: string;
  url: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  if (!url) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
        Profile URL not available from this source
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate font-mono text-xs font-medium text-blue-700 hover:underline"
      >
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{url}</span>
      </a>
      <button
        type="button"
        onClick={() => onCopy(id, url)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
      >
        {copiedId === id ? (
          <>
            <Check className="h-3 w-3 text-emerald-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy URL
          </>
        )}
      </button>
    </div>
  );
}

function SourceBadge({
  dataSource,
  isTestData,
}: {
  dataSource: DataSourceMode;
  isTestData: boolean;
}) {
  const { label, cls } = isTestData
    ? { label: "Test data", cls: "border-amber-200 bg-amber-50 text-amber-900" }
    : dataSource === "authorized_provider"
      ? { label: "Live provider", cls: "border-emerald-200 bg-emerald-50 text-emerald-900" }
      : { label: "User import", cls: "border-sky-200 bg-sky-50 text-sky-900" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
  );
}

function AiChip({ ai }: { ai?: AiClassification }) {
  if (!ai) return null;
  return (
    <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] text-indigo-900">
      <Sparkles className="h-3 w-3" />
      <span className="font-bold">Gemini:</span>
      <span>{ai.persona}</span>
      <span className="font-bold tabular-nums">· fit {ai.fitScore}/100</span>
    </div>
  );
}
