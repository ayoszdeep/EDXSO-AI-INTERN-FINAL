import {
  CandidateProfileRecord,
  DiscoveryProvenance,
  LinkedInPost,
} from "@/lib/types";
import {
  activityIdToDate,
  canonicalizeLinkedInUrl,
  cleanLinkedInUrl,
  decodeHtmlText,
  extractActivityId,
  extractPostAuthorHandle,
  inferTopicsFromPostUrl,
  isValidLinkedInPostUrl,
  isValidLinkedInProfileUrl,
  splitHeadline,
} from "@/lib/data/linkedin-urls";
import { TtlCache } from "@/lib/data/providers/cache";

/**
 * Authorized public web-search index (Serper.dev Google SERP API or Tavily).
 * We only read what the search engine has already indexed publicly: titles,
 * URLs and snippets. LinkedIn itself is never fetched or scraped.
 */

export interface SearchKeys {
  serperApiKey?: string;
  tavilyApiKey?: string;
}

export interface SearchHit {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

const searchCache = new TtlCache<SearchHit[]>(30 * 60 * 1000);

export function resolveSearchKeys(keys?: SearchKeys): SearchKeys {
  return {
    serperApiKey: keys?.serperApiKey?.trim() || process.env.SERPER_API_KEY?.trim() || undefined,
    tavilyApiKey: keys?.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY?.trim() || undefined,
  };
}

export function hasSearchKey(keys: SearchKeys): boolean {
  return Boolean(keys.serperApiKey || keys.tavilyApiKey);
}

export function searchProviderName(keys: SearchKeys): "serper" | "tavily" {
  return keys.serperApiKey ? "serper" : "tavily";
}

export async function webSearch(
  query: string,
  keys: SearchKeys,
  opts: { num?: number; recency?: "day" | "week" | "month" | "year" } = {}
): Promise<SearchHit[]> {
  const num = Math.min(Math.max(opts.num ?? 10, 1), 20);
  const cacheKey = `${searchProviderName(keys)}|${query}|${num}|${opts.recency ?? ""}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  let hits: SearchHit[];
  if (keys.serperApiKey) {
    const tbs = opts.recency
      ? { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" }[opts.recency]
      : undefined;
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": keys.serperApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num, ...(tbs ? { tbs } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "Serper rejected the API key (check SERPER_API_KEY)."
          : `Serper search failed with status ${response.status}.`
      );
    }
    const data = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
    };
    hits = (data.organic ?? [])
      .filter((o) => o.link)
      .map((o) => ({ title: o.title ?? "", link: o.link!, snippet: o.snippet ?? "", date: o.date }));
  } else if (keys.tavilyApiKey) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.tavilyApiKey}` },
      body: JSON.stringify({
        query,
        max_results: num,
        search_depth: "basic",
        include_domains: ["linkedin.com"],
        ...(opts.recency ? { time_range: opts.recency } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Tavily search failed with status ${response.status}.`);
    }
    const data = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
    };
    hits = (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? "", link: r.url!, snippet: r.content ?? "", date: r.published_date }));
  } else {
    throw new Error("No search provider key configured (SERPER_API_KEY or TAVILY_API_KEY).");
  }

  searchCache.set(cacheKey, hits);
  return hits;
}

/** "3 weeks ago" / "Mar 4, 2026" -> ISO string, or null when unparseable. */
export function parseSearchDate(raw?: string): string | null {
  if (!raw) return null;
  const rel = raw.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (rel) {
    const n = Number(rel[1]);
    const unitMs: Record<string, number> = {
      minute: 60e3,
      hour: 3600e3,
      day: 86400e3,
      week: 7 * 86400e3,
      month: 30 * 86400e3,
      year: 365 * 86400e3,
    };
    return new Date(Date.now() - n * unitMs[rel[2].toLowerCase()]).toISOString();
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Pulls the author's display name out of the search-result title. LinkedIn
 * post titles appear as either:
 *   "Jane Doe on LinkedIn: K12 sales is a relationship business..."
 *   "K12 sales is a relationship business... | Jane Doe | 12 comments"
 *   "Jane Doe's Post - LinkedIn"
 */
export function parsePostAuthorFromTitle(title: string): string | null {
  const t = title.replace(/\s+/g, " ").trim();
  const postedOn = t.match(/(?:^|\|\s*)([^|]{2,80}?)\s+posted on\b/i);
  if (postedOn) return postedOn[1].trim();
  const onLinkedIn = t.match(/^(.{2,80}?) on LinkedIn\s*[:|-]/i);
  if (onLinkedIn) return onLinkedIn[1].trim();
  const possessive = t.match(/^(.{2,80}?)['’]s Post\b/i);
  if (possessive) return possessive[1].trim();
  const pipes = t.split(" | ").map((s) => s.trim());
  if (pipes.length >= 2) {
    const candidate = pipes.find(
      (seg, idx) => idx > 0 && !/linkedin|comments?$|reactions?$/i.test(seg) && seg.split(" ").length <= 6
    );
    if (candidate) return candidate.replace(/ posted on the topic.*$/i, "").trim();
  }
  return null;
}

function stripTitleNoise(title: string): string {
  return title
    .replace(/^.{2,80}? on LinkedIn\s*[:|-]\s*/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .replace(/\s*\|\s*\d+\s+comments?\s*$/i, "")
    .replace(/[“”"]/g, "")
    .trim();
}

export function searchHitToPost(hit: SearchHit, idx: number, provider: string): LinkedInPost {
  const activityId = extractActivityId(hit.link);
  const handle = extractPostAuthorHandle(hit.link);
  const author = parsePostAuthorFromTitle(hit.title) ?? (handle ? `@${handle}` : "Author not shown in index");
  const decodedDate = activityIdToDate(activityId);
  const body = stripTitleNoise(hit.title);
  const snippet = (hit.snippet || body).replace(/\s+/g, " ").trim();
  return {
    id: activityId ? `post-${activityId}` : `${provider}-post-${idx + 1}`,
    url: cleanLinkedInUrl(hit.link),
    canonicalUrl: canonicalizeLinkedInUrl(hit.link),
    authorName: author,
    authorRole: handle ? `linkedin.com/posts/${handle}` : "Public LinkedIn post",
    authorProfileUrl: "",
    publishedAt: decodedDate ?? parseSearchDate(hit.date) ?? "",
    snippet: snippet.length > 280 ? `${snippet.slice(0, 277)}...` : snippet,
    fullText: `${body}. ${hit.snippet}`.trim(),
    topics: inferTopicsFromPostUrl(hit.link),
    engagementStats: { reactions: 0, comments: 0 },
    relevanceToQuery: Number(Math.max(0.5, 0.95 - idx * 0.06).toFixed(3)),
    dataSource: "authorized_provider",
    isTestData: false,
  };
}

/**
 * Finds recent public LinkedIn posts for a phrase. Tries the past month first
 * (recency requirement), widening to the past year and then all-time only when
 * fewer than `maxPosts` posts are indexed.
 */
export async function discoverLinkedInPosts(
  query: string,
  keys: SearchKeys,
  maxPosts: number
): Promise<LinkedInPost[]> {
  const provider = searchProviderName(keys);
  const collected = new Map<string, SearchHit>();
  for (const recency of ["month", "year", undefined] as const) {
    const hits = await webSearch(`site:linkedin.com/posts ${query}`, keys, { num: 10, recency });
    for (const hit of hits) {
      if (!isValidLinkedInPostUrl(hit.link)) continue;
      const key = extractActivityId(hit.link) ?? canonicalizeLinkedInUrl(hit.link);
      if (!collected.has(key)) collected.set(key, hit);
    }
    if (collected.size >= maxPosts) break;
  }
  const posts = Array.from(collected.values()).map((hit, idx) => searchHitToPost(hit, idx, provider));
  // Same author handle seen with a real display name on another post -> reuse that name
  const nameByHandle = new Map<string, string>();
  for (const p of posts) {
    const handle = extractPostAuthorHandle(p.url);
    if (handle && !p.authorName.startsWith("@")) nameByHandle.set(handle, p.authorName);
  }
  for (const p of posts) {
    const handle = extractPostAuthorHandle(p.url);
    if (handle && p.authorName.startsWith("@") && nameByHandle.has(handle)) p.authorName = nameByHandle.get(handle)!;
  }
  // Newest first among the most relevant results
  return posts
    .slice(0, Math.max(maxPosts, 8))
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, maxPosts)
    .map((p, idx) => ({ ...p, relevanceToQuery: Number(Math.max(0.5, 0.95 - idx * 0.05).toFixed(3)) }));
}

/**
 * Looks up metadata (author, snippet) for a user-supplied post URL from the
 * public search index. Returns null when the post is not indexed.
 */
export async function lookupPostInIndex(postUrl: string, keys: SearchKeys): Promise<LinkedInPost | null> {
  const activityId = extractActivityId(postUrl);
  const topics = inferTopicsFromPostUrl(postUrl);
  const queries = [
    activityId ? `site:linkedin.com "${activityId}"` : null,
    topics.length > 0 ? `site:linkedin.com/posts ${topics.join(" ")}` : null,
  ].filter((q): q is string => Boolean(q));

  for (const q of queries) {
    const hits = await webSearch(q, keys, { num: 10 });
    const match = hits.find((h) =>
      activityId
        ? extractActivityId(h.link) === activityId
        : canonicalizeLinkedInUrl(h.link) === canonicalizeLinkedInUrl(postUrl)
    );
    if (match) return searchHitToPost(match, 0, searchProviderName(keys));
  }
  return null;
}

/**
 * Parses a public profile search hit, e.g.
 *   title:   "Anita Rao - Former Principal - Delhi Public School | LinkedIn"
 *   snippet: "Former Principal · Experience: Delhi Public School · Location: Pune · 500+ connections"
 * Returns null for non-profile URLs. Unknown fields stay empty.
 */
export function parseProfileHit(
  hit: SearchHit,
  provenance: DiscoveryProvenance
): CandidateProfileRecord | null {
  if (!isValidLinkedInProfileUrl(hit.link)) return null;
  const title = decodeHtmlText(hit.title.replace(/\s*\|\s*LinkedIn.*$/i, ""));
  const parts = title.split(/\s[-–—]\s/).map((p) => p.trim()).filter(Boolean);
  const name = parts[0] ?? "";
  if (!name || name.length > 80 || /linkedin/i.test(name)) return null;

  const snippet = decodeHtmlText(hit.snippet);
  const experience = snippet.match(/Experience:\s*([^·|]+)/i)?.[1]?.trim() ?? "";
  const location = snippet.match(/Location:\s*([^·|]+)/i)?.[1]?.trim() ?? null;
  const trimDots = (v: string) => v.replace(/\s*(\.{3}|…)\s*$/, "").trim();
  let role = trimDots(parts[1] ?? "");
  let organization = trimDots(parts[2] ?? experience);
  if (!parts[2]) {
    // "Independent School Consultant at The Education Group" packed into one segment
    const split = splitHeadline(role);
    if (split.organization) {
      role = split.role;
      organization = organization || split.organization;
    }
  }
  const headline = trimDots(parts.slice(1).join(" - "));

  return {
    id: `cand-${canonicalizeLinkedInUrl(hit.link).split("/in/")[1]}`,
    name,
    linkedinUrl: cleanLinkedInUrl(hit.link),
    headline: headline || role,
    currentRole: role || "Role not shown in index",
    organization: organization || "Organization not shown in index",
    location,
    experienceSummary: snippet,
    skills: [],
    schoolNetworkSignals: [],
    recentTopics: [],
    discoveredVia: provenance,
    dataSource: "authorized_provider",
    isTestData: false,
  };
}

export async function searchLinkedInProfiles(
  queries: Array<{ query: string; seedIds: string[]; seedNames: string[] }>,
  keys: SearchKeys
): Promise<CandidateProfileRecord[]> {
  const provider = searchProviderName(keys);
  const byUrl = new Map<string, CandidateProfileRecord>();
  const settled = await Promise.allSettled(
    queries.map(async (q) => ({ q, hits: await webSearch(q.query, keys, { num: 10 }) }))
  );
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    const { q, hits } = res.value;
    for (const hit of hits) {
      const cand = parseProfileHit(hit, {
        provider,
        query: q.query,
        seedCommenterIds: q.seedIds,
        seedCommenterNames: q.seedNames,
      });
      if (!cand) continue;
      const key = canonicalizeLinkedInUrl(cand.linkedinUrl);
      const existing = byUrl.get(key);
      if (existing?.discoveredVia) {
        // Same person surfaced by several seed queries: merge seed provenance
        existing.discoveredVia.seedCommenterIds = Array.from(
          new Set([...existing.discoveredVia.seedCommenterIds, ...q.seedIds])
        );
        existing.discoveredVia.seedCommenterNames = Array.from(
          new Set([...existing.discoveredVia.seedCommenterNames, ...q.seedNames])
        );
      } else {
        byUrl.set(key, cand);
      }
    }
  }
  if (byUrl.size === 0 && settled.every((s) => s.status === "rejected")) {
    const first = settled[0] as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error ? first.reason : new Error("Profile search failed.");
  }
  return Array.from(byUrl.values());
}
