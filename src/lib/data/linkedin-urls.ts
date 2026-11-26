/**
 * Pure helpers for LinkedIn URLs. No network access happens here.
 */

/**
 * Normalizes a LinkedIn URL so trailing slashes, protocol differences,
 * country subdomains (`in.linkedin.com` -> `www.linkedin.com`), and tracking
 * query parameters (`?utm_source=...`, `?trk=...`) never prevent deduplication.
 */
export function canonicalizeLinkedInUrl(rawUrl: string): string {
  return cleanLinkedInUrl(rawUrl).toLowerCase();
}

/**
 * Same normalization as {@link canonicalizeLinkedInUrl} but preserves path case,
 * so URN-style profile links (`/in/ACoAAB...`), which are case-sensitive, stay
 * valid. Use this for display/export and the canonical form as a dedupe key.
 */
export function cleanLinkedInUrl(rawUrl: string): string {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase().endsWith("linkedin.com")
      ? "www.linkedin.com"
      : parsed.hostname.toLowerCase();
    let path = parsed.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep raw path when it contains malformed escapes
    }
    return `https://${host}${path.replace(/\/+$/, "")}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
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

/**
 * Decodes HTML entities in provider/search text, including the broken form
 * some providers emit where the "&" was already stripped ("Full-Stack amp; Backend").
 */
export function decodeHtmlText(raw: string): string {
  return (raw ?? "")
    .replace(/&amp;|(?<=\s|^)amp;/g, "&")
    .replace(/&lt;|(?<=\s|^)lt;/g, "<")
    .replace(/&gt;|(?<=\s|^)gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** LinkedIn's official URL shortener, e.g. https://lnkd.in/p/g-YzbFzC */
export function isLinkedInShortLink(rawUrl: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
    return u.hostname.toLowerCase() === "lnkd.in";
  } catch {
    return false;
  }
}

/**
 * Expands an lnkd.in short link by reading only the HTTP redirect target
 * (Location header). The destination page itself is never downloaded, so this
 * is link expansion, not scraping. Returns null if it doesn't lead to linkedin.com.
 */
export async function expandLinkedInShortLink(rawUrl: string): Promise<string | null> {
  let current = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  for (let hop = 0; hop < 4; hop++) {
    if (!isLinkedInShortLink(current)) break;
    const res = await fetch(current, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const location = res.headers.get("location");
    if (!location || res.status < 300 || res.status >= 400) return null;
    current = new URL(location, current).toString();
  }
  return /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(current) ? cleanLinkedInUrl(current) : null;
}

export function isValidLinkedInProfileUrl(rawUrl: string): boolean {
  const canonical = canonicalizeLinkedInUrl(rawUrl);
  return /^https:\/\/www\.linkedin\.com\/in\/[^/]+$/.test(canonical);
}

/**
 * Extracts the numeric activity id from any post or comment URL shape:
 *  - /posts/<handle>_<slug>-activity-7264102938471001-abcd
 *  - /feed/update/urn:li:activity:7264102938471001/
 *  - /feed/update/urn:li:ugcPost:7264102938471001/
 *  - comment URLs containing urn:li:comment:(activity:7264...,7265...)
 */
export function extractActivityId(rawUrl: string): string | null {
  const text = decodeURIComponent(rawUrl ?? "");
  const match =
    text.match(/activity[-:](\d{15,22})/i) ??
    text.match(/ugcPost[-:](\d{15,22})/i) ??
    text.match(/share[-:](\d{15,22})/i);
  return match ? match[1] : null;
}

/**
 * LinkedIn activity ids are Snowflake-style: the first 41 bits are the
 * creation time in Unix milliseconds. Decoding them gives the exact post date
 * without fetching the post.
 */
export function activityIdToDate(activityId: string | null): string | null {
  if (!activityId || !/^\d{15,22}$/.test(activityId)) return null;
  try {
    const ms = Number(BigInt(activityId) >> BigInt(22));
    // Sanity window: LinkedIn launched 2003; reject anything outside 2010..now+1d
    if (ms < Date.UTC(2010, 0, 1) || ms > Date.now() + 86_400_000) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/** `/posts/<handle>_<slug>-activity-...` -> `<handle>` (person or company vanity name). */
export function extractPostAuthorHandle(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const m = parsed.pathname.match(/^\/posts\/([^_/]+)_/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function inferTopicsFromPostUrl(url: string): string[] {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname
      .replace(/^\/posts\/[^_/]+_/i, "")
      .replace(/^\/posts\//i, "")
      .replace(/(activity|share|ugcpost)-\d+.*/i, "")
      .replace(/^\/feed\/update\/.*/i, "");
    const words = slug
      .split(/[-_/]+/)
      .filter((w) => w.length > 2 && !/^\d+$/.test(w));
    return Array.from(new Set(words)).slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Splits a LinkedIn headline such as "Former Principal at DPS | School Consultant"
 * into a best-effort role and organization. Returns "" for unknown parts rather
 * than inventing values.
 */
export function splitHeadline(headline: string): {
  role: string;
  organization: string;
} {
  const clean = (headline ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return { role: "", organization: "" };
  const firstSegment = clean.split(/\s[|•·]\s/)[0].trim();
  const atMatch = firstSegment.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) {
    return { role: atMatch[1].trim(), organization: atMatch[2].trim() };
  }
  // Commas usually list roles ("School leader, designer and consultant"), not an employer,
  // so without an explicit "at"/"@" the organisation stays unknown rather than guessed.
  return { role: firstSegment, organization: "" };
}
