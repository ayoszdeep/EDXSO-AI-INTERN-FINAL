import {
  CandidateProfileRecord,
  DataSourceMode,
  DiscoveryRequest,
  ImportedCommenter,
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
import {
  activityIdToDate,
  canonicalizeLinkedInUrl,
  cleanLinkedInUrl,
  expandLinkedInShortLink,
  extractActivityId,
  extractPostAuthorHandle,
  inferTopicsFromPostUrl,
  isLinkedInShortLink,
  isValidLinkedInPostUrl,
} from "@/lib/data/linkedin-urls";
import {
  discoverLinkedInPosts,
  hasSearchKey,
  lookupPostInIndex,
  resolveSearchKeys,
  searchProviderName,
  SearchKeys,
} from "@/lib/data/providers/web-search";
import { fetchCommentsFromApify, resolveApifyToken } from "@/lib/data/providers/apify";

// Re-exported so existing imports keep working
export {
  canonicalizeLinkedInUrl,
  cleanLinkedInUrl,
  isValidLinkedInPostUrl,
  isValidLinkedInProfileUrl,
} from "@/lib/data/linkedin-urls";

export interface RetrievedSourceBundle {
  posts: LinkedInPost[];
  rawComments: RawCommentRecord[];
  /** Only set for the labelled test dataset; live runs source lookalikes from search after seeds are known. */
  testCandidatePool: CandidateProfileRecord[] | null;
  searchKeys: SearchKeys;
  dataSource: DataSourceMode;
  isTestData: boolean;
  complianceNotice: string;
  warnings: string[];
  providers: { posts: string; comments: string };
}

/**
 * Compliant data retrieval:
 * 1. Labelled test dataset (explicit, or automatic when no live provider is configured).
 * 2. Live: public search index (Serper/Tavily) for posts, a licensed comments provider
 *    (Apify) when configured, and user-imported commenter exports.
 *
 * Never logs into LinkedIn, handles LinkedIn cookies, or fetches LinkedIn pages.
 */
export async function retrieveCompliantData(request: DiscoveryRequest): Promise<RetrievedSourceBundle> {
  const maxPosts = Math.min(Math.max(request.maxPosts ?? 5, 1), 10);
  const searchKeys = resolveSearchKeys(request.apiKeys);
  const apifyToken = resolveApifyToken(request.apiKeys?.apifyApiToken);
  const imported = (request.manualInput?.commenters ?? []).filter((c) => c.name?.trim());

  if (request.mode === "post_url") {
    return retrieveForPostUrl(request, searchKeys, apifyToken, imported);
  }

  const query = (request.query || "K12 B2B Sales").trim();
  const wantsTest =
    request.dataSource === "labelled_test_dataset" ||
    (request.dataSource === undefined && !hasSearchKey(searchKeys));

  if (wantsTest) return testDatasetForQuery(query, maxPosts);

  if (!hasSearchKey(searchKeys)) {
    throw new Error(
      "Live keyword search needs a search index key. Set SERPER_API_KEY (or TAVILY_API_KEY) on the server, add one under Providers & Import, or switch to the labelled test dataset."
    );
  }

  const warnings: string[] = [];
  const posts = await discoverLinkedInPosts(query, searchKeys, maxPosts);
  if (posts.length === 0) {
    throw new Error(`The public search index returned no LinkedIn posts for "${query}". Try a broader phrase.`);
  }
  if (posts.length < maxPosts) {
    warnings.push(`Only ${posts.length} public LinkedIn post(s) are indexed for "${query}".`);
  }

  const { comments, commentsProvider } = await gatherComments({
    posts,
    apifyToken,
    imported,
    warnings,
    singlePost: false,
  });

  return {
    posts: withCommentCounts(posts, comments),
    rawComments: comments,
    testCandidatePool: null,
    searchKeys,
    dataSource: "authorized_provider",
    isTestData: false,
    complianceNotice: liveNotice(searchProviderName(searchKeys), commentsProvider),
    warnings,
    providers: { posts: `${searchProviderName(searchKeys)} public search index`, comments: commentsProvider },
  };
}

async function retrieveForPostUrl(
  request: DiscoveryRequest,
  searchKeys: SearchKeys,
  apifyToken: string | undefined,
  imported: ImportedCommenter[]
): Promise<RetrievedSourceBundle> {
  let suppliedUrl = (request.postUrl || request.manualInput?.postUrl || "").trim();
  if (suppliedUrl && isLinkedInShortLink(suppliedUrl)) {
    const expanded = await expandLinkedInShortLink(suppliedUrl).catch(() => null);
    if (!expanded) {
      throw new Error("Could not expand this lnkd.in short link. Open it in your browser and paste the full post URL instead.");
    }
    suppliedUrl = expanded;
  }
  if (!suppliedUrl || !isValidLinkedInPostUrl(suppliedUrl)) {
    throw new Error(
      "Please supply a LinkedIn post link: linkedin.com/posts/..., linkedin.com/feed/update/..., or an lnkd.in short link."
    );
  }
  const canonicalSupplied = canonicalizeLinkedInUrl(suppliedUrl);
  const suppliedActivity = extractActivityId(suppliedUrl);

  const matchedTestPost = TEST_LINKEDIN_POSTS.find(
    (p) => p.canonicalUrl === canonicalSupplied || (suppliedActivity && extractActivityId(p.url) === suppliedActivity)
  );
  if (matchedTestPost && imported.length === 0) {
    return {
      posts: [{ ...matchedTestPost, relevanceToQuery: 1 }],
      rawComments: TEST_RAW_COMMENTS.filter((c) => c.postId === matchedTestPost.id),
      testCandidatePool: TEST_CANDIDATE_POOL,
      searchKeys,
      dataSource: "labelled_test_dataset",
      isTestData: true,
      complianceNotice: `${TEST_DATASET_NOTICE} (Matched a test fixture post URL.)`,
      warnings: [],
      providers: { posts: "labelled test dataset", comments: "labelled test dataset" },
    };
  }

  const warnings: string[] = [];
  const manual = request.manualInput;

  // Post metadata: user-entered fields > public search index > what the URL itself encodes
  let indexed: LinkedInPost | null = null;
  if (hasSearchKey(searchKeys) && !(manual?.postAuthorName && manual?.postSnippet)) {
    try {
      indexed = await lookupPostInIndex(suppliedUrl, searchKeys);
    } catch (err) {
      warnings.push(`Post metadata lookup failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  const handle = extractPostAuthorHandle(suppliedUrl);
  const topics = inferTopicsFromPostUrl(suppliedUrl);
  const post: LinkedInPost = {
    id: suppliedActivity ? `post-${suppliedActivity}` : "supplied-post-1",
    url: cleanLinkedInUrl(suppliedUrl),
    canonicalUrl: canonicalSupplied,
    authorName:
      manual?.postAuthorName?.trim() || indexed?.authorName || (handle ? `@${handle}` : "Author not available"),
    authorRole:
      manual?.postAuthorRole?.trim() || indexed?.authorRole || (handle ? `linkedin.com/posts/${handle}` : "User-supplied post"),
    authorProfileUrl: manual?.postAuthorProfileUrl?.trim() || "",
    publishedAt: manual?.postDate?.trim() || activityIdToDate(suppliedActivity) || indexed?.publishedAt || "",
    snippet:
      manual?.postSnippet?.trim() ||
      indexed?.snippet ||
      (topics.length > 0 ? `Post topics from URL: ${topics.join(", ")}` : "Post text not available without login."),
    fullText: manual?.postSnippet?.trim() || indexed?.fullText || topics.join(" "),
    topics,
    engagementStats: { reactions: 0, comments: 0 },
    relevanceToQuery: 1,
    dataSource: indexed ? "authorized_provider" : "supplied_url_manual",
    isTestData: false,
  };

  const { comments, commentsProvider } = await gatherComments({
    posts: [post],
    apifyToken,
    imported,
    warnings,
    singlePost: true,
  });

  return {
    posts: withCommentCounts([post], comments),
    rawComments: comments,
    testCandidatePool: null,
    searchKeys,
    dataSource: comments.some((c) => c.dataSource === "authorized_provider") ? "authorized_provider" : "supplied_url_manual",
    isTestData: false,
    complianceNotice: liveNotice(indexed ? searchProviderName(searchKeys) : "user-supplied URL", commentsProvider),
    warnings,
    providers: {
      posts: indexed ? `${searchProviderName(searchKeys)} public search index` : "user-supplied URL",
      comments: commentsProvider,
    },
  };
}

async function gatherComments(params: {
  posts: LinkedInPost[];
  apifyToken: string | undefined;
  imported: ImportedCommenter[];
  warnings: string[];
  singlePost: boolean;
}): Promise<{ comments: RawCommentRecord[]; commentsProvider: string }> {
  const { posts, apifyToken, imported, warnings, singlePost } = params;
  const comments: RawCommentRecord[] = [];
  const sources: string[] = [];

  if (apifyToken) {
    try {
      const fetched = await fetchCommentsFromApify({ posts, token: apifyToken });
      comments.push(...fetched);
      sources.push("Apify licensed provider");
      if (fetched.length === 0) {
        warnings.push("The comments provider returned no public comments for the selected post(s).");
      }
    } catch (err) {
      warnings.push(`Comments provider error: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  if (imported.length > 0) {
    const importedRecords = mapImportedCommenters(imported, posts, singlePost);
    comments.push(...importedRecords);
    sources.push("user import");
    const skipped = imported.length - importedRecords.length;
    if (skipped > 0) {
      warnings.push(
        `${skipped} imported row(s) skipped: in keyword mode each row needs a postUrl that matches one of the discovered posts.`
      );
    }
    const withoutUrl = importedRecords.filter((r) => !r.authorProfileUrl).length;
    if (withoutUrl > 0) {
      warnings.push(`${withoutUrl} imported commenter(s) have no profile URL in the source (shown as "URL not available").`);
    }
  }

  if (!apifyToken && imported.length === 0) {
    warnings.push(
      "No comments source configured. LinkedIn has no public comments API: add an Apify token (licensed provider) or import the commenters (CSV/JSON/copied text) under Providers & Import."
    );
  }

  return { comments, commentsProvider: sources.length > 0 ? sources.join(" + ") : "none configured" };
}

export function mapImportedCommenters(
  imported: ImportedCommenter[],
  posts: LinkedInPost[],
  singlePost: boolean
): RawCommentRecord[] {
  const out: RawCommentRecord[] = [];
  imported.forEach((c, idx) => {
    let post: LinkedInPost | undefined;
    if (c.postUrl) {
      const act = extractActivityId(c.postUrl);
      post = posts.find(
        (p) =>
          p.canonicalUrl === canonicalizeLinkedInUrl(c.postUrl!) ||
          (act !== null && extractActivityId(p.url) === act)
      );
    }
    if (!post && singlePost) post = posts[0];
    if (!post) return;

    const role = c.currentRole?.trim() || "";
    const org = c.organization?.trim() || "";
    const headline = c.headline?.trim() || [role, org].filter(Boolean).join(" at ");
    out.push({
      commentId: `import-${idx + 1}`,
      postId: post.id,
      postUrl: post.url,
      authorName: c.name.trim(),
      authorProfileUrl: c.linkedinUrl?.trim() || "",
      headline: headline || "Headline not provided",
      currentRole: role || "Role not provided",
      organization: org || "Organization not provided",
      location: c.location?.trim() || null,
      commentText: c.commentText?.trim() || "",
      commentedAt: post.publishedAt,
      experienceSummary: headline,
      skills: [],
      schoolNetworkSignals: [],
      dataSource: "supplied_url_manual",
      isTestData: false,
    });
  });
  return out;
}

function withCommentCounts(posts: LinkedInPost[], comments: RawCommentRecord[]): LinkedInPost[] {
  return posts.map((p) => ({
    ...p,
    engagementStats: {
      ...p.engagementStats,
      comments: comments.filter((c) => c.postId === p.id).length,
    },
  }));
}

function liveNotice(postsSource: string, commentsSource: string): string {
  return `Live data. Posts: ${postsSource}. Commenters: ${commentsSource}. Lookalikes: public profile search seeded by the commenters. No LinkedIn login, cookies, or direct LinkedIn page fetching is used.`;
}

function testDatasetForQuery(query: string, maxPosts: number): RetrievedSourceBundle {
  const rankedPosts = TEST_LINKEDIN_POSTS.map((post) => {
    const postCorpus = `${post.snippet} ${post.fullText} ${post.topics.join(" ")} ${post.authorRole}`;
    const sim = computeTextSimilarity(query, postCorpus);
    const combinedScore = Math.min(0.99, Math.max(0.15, sim * 0.65 + post.relevanceToQuery * 0.35));
    return { ...post, relevanceToQuery: Number(combinedScore.toFixed(3)) };
  })
    .sort((a, b) => {
      if (Math.abs(b.relevanceToQuery - a.relevanceToQuery) > 0.08) {
        return b.relevanceToQuery - a.relevanceToQuery;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, maxPosts);

  const selectedIds = new Set(rankedPosts.map((p) => p.id));
  return {
    posts: rankedPosts,
    rawComments: TEST_RAW_COMMENTS.filter((c) => selectedIds.has(c.postId)),
    testCandidatePool: TEST_CANDIDATE_POOL,
    searchKeys: {},
    dataSource: "labelled_test_dataset",
    isTestData: true,
    complianceNotice: TEST_DATASET_NOTICE,
    warnings: [],
    providers: { posts: "labelled test dataset", comments: "labelled test dataset" },
  };
}
