"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AiClassification,
  AnalyzedCommenter,
  DataSourceMode,
  DiscoveryRequest,
  DiscoveryResult,
  LookalikeProfile,
  SearchInputMode,
} from "@/lib/types";
import { BreakdownBars, ScorePill, TierBadge } from "@/components/ScoreBadge";
import { MethodologyModal } from "@/components/MethodologyModal";
import {
  OptionalApiKeys,
  parseCommentersText,
  ServerProviders,
  SettingsModal,
} from "@/components/SettingsModal";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";

const SAMPLE_TEST_POST_URL =
  "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001";

const PRESET_QUERIES = [
  "K12 B2B Sales",
  "School Trustees & Principals",
  "Retired Principals School Consultants",
  "Multi-School EdTech Partnerships",
];

const STAGES = ["Input", "Posts", "Commenters", "AI analysis", "Lookalikes", "Rank & export"];

type Track = "both" | "commenters" | "lookalikes";

export function DiscoveryDashboard() {
  const [mode, setMode] = useState<SearchInputMode>("keyword");
  const [query, setQuery] = useState("K12 B2B Sales");
  const [postUrl, setPostUrl] = useState("");
  const [dataSourcePref, setDataSourcePref] = useState<DataSourceMode>("labelled_test_dataset");

  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [track, setTrack] = useState<Track>("both");
  const [minScore, setMinScore] = useState(0);
  const [tierFilter, setTierFilter] = useState("all");
  const [textFilter, setTextFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showMethodology, setShowMethodology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

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
        if (!res.ok) throw new Error(data.error || "Discovery request failed");
        setResult(data as DiscoveryResult);
        setShowDetails((data as DiscoveryResult).warnings.length > 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run discovery");
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
        // advisory only
      });
    // First paint uses the free labelled test dataset, so no provider credit is spent on page load
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
        if (active) setError(err instanceof Error ? err.message : "Failed to run discovery");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    if (!result) return;
    setExportOpen(false);
    setExporting(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, result }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edxso-prospects-${result.runId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const matchesFilters = useCallback(
    (score: number, tier: string, hay: string) => {
      if (score < minScore) return false;
      if (tierFilter !== "all" && tier !== tierFilter) return false;
      const q = textFilter.trim().toLowerCase();
      return !q || hay.toLowerCase().includes(q);
    },
    [minScore, tierFilter, textFilter]
  );

  const commenters = useMemo(
    () =>
      (result?.commenters ?? []).filter((c) =>
        matchesFilters(
          c.relevanceScore,
          c.personaTier,
          `${c.name} ${c.currentRole} ${c.organization} ${c.location ?? ""} ${c.schoolEcosystemIndicators.join(" ")}`
        )
      ),
    [result, matchesFilters]
  );

  const lookalikes = useMemo(
    () =>
      (result?.lookalikes ?? []).filter((l) =>
        matchesFilters(
          l.relevanceScore,
          l.personaTier,
          `${l.name} ${l.currentRole} ${l.organization} ${l.location ?? ""} ${l.schoolEcosystemIndicators.join(" ")} ${l.seedProfiles.map((s) => s.seedCommenterName).join(" ")}`
        )
      ),
    [result, matchesFilters]
  );

  const overlapCount = useMemo(() => {
    if (!result) return 0;
    const urls = new Set(result.commenters.map((c) => c.canonicalLinkedinUrl).filter(Boolean));
    return result.lookalikes.filter((l) => urls.has(l.canonicalLinkedinUrl)).length;
  }, [result]);

  const hasLiveSearchKey = Boolean(
    apiKeys.serperApiKey.trim() || apiKeys.tavilyApiKey.trim() || serverProviders.serper || serverProviders.tavily
  );
  const hasApify = Boolean(apiKeys.apifyApiToken.trim() || serverProviders.apify);
  const importedCount = useMemo(() => parseCommentersText(manualCommentersRaw).length, [manualCommentersRaw]);
  const isLiveRequest = mode === "post_url" || dataSourcePref === "authorized_provider";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/edxso-logo.png" alt="EDXSO" width={107} height={32} priority className="h-8 w-auto" />
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden text-sm font-semibold text-ink-soft sm:block">Prospect Discovery</span>
          </div>

          <nav className="flex items-center gap-1.5">
            <HeaderButton onClick={() => setShowMethodology(true)} label="How scoring works">
              <BookOpen className="h-4 w-4" />
            </HeaderButton>
            <HeaderButton onClick={() => setShowSettings(true)} label="Data sources">
              <Settings2 className="h-4 w-4" />
            </HeaderButton>
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                disabled={!result || exporting !== null}
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition hover:bg-ink-soft disabled:opacity-50"
                aria-haspopup="menu"
                aria-expanded={exportOpen}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {exportOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-40 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg"
                >
                  {(["csv", "json"] as const).map((f) => (
                    <button
                      key={f}
                      role="menuitem"
                      type="button"
                      onClick={() => void handleExport(f)}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-cream-2"
                    >
                      Download {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {/* Search */}
        <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
            Find school-network decision makers
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Search a phrase or paste a LinkedIn post. We find the people who commented, rank them for EDXSO outreach,
            and discover similar professionals.
          </p>

          <div className="mt-5 inline-flex rounded-lg bg-cream-2 p-1" role="tablist" aria-label="Input mode">
            {(
              [
                ["keyword", "Keyword", Search],
                ["post_url", "Post URL", Link2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
                  mode === value ? "bg-paper text-brand shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void executeDiscovery();
            }}
            className="mt-3 flex flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              {mode === "keyword" ? (
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              ) : (
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              )}
              <input
                type={mode === "keyword" ? "text" : "url"}
                value={mode === "keyword" ? query : postUrl}
                onChange={(e) => (mode === "keyword" ? setQuery(e.target.value) : setPostUrl(e.target.value))}
                placeholder={mode === "keyword" ? "e.g. K12 B2B Sales" : "https://www.linkedin.com/posts/..."}
                aria-label={mode === "keyword" ? "Search phrase" : "LinkedIn post URL"}
                className={`h-12 w-full rounded-xl border border-line-strong bg-white pl-10 pr-4 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                  mode === "keyword" ? "text-base" : "font-mono text-sm"
                }`}
              />
            </div>
            {mode === "keyword" && (
              <select
                value={dataSourcePref}
                onChange={(e) => setDataSourcePref(e.target.value as DataSourceMode)}
                aria-label="Data source"
                className="h-12 rounded-xl border border-line-strong bg-white px-3 text-sm font-medium text-ink focus:border-brand focus:outline-none"
              >
                <option value="authorized_provider" disabled={!hasLiveSearchKey}>
                  Live data{hasLiveSearchKey ? "" : " (needs key)"}
                </option>
                <option value="labelled_test_dataset">Test dataset</option>
              </select>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-sm transition hover:bg-brand-ink disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? (isLiveRequest ? "Fetching live data…" : "Running…") : "Run discovery"}
            </button>
          </form>

          <div className="mt-3 flex min-h-7 flex-wrap items-center gap-2 text-xs text-muted">
            {mode === "keyword" ? (
              <>
                <span>Try:</span>
                {PRESET_QUERIES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setQuery(preset);
                      void executeDiscovery({ mode: "keyword", query: preset });
                    }}
                    className={`rounded-full px-2.5 py-1 font-medium ring-1 transition ${
                      query === preset
                        ? "bg-brand-soft text-brand-ink ring-blue-200"
                        : "bg-cream text-ink-soft ring-line hover:bg-cream-2"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </>
            ) : (
              <>
                <span>
                  {importedCount > 0
                    ? `${importedCount} imported commenter${importedCount === 1 ? "" : "s"} will be used.`
                    : hasApify
                      ? "Commenters are fetched automatically."
                      : "Add an Apify token or import commenters to analyse a post."}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="font-semibold text-brand hover:underline"
                >
                  Import commenters
                </button>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => setPostUrl(SAMPLE_TEST_POST_URL)}
                  className="font-semibold text-brand hover:underline"
                >
                  Use a test post
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <ol className="mt-6 flex items-center gap-2 overflow-x-auto border-t border-line pt-4 text-[11px] font-medium text-muted">
            {STAGES.map((stage, i) => {
              const done = Boolean(result) && !loading;
              return (
                <li key={stage} className="flex shrink-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? "bg-emerald-600 text-white" : loading ? "bg-brand-soft text-brand" : "bg-cream-2 text-muted"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={done ? "text-ink-soft" : ""}>{stage}</span>
                  {i < STAGES.length - 1 && <span className="h-px w-5 bg-line-strong" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </section>

        {loading && !result && <LoadingState live={isLiveRequest} />}

        {result && (
          <>
            {/* Run status */}
            <section
              className={`rounded-xl border px-4 py-3 text-sm ${
                result.isTestData ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      result.isTestData ? "bg-amber-200/70 text-amber-900" : "bg-emerald-200/70 text-emerald-900"
                    }`}
                  >
                    {result.isTestData ? "TEST DATA" : "LIVE DATA"}
                  </span>
                  <span className="text-ink-soft">
                    {result.isTestData
                      ? "Labelled test dataset: these are fixtures, not real LinkedIn records."
                      : "Real LinkedIn data from authorised sources (no login or scraping)."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"
                >
                  {result.warnings.length > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                      {result.warnings.length}
                    </span>
                  )}
                  Sources & notes
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showDetails ? "rotate-180" : ""}`} />
                </button>
              </div>
              {showDetails && (
                <div className="mt-3 space-y-2 border-t border-black/5 pt-3 text-xs text-ink-soft">
                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {(
                      [
                        ["Posts", result.providers.posts],
                        ["Commenters", result.providers.comments],
                        ["Lookalikes", result.providers.lookalikes],
                        ["Ranking", result.providers.ai],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="w-20 shrink-0 font-semibold text-ink">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {result.warnings.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5 text-amber-900">
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Posts"
                value={result.stats.postsFound}
                hint={result.inputMode === "keyword" ? "recent & relevant" : "direct URL"}
              />
              <Stat
                label="Commenters"
                value={result.stats.uniqueCommenters}
                hint={`${result.stats.deduplicatedDuplicatesRemoved} duplicates merged`}
                accent="text-teal-700"
              />
              <Stat
                label="Lookalikes"
                value={result.stats.lookalikesDiscovered}
                hint={`avg score ${result.stats.avgLookalikeScore}`}
                accent="text-violet-700"
              />
              <Stat
                label="Overlap check"
                value={overlapCount === 0 ? "Clean" : overlapCount}
                hint="no commenter shown as lookalike"
                accent={overlapCount === 0 ? "text-emerald-700" : "text-red-700"}
              />
            </section>

            {/* Posts */}
            <section>
              <SectionTitle title="Source posts" count={result.posts.length} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.posts.map((post) => (
                  <article key={post.id} className="flex flex-col rounded-xl border border-line bg-paper p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-ink">{post.authorName}</h3>
                        <p className="text-[11px] text-muted tabular-nums">
                          {post.publishedAt ? post.publishedAt.slice(0, 10) : "Date n/a"} ·{" "}
                          {post.engagementStats.comments} comment{post.engagementStats.comments === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-ink tabular-nums">
                        {Math.round(post.relevanceToQuery * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-ink-soft">{post.snippet}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open post
                      </a>
                      {result.inputMode === "keyword" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("post_url");
                            setPostUrl(post.url);
                            void executeDiscovery({ mode: "post_url", postUrl: post.url });
                          }}
                          className="text-xs font-semibold text-ink-soft hover:text-ink"
                        >
                          Analyse only this →
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Results */}
            <section className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex self-start rounded-lg bg-cream-2 p-1" role="tablist" aria-label="Result lists">
                  {(
                    [
                      ["both", "Both"],
                      ["commenters", `Commenters (${commenters.length})`],
                      ["lookalikes", `Lookalikes (${lookalikes.length})`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={track === value}
                      onClick={() => setTrack(value)}
                      className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                        track === value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    placeholder="Filter by name, org, city"
                    aria-label="Filter results"
                    className="h-9 w-48 rounded-lg border border-line-strong bg-white px-3 text-xs focus:border-brand focus:outline-none"
                  />
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    aria-label="Persona tier"
                    className="h-9 rounded-lg border border-line-strong bg-white px-2 text-xs text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="all">All tiers</option>
                    <option value="Primary Decision-Maker / Advisor">Decision-maker</option>
                    <option value="Ecosystem Multiplier">Multiplier</option>
                    <option value="Adjacent EdTech Operator">Adjacent</option>
                    <option value="Low Fit">Low fit</option>
                  </select>
                  <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 text-xs text-muted">
                    Min score
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      className="w-20 accent-[#006afe]"
                    />
                    <span className="w-5 font-semibold text-ink tabular-nums">{minScore}</span>
                  </label>
                </div>
              </div>

              <div className={`grid gap-6 ${track === "both" ? "lg:grid-cols-2" : ""}`}>
                {track !== "lookalikes" && (
                  <ResultColumn
                    title="Commenters"
                    subtitle="commented on the source posts"
                    dot="bg-teal-600"
                    empty={
                      result.commenters.length === 0 ? (
                        <>
                          No commenters yet.{" "}
                          <button
                            type="button"
                            onClick={() => setShowSettings(true)}
                            className="font-semibold text-brand hover:underline"
                          >
                            Add an Apify token or import commenters
                          </button>
                          , then run again.
                        </>
                      ) : (
                        "No commenters match the filters."
                      )
                    }
                  >
                    {commenters.map((c, i) => (
                      <CommenterCard key={c.id} c={c} rank={i + 1} copiedId={copiedId} onCopy={handleCopy} />
                    ))}
                  </ResultColumn>
                )}
                {track !== "commenters" && (
                  <ResultColumn
                    title="Lookalikes"
                    subtitle="similar professionals, found from commenters"
                    dot="bg-violet-600"
                    empty={
                      result.lookalikes.length === 0
                        ? "Lookalikes need at least one commenter to use as a seed."
                        : "No lookalikes match the filters."
                    }
                  >
                    {lookalikes.map((l, i) => (
                      <LookalikeCard key={l.id} l={l} rank={i + 1} copiedId={copiedId} onCopy={handleCopy} />
                    ))}
                  </ResultColumn>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-line py-5 text-center text-xs text-muted">
        EDXSO Prospect Discovery · Public search index, licensed provider and user-supplied data only. No LinkedIn login
        or scraping.
      </footer>

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

/* ---------- Small building blocks ---------- */

function HeaderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-ink-soft transition hover:bg-cream-2 hover:text-ink"
    >
      {children}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Stat({
  label,
  value,
  hint,
  accent = "text-ink",
}: {
  label: string;
  value: number | string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3.5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-extrabold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[11px] text-muted">{hint}</div>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex items-baseline gap-2 text-base font-bold text-ink">
      {title}
      <span className="text-sm font-medium text-muted tabular-nums">{count}</span>
    </h2>
  );
}

function LoadingState({ live }: { live: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper/60 py-16 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="mt-3 text-sm font-semibold text-ink">Running discovery…</p>
      <p className="mt-1 text-xs text-muted">
        {live
          ? "Live runs take 20–40 seconds while posts, commenters and profiles are fetched."
          : "This takes a few seconds."}
      </p>
    </div>
  );
}

function ResultColumn({
  title,
  subtitle,
  dot,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  dot: string;
  empty: React.ReactNode;
  children: React.ReactNode[];
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <span className={`h-2.5 w-2.5 self-center rounded-full ${dot}`} />
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      {children.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper/60 p-6 text-center text-sm text-muted">
          {empty}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

function CardShell({
  rank,
  name,
  score,
  badges,
  role,
  organization,
  location,
  url,
  id,
  copiedId,
  onCopy,
  indicators,
  summary,
  accent,
  details,
}: {
  rank: number;
  name: string;
  score: number;
  badges: React.ReactNode;
  role: string;
  organization: string;
  location: string | null;
  url: string;
  id: string;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
  indicators: string[];
  summary: React.ReactNode;
  accent: string;
  details: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = indicators.slice(0, 3);
  const knownOrg = organization && !/not (provided|shown)/i.test(organization);
  return (
    <article className="rounded-xl border border-line bg-paper p-4 transition hover:border-line-strong">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-bold tabular-nums ${accent}`}>#{rank}</span>
            <h3 className="text-[15px] font-bold text-ink">{name}</h3>
            {badges}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {role}
            {knownOrg && <span className="text-muted"> · {organization}</span>}
          </p>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3 w-3" />
              {location}
            </p>
          )}
        </div>
        <ScorePill score={score} />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-cream px-2.5 py-1.5">
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 flex-1 items-center gap-1 truncate font-mono text-[11px] text-brand hover:underline"
            >
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{url.replace("https://www.", "")}</span>
            </a>
            <button
              type="button"
              onClick={() => onCopy(id, url)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink"
              aria-label="Copy profile URL"
            >
              {copiedId === id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedId === id ? "Copied" : "Copy"}
            </button>
          </>
        ) : (
          <span className="text-[11px] text-muted">Profile URL not available from this source</span>
        )}
      </div>

      {shown.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {shown.map((tag) => (
            <span key={tag} className="rounded-md bg-cream-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
              {tag}
            </span>
          ))}
          {indicators.length > shown.length && (
            <span className="px-1 py-0.5 text-[11px] text-muted">+{indicators.length - shown.length}</span>
          )}
        </div>
      )}

      {summary && <div className="mt-2.5 text-xs leading-relaxed text-ink-soft">{summary}</div>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
        aria-expanded={open}
      >
        {open ? "Hide details" : "Why this score"}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3 space-y-3 border-t border-line pt-3">{details}</div>}
    </article>
  );
}

function SourceBadge({ dataSource, isTestData }: { dataSource: DataSourceMode; isTestData: boolean }) {
  if (isTestData) {
    return <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Test</span>;
  }
  if (dataSource === "supplied_url_manual") {
    return <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">Imported</span>;
  }
  return null;
}

function AiLine({ ai }: { ai?: AiClassification }) {
  if (!ai) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-ink-soft">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
      <span>
        <span className="font-semibold text-ink">Gemini: {ai.persona}</span> (fit {ai.fitScore}/100). {ai.rationale}
      </span>
    </p>
  );
}

function CommenterCard({
  c,
  rank,
  copiedId,
  onCopy,
}: {
  c: AnalyzedCommenter;
  rank: number;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  const firstComment = c.comments.find((m) => m.text)?.text;
  return (
    <CardShell
      rank={rank}
      name={c.name}
      score={c.relevanceScore}
      accent="text-teal-700"
      badges={
        <>
          <TierBadge tier={c.personaTier} />
          {c.commentCount > 1 && (
            <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 ring-1 ring-teal-200">
              {c.commentCount} comments
            </span>
          )}
          <SourceBadge dataSource={c.dataSource} isTestData={c.isTestData} />
        </>
      }
      role={c.currentRole}
      organization={c.organization}
      location={c.location}
      url={c.linkedinUrl}
      id={c.id}
      copiedId={copiedId}
      onCopy={onCopy}
      indicators={c.schoolEcosystemIndicators}
      summary={firstComment ? <p className="line-clamp-2 italic">“{firstComment}”</p> : null}
      details={
        <>
          <BreakdownBars breakdown={c.scoreBreakdown} />
          <AiLine ai={c.aiClassification} />
          <p className="text-xs leading-relaxed text-ink-soft">{c.relevanceExplanation}</p>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Commented on {c.associatedPostUrls.length} post{c.associatedPostUrls.length === 1 ? "" : "s"}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {c.comments.map((cm, i) => (
                <li key={`${cm.postId}-${i}`} className="rounded-lg bg-cream p-2 text-xs">
                  <a
                    href={cm.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-mono text-[11px] text-brand hover:underline"
                  >
                    {cm.postUrl.replace("https://www.", "")}
                  </a>
                  {cm.text && <p className="mt-0.5 text-ink-soft">“{cm.text}”</p>}
                </li>
              ))}
            </ul>
          </div>
        </>
      }
    />
  );
}

function LookalikeCard({
  l,
  rank,
  copiedId,
  onCopy,
}: {
  l: LookalikeProfile;
  rank: number;
  copiedId: string | null;
  onCopy: (id: string, url: string) => void;
}) {
  const top = l.seedProfiles[0];
  return (
    <CardShell
      rank={rank}
      name={l.name}
      score={l.relevanceScore}
      accent="text-violet-700"
      badges={
        <>
          <TierBadge tier={l.personaTier} />
          <SourceBadge dataSource={l.dataSource} isTestData={l.isTestData} />
        </>
      }
      role={l.currentRole}
      organization={l.organization}
      location={l.location}
      url={l.linkedinUrl}
      id={l.id}
      copiedId={copiedId}
      onCopy={onCopy}
      indicators={l.schoolEcosystemIndicators}
      summary={
        top ? (
          <p>
            <span className="font-semibold text-violet-700 tabular-nums">{l.similarityScore}% similar</span> to{" "}
            <span className="font-semibold text-ink">{top.seedCommenterName}</span>
            {l.seedProfiles.length > 1 && <span className="text-muted"> and {l.seedProfiles.length - 1} more</span>}
          </p>
        ) : null
      }
      details={
        <>
          <BreakdownBars breakdown={l.scoreBreakdown} isLookalike />
          <AiLine ai={l.aiClassification} />
          <p className="text-xs leading-relaxed text-ink-soft">{l.relevanceExplanation}</p>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Seed commenters</div>
            <ul className="mt-1.5 space-y-1 text-xs text-ink-soft">
              {l.seedProfiles.map((s) => (
                <li key={s.seedCommenterId}>
                  <span className="font-semibold text-ink">{s.seedCommenterName}</span>{" "}
                  <span className="font-semibold text-violet-700 tabular-nums">{s.similarityScore}%</span>: {s.rationale}
                </li>
              ))}
            </ul>
          </div>
          {l.discoveredVia && l.discoveredVia.provider !== "labelled_test_dataset" && (
            <p className="text-[11px] text-muted">
              Found via public profile search{" "}
              <code className="rounded bg-cream-2 px-1 font-mono text-ink-soft">{l.discoveredVia.query}</code>
            </p>
          )}
        </>
      }
    />
  );
}
