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
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";

const SAMPLE_TEST_POST_URL =
  "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001";

const PRESET_QUERIES = ["K12 B2B Sales", "School Trustees & Principals", "Retired Principals School Consultants"];

const PAGE_SIZE = 10;

type Tab = "commenters" | "lookalikes";

export function DiscoveryDashboard() {
  const [mode, setMode] = useState<SearchInputMode>("keyword");
  const [query, setQuery] = useState("K12 B2B Sales");
  const [postUrl, setPostUrl] = useState("");
  const [dataSourcePref, setDataSourcePref] = useState<DataSourceMode>("labelled_test_dataset");

  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("commenters");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [minScore, setMinScore] = useState(0);
  const [tierFilter, setTierFilter] = useState("all");
  const [textFilter, setTextFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showMethodology, setShowMethodology] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
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

  const applyResult = useCallback((data: DiscoveryResult) => {
    setResult(data);
    setShowDetails(data.warnings.length > 0);
    setVisible(PAGE_SIZE);
    setShowAllPosts(false);
    setTab(data.commenters.length > 0 || data.lookalikes.length === 0 ? "commenters" : "lookalikes");
  }, []);

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
        applyResult(data as DiscoveryResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run discovery");
      } finally {
        setLoading(false);
      }
    },
    [apiKeys, applyResult, dataSourcePref, manualCommentersRaw, mode, postUrl, query]
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
        if (active) applyResult(data);
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
  }, [applyResult]);

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

  const activeList = tab === "commenters" ? commenters : lookalikes;
  const totalForTab = tab === "commenters" ? (result?.commenters.length ?? 0) : (result?.lookalikes.length ?? 0);
  const filtersActive = minScore > 0 || tierFilter !== "all" || textFilter.trim() !== "";
  const posts = result ? (showAllPosts ? result.posts : result.posts.slice(0, 3)) : [];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/edxso-logo.png" alt="EDXSO" width={107} height={32} priority className="h-8 w-auto" />
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden text-sm font-semibold text-ink-soft sm:block">Prospect Discovery</span>
          </div>
          <nav className="flex items-center gap-1">
            <HeaderButton onClick={() => setShowMethodology(true)} label="How scoring works">
              <BookOpen className="h-4 w-4" />
            </HeaderButton>
            <HeaderButton onClick={() => setShowSettings(true)} label="Data sources">
              <Settings2 className="h-4 w-4" />
            </HeaderButton>
            <div className="relative ml-1" ref={exportRef}>
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
                  className="absolute right-0 mt-1.5 w-44 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-lg"
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

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {/* 1. Search */}
        <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Find school-network decision makers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Start from a phrase or a LinkedIn post. The tool finds who commented, ranks them for EDXSO outreach with AI,
            and discovers similar professionals, all with full LinkedIn profile links.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-cream-2 p-1" role="tablist" aria-label="Input mode">
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
            {mode === "keyword" && (
              <div className="inline-flex rounded-lg bg-cream-2 p-1" role="radiogroup" aria-label="Data source">
                {(
                  [
                    ["authorized_provider", "Live data"],
                    ["labelled_test_dataset", "Test data"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={dataSourcePref === value}
                    disabled={value === "authorized_provider" && !hasLiveSearchKey}
                    onClick={() => setDataSourcePref(value)}
                    className={`h-8 rounded-md px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      dataSourcePref === value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              ) : (
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              )}
              <input
                type={mode === "keyword" ? "text" : "url"}
                value={mode === "keyword" ? query : postUrl}
                onChange={(e) => (mode === "keyword" ? setQuery(e.target.value) : setPostUrl(e.target.value))}
                placeholder={
                  mode === "keyword" ? "e.g. K12 B2B Sales" : "linkedin.com/posts/... or lnkd.in/... link"
                }
                aria-label={mode === "keyword" ? "Search phrase" : "LinkedIn post URL"}
                className={`h-12 w-full rounded-xl border border-line-strong bg-white pl-11 pr-4 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                  mode === "keyword" ? "text-base" : "font-mono text-sm"
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-7 text-sm font-bold text-white shadow-sm transition hover:bg-brand-ink disabled:opacity-60"
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
        </section>

        {loading && <LoadingState live={isLiveRequest} hasResult={Boolean(result)} />}

        {result && (
          <>
            {/* 2. Run summary: the whole workflow as a funnel */}
            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-ink">Run summary</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      result.isTestData ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {result.isTestData ? "Test data" : "Live LinkedIn data"}
                  </span>
                  <span className="max-w-full truncate text-xs text-muted">
                    for “{result.queryOrUrl.length > 60 ? `${result.queryOrUrl.slice(0, 60)}…` : result.queryOrUrl}”
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
                  aria-expanded={showDetails}
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

              <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-0">
                <FunnelStep n={result.stats.postsFound} label="Posts found" sub={result.inputMode === "keyword" ? "recent & relevant" : "direct link"} />
                <FunnelStep n={result.stats.rawCommentsExtracted} label="Comments" sub="collected" />
                <FunnelStep
                  n={result.stats.uniqueCommenters}
                  label="Commenters"
                  sub={`${result.stats.deduplicatedDuplicatesRemoved} duplicates merged`}
                  tone="text-teal-700"
                />
                <FunnelStep n={result.stats.lookalikesDiscovered} label="Lookalikes" sub="AI-discovered" tone="text-violet-700" />
                <FunnelStep
                  n={overlapCount === 0 ? "✓" : overlapCount}
                  label="Kept separate"
                  sub={overlapCount === 0 ? "no commenter in lookalikes" : "overlaps found"}
                  tone={overlapCount === 0 ? "text-emerald-700" : "text-red-700"}
                  last
                />
              </ol>

              {result.isTestData && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  These records are a clearly labelled test dataset, not real LinkedIn data. Choose <b>Live data</b> to
                  run on real posts.
                </p>
              )}

              {showDetails && (
                <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-ink-soft">
                  <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
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
                  <p className="text-muted">
                    No LinkedIn login or scraping: posts and profiles come from a public search index, comments from a
                    licensed provider or your import.
                  </p>
                </div>
              )}
            </section>

            {/* 3. Source posts */}
            <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-bold text-ink">
                  Source posts <span className="font-medium text-muted tabular-nums">{result.posts.length}</span>
                </h2>
                {result.posts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPosts((v) => !v)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    {showAllPosts ? "Show fewer" : `Show all ${result.posts.length}`}
                  </button>
                )}
              </div>
              <ul className="mt-3 divide-y divide-line">
                {posts.map((post) => (
                  <li key={post.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-ink">{post.authorName}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {post.publishedAt ? post.publishedAt.slice(0, 10) : "Date n/a"} ·{" "}
                          {post.engagementStats.comments} comment{post.engagementStats.comments === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{post.snippet}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                      {result.inputMode === "keyword" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("post_url");
                            setPostUrl(post.url);
                            void executeDiscovery({ mode: "post_url", postUrl: post.url });
                          }}
                          className="font-semibold text-muted hover:text-ink"
                        >
                          Analyse this post
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 4. Ranked prospects */}
            <section className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
              <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex self-start rounded-lg bg-cream-2 p-1" role="tablist" aria-label="Prospect lists">
                  {(
                    [
                      ["commenters", "Commenters", result.commenters.length, "bg-teal-600"],
                      ["lookalikes", "Lookalikes", result.lookalikes.length, "bg-violet-600"],
                    ] as const
                  ).map(([value, label, count, dot]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      onClick={() => {
                        setTab(value);
                        setVisible(PAGE_SIZE);
                      }}
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
                        tab === value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {label}
                      <span className="text-xs font-medium text-muted tabular-nums">{count}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={textFilter}
                    onChange={(e) => {
                      setTextFilter(e.target.value);
                      setVisible(PAGE_SIZE);
                    }}
                    placeholder="Search name, org, city"
                    aria-label="Filter results"
                    className="h-9 w-44 rounded-lg border border-line-strong bg-white px-3 text-xs focus:border-brand focus:outline-none"
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
                  <select
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    aria-label="Minimum score"
                    className="h-9 rounded-lg border border-line-strong bg-white px-2 text-xs text-ink focus:border-brand focus:outline-none"
                  >
                    <option value={0}>Any score</option>
                    <option value={40}>Score 40+</option>
                    <option value={60}>Score 60+</option>
                    <option value={80}>Score 80+</option>
                  </select>
                </div>
              </div>

              <p className="border-b border-line bg-cream/60 px-4 py-2 text-xs text-muted sm:px-5">
                {tab === "commenters"
                  ? "People who commented on the source posts, ranked by fit for EDXSO school-network outreach."
                  : "Similar professionals discovered from the commenters. Each one shows which commenter it was matched to."}
                {filtersActive && ` Showing ${activeList.length} of ${totalForTab}.`}
              </p>

              {activeList.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">
                  {totalForTab === 0 && tab === "commenters" ? (
                    <>
                      No commenters for this run.{" "}
                      <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="font-semibold text-brand hover:underline"
                      >
                        Add an Apify token or import commenters
                      </button>
                      , then run again.
                    </>
                  ) : totalForTab === 0 ? (
                    "Lookalikes need at least one commenter to use as a seed."
                  ) : (
                    "No results match these filters."
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {tab === "commenters"
                    ? commenters
                        .slice(0, visible)
                        .map((c, i) => (
                          <CommenterRow key={c.id} c={c} rank={i + 1} copiedId={copiedId} onCopy={handleCopy} />
                        ))
                    : lookalikes
                        .slice(0, visible)
                        .map((l, i) => (
                          <LookalikeRow key={l.id} l={l} rank={i + 1} copiedId={copiedId} onCopy={handleCopy} />
                        ))}
                </ul>
              )}

              {activeList.length > visible && (
                <div className="border-t border-line p-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
                  >
                    Show {Math.min(PAGE_SIZE, activeList.length - visible)} more ({activeList.length - visible} left)
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        EDXSO Prospect Discovery · Built with public search, a licensed comments provider and Gemini AI. No LinkedIn
        login or scraping.
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

/* ---------- Building blocks ---------- */

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

function FunnelStep({
  n,
  label,
  sub,
  tone = "text-ink",
  last = false,
}: {
  n: number | string;
  label: string;
  sub: string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <li className="relative rounded-xl bg-cream px-4 py-3 sm:rounded-none sm:bg-transparent sm:px-3 sm:py-0 sm:text-center">
      <div className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${tone}`}>{n}</div>
      <div className="text-xs font-semibold text-ink">{label}</div>
      <div className="text-[11px] text-muted">{sub}</div>
      {!last && (
        <ArrowRight
          className="absolute right-0 top-3 hidden h-4 w-4 translate-x-1/2 text-line-strong sm:block"
          aria-hidden
        />
      )}
    </li>
  );
}

function LoadingState({ live, hasResult }: { live: boolean; hasResult: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper/70 text-center ${
        hasResult ? "py-4" : "py-14"
      }`}
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
      <div className="text-left">
        <p className="text-sm font-semibold text-ink">Running discovery…</p>
        <p className="text-xs text-muted">
          {live ? "Live runs take 15–40 seconds: posts, commenters, lookalikes, then AI ranking." : "A few seconds."}
        </p>
      </div>
    </div>
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

/** One compact ranked row; details expand inline. */
function ProspectRow({
  rank,
  rankTone,
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
  secondary,
  indicators,
  details,
}: {
  rank: number;
  rankTone: string;
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
  secondary: React.ReactNode;
  indicators: string[];
  details: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const knownOrg = organization && !/not (provided|shown)/i.test(organization);
  const meta = [knownOrg ? organization : null, location].filter(Boolean).join(" · ");
  return (
    <li className={`transition ${open ? "bg-cream/60" : "hover:bg-cream/40"}`}>
      <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <span className={`w-6 shrink-0 pt-3 text-right text-xs font-bold tabular-nums ${rankTone}`}>{rank}</span>
        <ScorePill score={score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[15px] font-bold text-ink">{name}</h3>
            {badges}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{role}</p>
          {meta && <p className="line-clamp-1 text-xs text-muted">{meta}</p>}
          {secondary && <div className="mt-1.5 text-xs text-ink-soft">{secondary}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {url ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[11px] text-brand hover:underline"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{url.replace("https://www.", "")}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(id, url)}
                  className="shrink-0 text-muted hover:text-ink"
                  aria-label="Copy profile URL"
                  title="Copy profile URL"
                >
                  {copiedId === id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </span>
            ) : (
              <span className="text-[11px] text-muted">Profile URL not available from this source</span>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted hover:text-ink"
              aria-expanded={open}
            >
              {open ? "Hide details" : "Why this score"}
              <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
          {open && (
            <div className="mt-3 space-y-3 rounded-xl border border-line bg-paper p-4">
              {indicators.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {indicators.map((tag) => (
                    <span key={tag} className="rounded-md bg-cream-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {details}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CommenterRow({
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
    <ProspectRow
      rank={rank}
      rankTone="text-teal-700"
      name={c.name}
      score={c.relevanceScore}
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
      secondary={firstComment ? <p className="line-clamp-1 italic text-muted">“{firstComment}”</p> : null}
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

function LookalikeRow({
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
    <ProspectRow
      rank={rank}
      rankTone="text-violet-700"
      name={l.name}
      score={l.relevanceScore}
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
      secondary={
        top ? (
          <p>
            <span className="font-semibold text-violet-700 tabular-nums">{l.similarityScore}% similar</span> to commenter{" "}
            <span className="font-semibold text-ink">{top.seedCommenterName}</span>
            {l.seedProfiles.length > 1 && <span className="text-muted"> +{l.seedProfiles.length - 1} more</span>}
          </p>
        ) : null
      }
      details={
        <>
          <BreakdownBars breakdown={l.scoreBreakdown} isLookalike />
          <AiLine ai={l.aiClassification} />
          <p className="text-xs leading-relaxed text-ink-soft">{l.relevanceExplanation}</p>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Matched to commenters</div>
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
