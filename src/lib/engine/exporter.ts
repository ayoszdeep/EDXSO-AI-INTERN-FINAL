import { DiscoveryResult } from "@/lib/types";

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports discovery results to structured JSON with explicit separation
 * between `original_commenters` and `ai_lookalike_profiles`.
 */
export function exportResultToJson(result: DiscoveryResult): string {
  const payload = {
    exportSchemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    runMetadata: {
      runId: result.runId,
      executedAt: result.executedAt,
      inputMode: result.inputMode,
      queryOrUrl: result.queryOrUrl,
      dataSource: result.dataSource,
      isTestData: result.isTestData,
      complianceNotice: result.complianceNotice,
      aiMethod: result.aiMethod,
      stats: result.stats,
    },
    discoveredPosts: result.posts,
    original_commenters: result.commenters.map((c, idx) => ({
      rank: idx + 1,
      category: c.category,
      name: c.name,
      linkedinProfileUrl: c.linkedinUrl,
      currentRole: c.currentRole,
      organization: c.organization,
      location: c.location,
      personaTier: c.personaTier,
      relevanceScore: c.relevanceScore,
      scoreBreakdown: c.scoreBreakdown,
      schoolEcosystemIndicators: c.schoolEcosystemIndicators,
      associatedPostUrls: c.associatedPostUrls,
      commentCount: c.commentCount,
      comments: c.comments,
      relevanceExplanation: c.relevanceExplanation,
      dataSource: c.dataSource,
      isTestData: c.isTestData,
    })),
    ai_lookalike_profiles: result.lookalikes.map((l, idx) => ({
      rank: idx + 1,
      category: l.category,
      name: l.name,
      linkedinProfileUrl: l.linkedinUrl,
      currentRole: l.currentRole,
      organization: l.organization,
      location: l.location,
      personaTier: l.personaTier,
      relevanceScore: l.relevanceScore,
      similarityScore: l.similarityScore,
      scoreBreakdown: l.scoreBreakdown,
      schoolEcosystemIndicators: l.schoolEcosystemIndicators,
      seedProfiles: l.seedProfiles,
      similarityEvidence: l.similarityEvidence,
      relevanceExplanation: l.relevanceExplanation,
      dataSource: l.dataSource,
      isTestData: l.isTestData,
    })),
    methodology: result.methodology,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Exports discovery results to CSV with `record_category` explicitly separating
 * `original_commenter` rows from `ai_lookalike_profile` rows, including
 * provenance and seed traceability columns.
 */
export function exportResultToCsv(result: DiscoveryResult): string {
  const headers = [
    "record_category",
    "rank",
    "name",
    "linkedin_profile_url",
    "current_role",
    "organization",
    "location",
    "persona_tier",
    "relevance_score",
    "ecosystem_fit_score",
    "network_reach_score",
    "semantic_alignment_score",
    "engagement_or_similarity_score",
    "school_ecosystem_indicators",
    "associated_post_urls",
    "seed_profiles_traceability",
    "similarity_score",
    "similarity_evidence",
    "relevance_explanation",
    "data_source",
    "is_test_data",
  ];

  const rows: string[][] = [headers];

  result.commenters.forEach((c, idx) => {
    rows.push([
      "original_commenter",
      String(idx + 1),
      c.name,
      c.linkedinUrl,
      c.currentRole,
      c.organization,
      c.location ?? "",
      c.personaTier,
      String(c.relevanceScore),
      String(c.scoreBreakdown.ecosystemFit),
      String(c.scoreBreakdown.networkReach),
      String(c.scoreBreakdown.semanticAlignment),
      String(c.scoreBreakdown.engagementOrSimilaritySignal),
      c.schoolEcosystemIndicators.join(" | "),
      c.associatedPostUrls.join(" | "),
      "",
      "",
      "",
      c.relevanceExplanation,
      c.dataSource,
      String(c.isTestData),
    ]);
  });

  result.lookalikes.forEach((l, idx) => {
    const seedTrace = l.seedProfiles
      .map(
        (s) =>
          `${s.seedCommenterName} (${s.similarityScore}% - ${s.seedLinkedinUrl})`
      )
      .join(" | ");

    rows.push([
      "ai_lookalike_profile",
      String(idx + 1),
      l.name,
      l.linkedinUrl,
      l.currentRole,
      l.organization,
      l.location ?? "",
      l.personaTier,
      String(l.relevanceScore),
      String(l.scoreBreakdown.ecosystemFit),
      String(l.scoreBreakdown.networkReach),
      String(l.scoreBreakdown.semanticAlignment),
      String(l.scoreBreakdown.engagementOrSimilaritySignal),
      l.schoolEcosystemIndicators.join(" | "),
      "",
      seedTrace,
      String(l.similarityScore),
      l.similarityEvidence.join(" | "),
      l.relevanceExplanation,
      l.dataSource,
      String(l.isTestData),
    ]);
  });

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
