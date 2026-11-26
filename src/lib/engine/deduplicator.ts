import { canonicalizeLinkedInUrl, cleanLinkedInUrl } from "@/lib/data/linkedin-urls";
import { CommentReference, DataSourceMode, RawCommentRecord } from "@/lib/types";

export interface DeduplicatedCommenter {
  id: string;
  name: string;
  linkedinUrl: string;
  canonicalLinkedinUrl: string;
  headline: string;
  currentRole: string;
  organization: string;
  location: string | null;
  experienceSummary: string;
  skills: string[];
  schoolNetworkSignals: string[];
  associatedPostUrls: string[];
  associatedPostIds: string[];
  comments: CommentReference[];
  commentCount: number;
  dataSource: DataSourceMode;
  isTestData: boolean;
}

export interface DeduplicationOutput {
  uniqueCommenters: DeduplicatedCommenter[];
  duplicatesRemoved: number;
}

/**
 * Deduplicates extracted commenter records across multiple posts using
 * canonicalized LinkedIn profile URLs, while preserving full traceability
 * to every post URL and comment snippet.
 */
export function deduplicateCommenters(
  rawComments: RawCommentRecord[]
): DeduplicationOutput {
  const byCanonicalUrl = new Map<string, DeduplicatedCommenter>();

  for (const record of rawComments) {
    const canonicalUrl = canonicalizeLinkedInUrl(record.authorProfileUrl);
    const dedupKey =
      canonicalUrl ||
      `name:${record.authorName.trim().toLowerCase()}:${record.organization.trim().toLowerCase()}`;

    const existing = byCanonicalUrl.get(dedupKey);
    const commentRef: CommentReference = {
      postId: record.postId,
      postUrl: record.postUrl,
      text: record.commentText,
      commentedAt: record.commentedAt,
    };

    if (!existing) {
      byCanonicalUrl.set(dedupKey, {
        id: `commenter-${byCanonicalUrl.size + 1}`,
        name: record.authorName,
        linkedinUrl: cleanLinkedInUrl(record.authorProfileUrl),
        canonicalLinkedinUrl: canonicalUrl,
        headline: record.headline,
        currentRole: record.currentRole,
        organization: record.organization,
        location: record.location,
        experienceSummary: record.experienceSummary,
        skills: [...record.skills],
        schoolNetworkSignals: [...record.schoolNetworkSignals],
        associatedPostUrls: [record.postUrl],
        associatedPostIds: [record.postId],
        comments: [commentRef],
        commentCount: 1,
        dataSource: record.dataSource,
        isTestData: record.isTestData,
      });
    } else {
      if (!existing.associatedPostUrls.includes(record.postUrl)) {
        existing.associatedPostUrls.push(record.postUrl);
      }
      if (!existing.associatedPostIds.includes(record.postId)) {
        existing.associatedPostIds.push(record.postId);
      }
      existing.comments.push(commentRef);
      existing.commentCount += 1;

      // Merge richer fields if missing on the initial record
      if (!existing.location && record.location) {
        existing.location = record.location;
      }
      if (record.headline.length > existing.headline.length) {
        existing.headline = record.headline;
      }
      if (record.experienceSummary.length > existing.experienceSummary.length) {
        existing.experienceSummary = record.experienceSummary;
      }
      existing.skills = Array.from(
        new Set([...existing.skills, ...record.skills])
      );
      existing.schoolNetworkSignals = Array.from(
        new Set([
          ...existing.schoolNetworkSignals,
          ...record.schoolNetworkSignals,
        ])
      );
    }
  }

  const uniqueCommenters = Array.from(byCanonicalUrl.values());
  const duplicatesRemoved = Math.max(
    0,
    rawComments.length - uniqueCommenters.length
  );

  return { uniqueCommenters, duplicatesRemoved };
}
