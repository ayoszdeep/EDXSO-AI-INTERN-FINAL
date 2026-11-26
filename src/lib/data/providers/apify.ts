import { LinkedInPost, RawCommentRecord } from "@/lib/types";
import {
  canonicalizeLinkedInUrl,
  cleanAvatarUrl,
  cleanLinkedInUrl,
  decodeHtmlText,
  extractActivityId,
  isValidLinkedInProfileUrl,
  splitHeadline,
} from "@/lib/data/linkedin-urls";
import { TtlCache } from "@/lib/data/providers/cache";

/**
 * Commenter retrieval through a third-party data provider on Apify
 * (default actor: `harvestapi/linkedin-post-comments`, a no-cookie actor that
 * returns only publicly visible comments). The provider runs under its own
 * terms; this app never logs into LinkedIn, never handles LinkedIn cookies,
 * and never fetches LinkedIn pages itself.
 *
 * Swap actors with APIFY_COMMENTS_ACTOR if your organisation licenses a
 * different provider. The mapper below accepts the common output shapes.
 */

const DEFAULT_ACTOR = "harvestapi~linkedin-post-comments";
const commentsCache = new TtlCache<RawCommentRecord[]>(60 * 60 * 1000, 100);

export function resolveApifyToken(token?: string): string | undefined {
  return token?.trim() || process.env.APIFY_API_TOKEN?.trim() || undefined;
}

interface ApifyPersonShape {
  name?: string;
  profileUrl?: string;
  linkedinUrl?: string;
  position?: string;
  headline?: string;
  author?: boolean;
  pictureUrl?: unknown;
  picture?: unknown;
  avatarUrl?: unknown;
  avatar?: unknown;
  photoUrl?: unknown;
  profilePicture?: unknown;
  imageUrl?: unknown;
  imgUrl?: unknown;
}

interface ApifyCommentItem {
  type?: string;
  id?: string;
  linkedinUrl?: string;
  commentary?: string;
  text?: string;
  comment?: string;
  createdAt?: string;
  postId?: string;
  postUrl?: string;
  post_url?: string;
  query?: string | { post?: string };
  actor?: ApifyPersonShape;
  author?: ApifyPersonShape;
}

function extractApifyAvatar(person?: ApifyPersonShape): string | undefined {
  if (!person) return undefined;
  for (const field of [
    person.pictureUrl,
    person.picture,
    person.avatarUrl,
    person.avatar,
    person.profilePicture,
    person.photoUrl,
    person.imageUrl,
    person.imgUrl,
  ]) {
    const cleaned = cleanAvatarUrl(field);
    if (cleaned) return cleaned;
  }
  return undefined;
}

export async function fetchCommentsFromApify(params: {
  posts: LinkedInPost[];
  token: string;
  maxCommentsPerPost?: number;
}): Promise<RawCommentRecord[]> {
  const { posts, token } = params;
  const maxItems = Math.min(Math.max(params.maxCommentsPerPost ?? 50, 1), 200);
  if (posts.length === 0) return [];

  const cacheKey = `${posts.map((p) => p.canonicalUrl).sort().join("|")}|${maxItems}`;
  const cached = commentsCache.get(cacheKey);
  if (cached) return cached;

  const actor = (process.env.APIFY_COMMENTS_ACTOR?.trim() || DEFAULT_ACTOR).replace("/", "~");
  const postUrls = posts.map((p) => p.url);

  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?timeout=50&clean=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        posts: postUrls,
        // Aliases used by other comment actors, so APIFY_COMMENTS_ACTOR can be swapped freely
        postUrls,
        maxItems,
        scrapeReplies: false,
        profileScraperMode: "short",
      }),
      signal: AbortSignal.timeout(58000),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Apify rejected the API token (check APIFY_API_TOKEN).");
    }
    if (response.status === 402) {
      throw new Error("Apify account has insufficient credit for the comments actor.");
    }
    if (response.status === 408) {
      throw new Error("Apify comments run timed out; try fewer posts or retry.");
    }
    throw new Error(`Apify comments run failed (${response.status}). ${detail.slice(0, 160)}`);
  }

  const items = (await response.json()) as ApifyCommentItem[];
  const records = mapApifyComments(Array.isArray(items) ? items : [], posts);
  commentsCache.set(cacheKey, records);
  return records;
}

/** Maps provider items to RawCommentRecords, attributing each to its source post. */
export function mapApifyComments(items: ApifyCommentItem[], posts: LinkedInPost[]): RawCommentRecord[] {
  const byActivity = new Map<string, LinkedInPost>();
  for (const p of posts) {
    const id = extractActivityId(p.url);
    if (id) byActivity.set(id, p);
  }

  const records: RawCommentRecord[] = [];
  items.forEach((item, idx) => {
    if (item.type && item.type !== "comment") return;
    const name = decodeHtmlText(item.actor?.name ?? item.author?.name ?? "");
    const rawProfile =
      item.actor?.linkedinUrl ?? item.author?.linkedinUrl ?? item.author?.profileUrl ?? "";
    if (!name) return;

    // Attribute to the right post: explicit postId -> activity id in comment URL -> query echo -> single post
    const queryPost = typeof item.query === "string" ? item.query : item.query?.post;
    const candidates = [item.postId, item.postUrl, item.post_url, item.linkedinUrl, queryPost];
    let post: LinkedInPost | undefined;
    for (const c of candidates) {
      if (!c) continue;
      const id = /^\d{15,22}$/.test(c) ? c : extractActivityId(c);
      if (id && byActivity.has(id)) {
        post = byActivity.get(id);
        break;
      }
    }
    // The provider echoes the input URL; "share-" URLs carry a share id that differs from the activity id
    if (!post && queryPost) {
      const canonicalQuery = canonicalizeLinkedInUrl(queryPost);
      post = posts.find((p) => p.canonicalUrl === canonicalQuery || canonicalizeLinkedInUrl(p.url) === canonicalQuery);
    }
    if (!post && posts.length === 1) post = posts[0];
    if (!post) return; // cannot trace to a source post -> do not guess

    const headline = decodeHtmlText(item.actor?.position ?? item.actor?.headline ?? item.author?.headline ?? "");
    const split = splitHeadline(headline);
    records.push({
      commentId: item.id ? `apify-${item.id}` : `apify-${idx + 1}`,
      postId: post.id,
      postUrl: post.url,
      authorName: name,
      authorProfileUrl: isValidLinkedInProfileUrl(rawProfile) ? cleanLinkedInUrl(rawProfile) : "",
      avatarUrl: extractApifyAvatar(item.actor) ?? extractApifyAvatar(item.author),
      headline: headline || "Headline not provided",
      currentRole: split.role || "Role not provided",
      organization: split.organization || "Organization not provided",
      location: null,
      commentText: decodeHtmlText(item.commentary ?? item.text ?? item.comment ?? ""),
      commentedAt: item.createdAt ?? post.publishedAt,
      experienceSummary: headline,
      skills: [],
      schoolNetworkSignals: [],
      dataSource: "authorized_provider",
      isTestData: false,
    });
  });
  return records;
}
