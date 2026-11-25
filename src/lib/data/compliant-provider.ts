import {
  CandidateProfileRecord,
  DataSourceMode,
  DiscoveryRequest,
  LinkedInPost,
  RawCommentRecord,
} from "@/lib/types";
import {
  TEST_CANDIDATE_POOL,
  TEST_DATASET_NOTICE,
  TEST_LINKEDIN_POSTS,
  TEST_RAW_COMMENTS,
} from "@/lib/data/labelled-test-dataset";
import { computeTextSimilarity } from "@/lib/engine/semantic";

/**
 * Normalizes a LinkedIn URL so trailing slashes, protocol differences,
 * subdomains (`in.linkedin.com` -> `www.linkedin.com`), and tracking query
 * parameters (`?utm_source=...`, `?trk=...`) never prevent deduplication.
 */
export function canonicalizeLinkedInUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase().endsWith("linkedin.com")
      ? "www.linkedin.com"
      : parsed.hostname.toLowerCase();
    const cleanPath = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `https://${host}${cleanPath}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export function isValidLinkedInPostUrl(rawUrl: string): boolean {
  const canonical = canonicalizeLinkedInUrl(rawUrl);
  return (
    canonical.startsWith("https://www.linkedin.com/posts/") ||
    canonical.startsWith("https://www.linkedin.com/feed/update/") ||
    canonical.startsWith("https://www.linkedin.com/pulse/")
  );
}

export function isValidLinkedInProfileUrl(rawUrl: string): boolean {
  const canonical = canonicalizeLinkedInUrl(rawUrl);
  return canonical.startsWith("https://www.linkedin.com/in/");
}

function inferTopicsFromPostUrl(url: string): string[] {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname
      .replace(/^\/posts\//i, "")
      .replace(/activity-\d+.*/i, "");
    const words = slug
      .split(/[-_/]+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w));
    return Array.from(new Set(words)).slice(0, 6);
  } catch {
    return ["LinkedIn Post"];
  }
}

async function fetchPostsFromSerper(
  query: string,
  apiKey: string,
  maxPosts: number
): Promise<LinkedInPost[]> {
  const searchQuery = `site:linkedin.com/posts ${query}`;
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: searchQuery, num: Math.min(maxPosts + 3, 10) }),
  });

  if (!response.ok) {
    throw new Error(`Serper API returned status ${response.status}`);
  }

  const data = (await response.json()) as {
    organic?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      date?: string;
    }>;
  };

  const results = (data.organic ?? [])
    .filter((item) => item.link && isValidLinkedInPostUrl(item.link))
    .slice(0, maxPosts);

  return results.map((item, idx) => {
    const link = item.link!;
    const title = item.title ?? "LinkedIn Post";
    const authorGuess = title.split(" on LinkedIn")[0]?.split(" - ")[0] || "LinkedIn Author";
    return {
      id: `serper-post-${idx + 1}`,
      url: link,
      canonicalUrl: canonicalizeLinkedInUrl(link),
      authorName: authorGuess,
      authorRole: "Public LinkedIn Author (via Search Index)",
      authorProfileUrl: "",
      publishedAt: item.date || new Date().toISOString(),
      snippet: item.snippet ?? title,
      fullText: `${title}. ${item.snippet ?? ""}`.trim(),
      topics: inferTopicsFromPostUrl(link),
      engagementStats: { reactions: 0, comments: 0 },
      relevanceToQuery: Math.max(0.6, 0.95 - idx * 0.05),
      dataSource: "authorized_provider",
      isTestData: false,
    };
  });
}

async function fetchPostsFromTavily(
  query: string,
  apiKey: string,
  maxPosts: number
): Promise<LinkedInPost[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: `site:linkedin.com/posts ${query}`,
      max_results: Math.min(maxPosts + 3, 10),
      search_depth: "basic",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API returned status ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };

  const results = (data.results ?? [])
    .filter((item) => item.url && isValidLinkedInPostUrl(item.url))
    .slice(0, maxPosts);

  return results.map((item, idx) => {
    const link = item.url!;
    const title = item.title ?? "LinkedIn Post";
    const authorGuess = title.split(" on LinkedIn")[0]?.split(" - ")[0] || "LinkedIn Author";
    return {
      id: `tavily-post-${idx + 1}`,
      url: link,
      canonicalUrl: canonicalizeLinkedInUrl(link),
      authorName: authorGuess,
      authorRole: "Public LinkedIn Author (via Tavily Index)",
      authorProfileUrl: "",
      publishedAt: item.published_date || new Date().toISOString(),
      snippet: item.content?.slice(0, 220) ?? title,
      fullText: `${title}. ${item.content ?? ""}`.trim(),
      topics: inferTopicsFromPostUrl(link),
      engagementStats: { reactions: 0, comments: 0 },
      relevanceToQuery: Math.max(0.6, 0.95 - idx * 0.05),
      dataSource: "authorized_provider",
      isTestData: false,
    };
  });
}

export interface RetrievedSourceBundle {
  posts: LinkedInPost[];
  rawComments: RawCommentRecord[];
  candidatePool: CandidateProfileRecord[];
  dataSource: DataSourceMode;
  isTestData: boolean;
  complianceNotice: string;
}

/**
 * Compliant Data Retrieval Orchestrator:
 * 1. Authorized Search Provider (Serper / Tavily) when configured and requested.
 * 2. User-Supplied Post URL & Engagement Import (`supplied_url_manual`).
 * 3. Clearly Labelled Test Dataset (`labelled_test_dataset`) as transparent evaluation baseline.
 *
 * Never attempts unauthorized scraping or auth/CAPTCHA bypassing on LinkedIn.
 */
export async function retrieveCompliantData(
  request: DiscoveryRequest
): Promise<RetrievedSourceBundle> {
  const maxPosts = Math.min(Math.max(request.maxPosts ?? 5, 1), 10);

  const serperKey =
    request.apiKeys?.serperApiKey?.trim() || process.env.SERPER_API_KEY?.trim();
  const tavilyKey =
    request.apiKeys?.tavilyApiKey?.trim() || process.env.TAVILY_API_KEY?.trim();

  // Mode B: Direct Post URL supplied by the user
  if (request.mode === "post_url") {
    const suppliedUrl = (request.postUrl || request.manualInput?.postUrl || "").trim();
    if (!suppliedUrl || !isValidLinkedInPostUrl(suppliedUrl)) {
      throw new Error(
        "Please supply a valid LinkedIn post URL (e.g., https://www.linkedin.com/posts/... or https://www.linkedin.com/feed/update/...)."
      );
    }

    const canonicalSupplied = canonicalizeLinkedInUrl(suppliedUrl);

    // Check if the user supplied one of the clearly labelled test-dataset post URLs
    const matchedTestPost = TEST_LINKEDIN_POSTS.find(
      (p) => p.canonicalUrl === canonicalSupplied
    );

    // Check if user also provided manual/exported commenters
    const manualCommenters = request.manualInput?.commenters ?? [];

    if (matchedTestPost && manualCommenters.length === 0 && request.dataSource !== "supplied_url_manual") {
      const postComments = TEST_RAW_COMMENTS.filter(
        (c) => c.postId === matchedTestPost.id
      );
      return {
        posts: [{ ...matchedTestPost, relevanceToQuery: 1 }],
        rawComments: postComments,
        candidatePool: TEST_CANDIDATE_POOL,
        dataSource: "labelled_test_dataset",
        isTestData: true,
        complianceNotice: `${TEST_DATASET_NOTICE} (Matched test fixture post URL directly.)`,
      };
    }

    // User supplied a real or custom LinkedIn post URL + optional exported engagement
    const customPost: LinkedInPost = {
      id: "supplied-post-1",
      url: suppliedUrl,
      canonicalUrl: canonicalSupplied,
      authorName:
        request.manualInput?.postAuthorName?.trim() ||
        "User-Supplied Post Author",
      authorRole:
        request.manualInput?.postAuthorRole?.trim() ||
        "Provided via Direct Post URL",
      authorProfileUrl:
        request.manualInput?.postAuthorProfileUrl?.trim() || "",
      publishedAt:
        request.manualInput?.postDate?.trim() || new Date().toISOString(),
      snippet:
        request.manualInput?.postSnippet?.trim() ||
        `User-supplied LinkedIn post (${inferTopicsFromPostUrl(suppliedUrl).join(", ") || "direct URL"}).`,
      fullText:
        request.manualInput?.postSnippet?.trim() ||
        `Direct LinkedIn post URL submitted for analysis: ${suppliedUrl}`,
      topics: inferTopicsFromPostUrl(suppliedUrl),
      engagementStats: {
        reactions: 0,
        comments: manualCommenters.length,
      },
      relevanceToQuery: 1,
      dataSource: "supplied_url_manual",
      isTestData: false,
    };

    const rawComments: RawCommentRecord[] = manualCommenters
      .filter((c) => c.name?.trim() && c.linkedinUrl?.trim())
      .map((c, idx) => ({
        commentId: `manual-cmt-${idx + 1}`,
        postId: customPost.id,
        postUrl: customPost.url,
        authorName: c.name.trim(),
        authorProfileUrl: c.linkedinUrl.trim(),
        headline: [c.currentRole, c.organization].filter(Boolean).join(" at ") || "LinkedIn Member",
        currentRole: c.currentRole?.trim() || "Role not specified",
        organization: c.organization?.trim() || "Organization not specified",
        location: c.location?.trim() || null,
        commentText:
          c.commentText?.trim() || "Engaged on user-supplied LinkedIn post.",
        commentedAt: customPost.publishedAt,
        experienceSummary: c.headline?.trim() || `${c.currentRole ?? ""} ${c.organization ?? ""}`.trim(),
        skills: [],
        schoolNetworkSignals: [],
        dataSource: "supplied_url_manual",
        isTestData: false,
      }));

    return {
      posts: [customPost],
      rawComments,
      // Lookalike candidate pool uses the labelled test directory unless an authorized provider returns candidates,
      // and we keep each record's `isTestData` / `dataSource` flag intact!
      candidatePool: TEST_CANDIDATE_POOL,
      dataSource: "supplied_url_manual",
      isTestData: rawComments.length === 0,
      complianceNotice:
        rawComments.length > 0
          ? "Processed user-supplied LinkedIn post URL and user-imported commenter records compliantly (no unauthorized scraping). Lookalike candidates are matched from the clearly labelled evaluation candidate directory."
          : "Processed user-supplied LinkedIn post URL without unauthorized scraping. LinkedIn blocks unauthenticated comment retrieval; paste or import commenter records (CSV/JSON) in the Manual Engagement panel to analyze and seed lookalikes from this post.",
    };
  }

  // Mode A: Keyword Search
  const query = (request.query || "K12 B2B Sales").trim();

  if (request.dataSource === "authorized_provider" && (serperKey || tavilyKey)) {
    const posts = serperKey
      ? await fetchPostsFromSerper(query, serperKey, maxPosts)
      : await fetchPostsFromTavily(query, tavilyKey!, maxPosts);

    return {
      posts,
      rawComments: [],
      candidatePool: TEST_CANDIDATE_POOL,
      dataSource: "authorized_provider",
      isTestData: false,
      complianceNotice:
        "Posts retrieved via authorized public search index API (Serper/Tavily). Because LinkedIn restricts unauthenticated comment extraction, import post commenters via the Manual Engagement Import drawer or switch to Clearly Labelled Test Dataset mode for full end-to-end demo data.",
    };
  }

  // Clearly Labelled Test Dataset Mode (Default evaluation workflow)
  const rankedPosts = TEST_LINKEDIN_POSTS.map((post) => {
    const postCorpus = `${post.snippet} ${post.fullText} ${post.topics.join(" ")} ${post.authorRole}`;
    const sim = computeTextSimilarity(query, postCorpus);
    // Blend semantic query similarity with recency & curated relevance
    const combinedScore = Math.min(
      0.99,
      Math.max(0.15, sim * 0.65 + post.relevanceToQuery * 0.35)
    );
    return {
      ...post,
      relevanceToQuery: Number(combinedScore.toFixed(3)),
    };
  })
    .sort((a, b) => {
      if (Math.abs(b.relevanceToQuery - a.relevanceToQuery) > 0.08) {
        return b.relevanceToQuery - a.relevanceToQuery;
      }
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    })
    .slice(0, maxPosts);

  const selectedIds = new Set(rankedPosts.map((p) => p.id));
  const rawComments = TEST_RAW_COMMENTS.filter((c) =>
    selectedIds.has(c.postId)
  );

  return {
    posts: rankedPosts,
    rawComments,
    candidatePool: TEST_CANDIDATE_POOL,
    dataSource: "labelled_test_dataset",
    isTestData: true,
    complianceNotice: TEST_DATASET_NOTICE,
  };
}
