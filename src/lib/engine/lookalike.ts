import { canonicalizeLinkedInUrl } from "@/lib/data/compliant-provider";
import {
  extractSchoolEcosystemIndicators,
  scoreProfileForEdxso,
} from "@/lib/engine/scorer";
import { computeTextSimilarity } from "@/lib/engine/semantic";
import {
  AiMethod,
  AnalyzedCommenter,
  CandidateProfileRecord,
  LookalikeProfile,
  SeedMatchReference,
} from "@/lib/types";

/**
 * Discovers AI-matched lookalike profiles using extracted commenters as seed profiles.
 *
 * Strict guarantees:
 * 1. Never emits an original commenter as a lookalike (enforced via canonical URL set).
 * 2. Preserves full traceability to 1–3 seed commenters with shared signals & rationale.
 * 3. Ranks lookalikes by EDXSO relevance score (semantic + ecosystem fit + seed similarity).
 */
export function discoverLookalikes(params: {
  commenters: AnalyzedCommenter[];
  candidatePool: CandidateProfileRecord[];
  queryContext: string;
  maxLookalikes?: number;
  aiMethod?: AiMethod;
}): LookalikeProfile[] {
  const {
    commenters,
    candidatePool,
    queryContext,
    maxLookalikes = 12,
    aiMethod = "local_semantic_v1",
  } = params;

  if (commenters.length === 0) {
    return [];
  }

  // Strict exclusion set: any profile that commented on a source post cannot be labelled as a lookalike
  const commenterCanonicalUrls = new Set(
    commenters.map((c) => canonicalizeLinkedInUrl(c.linkedinUrl))
  );

  // Use high/medium-relevance commenters first as primary seeds (fallback to all commenters if none >= 50)
  const qualifiedSeeds = commenters.filter((c) => c.relevanceScore >= 50);
  const seedPool = qualifiedSeeds.length > 0 ? qualifiedSeeds : commenters;

  const seedTexts = seedPool.map((seed) => ({
    seed,
    corpus: `${seed.headline} ${seed.currentRole} ${seed.organization} ${seed.schoolEcosystemIndicators.join(" ")} ${seed.comments.map((cm) => cm.text).join(" ")}`,
  }));

  const results: LookalikeProfile[] = [];

  for (const candidate of candidatePool) {
    const canonicalCandUrl = canonicalizeLinkedInUrl(candidate.linkedinUrl);
    if (commenterCanonicalUrls.has(canonicalCandUrl)) {
      continue;
    }

    const candCorpus = `${candidate.headline} ${candidate.currentRole} ${candidate.organization} ${candidate.experienceSummary} ${candidate.skills.join(" ")} ${candidate.schoolNetworkSignals.join(" ")} ${candidate.recentTopics.join(" ")}`;
    const candIndicators = extractSchoolEcosystemIndicators({
      name: candidate.name,
      headline: candidate.headline,
      currentRole: candidate.currentRole,
      organization: candidate.organization,
      experienceSummary: candidate.experienceSummary,
      skills: candidate.skills,
      schoolNetworkSignals: candidate.schoolNetworkSignals,
      contextText: candidate.recentTopics.join(" "),
    });

    // Measure similarity against every seed commenter
    const seedMatches: SeedMatchReference[] = seedTexts
      .map(({ seed, corpus }) => {
        const sim = computeTextSimilarity(candCorpus, corpus);
        const sharedIndicators = candIndicators.filter((tag) =>
          seed.schoolEcosystemIndicators.includes(tag)
        );
        const sharedSkills = candidate.skills.filter((sk) =>
          seed.headline.toLowerCase().includes(sk.toLowerCase()) ||
          seed.schoolEcosystemIndicators.some((ind) =>
            ind.toLowerCase().includes(sk.toLowerCase())
          )
        );
        const sharedSignals = Array.from(
          new Set([...sharedIndicators, ...sharedSkills])
        ).slice(0, 5);

        const pct = Math.round(sim * 100);
        const rationale =
          sharedSignals.length > 0
            ? `${pct}% semantic match with ${seed.name} (${seed.currentRole}) driven by shared signals: ${sharedSignals.join(", ")}.`
            : `${pct}% semantic profile similarity with ${seed.name} (${seed.currentRole}) across K12 ecosystem topics.`;

        return {
          seedCommenterId: seed.id,
          seedCommenterName: seed.name,
          seedLinkedinUrl: seed.linkedinUrl,
          similarityScore: pct,
          sharedSignals,
          rationale,
        };
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 3);

    const topSeed = seedMatches[0];
    const maxSimRatio = topSeed ? topSeed.similarityScore / 100 : 0;

    // Score candidate for EDXSO outreach relevance
    const combinedSeedContext = `${queryContext} ${seedMatches
      .map((m) => m.sharedSignals.join(" "))
      .join(" ")}`;

    const scored = scoreProfileForEdxso({
      input: {
        name: candidate.name,
        headline: candidate.headline,
        currentRole: candidate.currentRole,
        organization: candidate.organization,
        experienceSummary: candidate.experienceSummary,
        skills: candidate.skills,
        schoolNetworkSignals: candidate.schoolNetworkSignals,
        contextText: candidate.recentTopics.join(" "),
      },
      queryOrSeedContext: combinedSeedContext,
      maxSeedSimilarity: maxSimRatio,
      isLookalike: true,
    });

    const similarityEvidence = Array.from(
      new Set([
        ...seedMatches.flatMap((m) => m.sharedSignals),
        ...candidate.schoolNetworkSignals,
      ])
    ).slice(0, 6);

    results.push({
      id: candidate.id,
      category: "ai_lookalike_profile",
      name: candidate.name,
      linkedinUrl: canonicalCandUrl || candidate.linkedinUrl,
      canonicalLinkedinUrl: canonicalCandUrl,
      headline: candidate.headline,
      currentRole: candidate.currentRole,
      organization: candidate.organization,
      location: candidate.location,
      experienceSummary: candidate.experienceSummary,
      skills: candidate.skills,
      schoolEcosystemIndicators: scored.indicators,
      seedProfiles: seedMatches,
      similarityScore: topSeed ? topSeed.similarityScore : 0,
      similarityEvidence,
      relevanceScore: scored.scoreBreakdown.total,
      scoreBreakdown: scored.scoreBreakdown,
      relevanceExplanation: scored.explanation,
      personaTier: scored.personaTier,
      aiMethod,
      dataSource: candidate.dataSource,
      isTestData: candidate.isTestData,
    });
  }

  return results
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.similarityScore - a.similarityScore;
    })
    .slice(0, maxLookalikes);
}
