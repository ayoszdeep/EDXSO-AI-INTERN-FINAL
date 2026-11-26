import { DeduplicatedCommenter } from "@/lib/engine/deduplicator";
import {
  computeConceptEmbedding,
  computeTextSimilarity,
  cosineSimilarity,
  EDXSO_IDEAL_TARGET_VECTOR,
} from "@/lib/engine/semantic";
import {
  AiMethod,
  AnalyzedCommenter,
  PersonaTier,
  ScoreBreakdown,
} from "@/lib/types";

export interface ProfileScoringInput {
  name: string;
  headline: string;
  currentRole: string;
  organization: string;
  experienceSummary: string;
  skills: string[];
  schoolNetworkSignals: string[];
  contextText: string; // comments for commenters, or recentTopics for candidates
}

export function extractSchoolEcosystemIndicators(
  input: ProfileScoringInput
): string[] {
  const combined = `${input.headline} ${input.currentRole} ${input.organization} ${input.experienceSummary} ${input.skills.join(" ")} ${input.schoolNetworkSignals.join(" ")} ${input.contextText}`;

  const indicators: string[] = [];

  if (/\b(former|retired|ex[-\s]?)\s*(cbse|icse|ib|sainik|school)?\s*principal\b/i.test(combined)) {
    indicators.push("Former Principal");
  } else if (/\bprincipal\b/i.test(input.currentRole + " " + input.headline)) {
    indicators.push("School Principal");
  }

  if (/\b(managing\s+trustee|trustee|chairman|chairperson|school\s+owner|promoter)\b/i.test(combined)) {
    indicators.push("Trustee / School Owner");
  }

  if (/\b(school\s+director|executive\s+director|academic\s+director)\b/i.test(combined)) {
    indicators.push("School Director");
  }

  if (/\b(school|education|k12|k-12|academic)\s+(consultant|advisor|mentor|auditor)\b/i.test(combined) || /\badvisory\b/i.test(input.organization)) {
    indicators.push("School & Education Advisor");
  }

  if (/\b(education\s+entrepreneur|eduventures|edupreneur)\b/i.test(combined) || (/\b(founder|co-founder)\b/i.test(combined) && /\b(school|k12|edu)/i.test(combined))) {
    indicators.push("Education Entrepreneur");
  }

  const schoolCountMatch = combined.match(/\b(\d{1,4})\+?\s*(k12\s+)?(schools|campuses|principals|institutions)\b/i);
  if (
    schoolCountMatch ||
    /\b(multi[-\s]?school|multi[-\s]?campus|consortium|federation|association|guild|alliance|school\s+chain)\b/i.test(
      combined
    )
  ) {
    indicators.push(
      schoolCountMatch
        ? `Multi-School Reach (${schoolCountMatch[1]}+)`
        : "Multi-School Network"
    );
  }

  if (/\b(trustee\s+review|boardroom|roundtable|decision[-\s]?maker|reference\s+principals|school\s+founders|promoters|symposiums)\b/i.test(combined)) {
    indicators.push("Decision-Maker Access");
  }

  if (/\b(k12|k-12)\b/i.test(combined) && /\b(b2b|edtech|erp|lms|procurement|partnerships|channel|distribution)\b/i.test(combined)) {
    indicators.push("K12 B2B / EdTech Partnerships");
  }

  if (/\b(cbse|icse|ib|cambridge|nep\s*2020|accreditation)\b/i.test(combined)) {
    indicators.push("K12 Boards & NEP 2020");
  }

  if (/\b(university|higher\s+education|naac|assistant\s+professor)\b/i.test(combined) && !/\bk12\b/i.test(combined)) {
    indicators.push("Higher-Ed Focus (Non-K12)");
  }

  if (/\b(corporate\s+l&d|jee\/neet|b2c\s+online)\b/i.test(combined) && !/\bschool\s+(owner|trustee|principal|advisor)\b/i.test(combined)) {
    indicators.push("Non-School Segment");
  }

  return Array.from(new Set(indicators));
}

export function scoreProfileForEdxso(params: {
  input: ProfileScoringInput;
  queryOrSeedContext: string;
  engagementCount?: number;
  maxSeedSimilarity?: number; // 0..1 when scoring lookalikes
  isLookalike: boolean;
}): {
  scoreBreakdown: ScoreBreakdown;
  indicators: string[];
  personaTier: PersonaTier;
  explanation: string;
} {
  const {
    input,
    queryOrSeedContext,
    engagementCount = 1,
    maxSeedSimilarity = 0,
    isLookalike,
  } = params;

  const fullCorpus = `${input.headline} ${input.currentRole} ${input.organization} ${input.experienceSummary} ${input.skills.join(" ")} ${input.schoolNetworkSignals.join(" ")} ${input.contextText}`;
  const indicators = extractSchoolEcosystemIndicators(input);

  // 1. Ecosystem Fit (0 - 35)
  let ecosystemFit = 4;
  if (indicators.includes("Former Principal") || indicators.includes("School Principal")) {
    ecosystemFit += 14;
  }
  if (indicators.includes("Trustee / School Owner") || indicators.includes("School Director")) {
    ecosystemFit += 14;
  }
  if (indicators.includes("School & Education Advisor")) {
    ecosystemFit += 13;
  }
  if (indicators.includes("Education Entrepreneur")) {
    ecosystemFit += 10;
  }
  if (indicators.includes("K12 B2B / EdTech Partnerships")) {
    ecosystemFit += 7;
  }
  if (indicators.includes("K12 Boards & NEP 2020")) {
    ecosystemFit += 4;
  }
  if (indicators.includes("Higher-Ed Focus (Non-K12)") || indicators.includes("Non-School Segment")) {
    ecosystemFit = Math.max(2, ecosystemFit - 16);
  }
  ecosystemFit = Math.min(35, Math.round(ecosystemFit));

  // 2. Network Reach & Decision-Maker Access (0 - 25)
  let networkReach = 3;
  const multiSchoolTag = indicators.find((i) => i.startsWith("Multi-School"));
  if (multiSchoolTag) {
    networkReach += 13;
    const countMatch = multiSchoolTag.match(/(\d+)/);
    if (countMatch) {
      const n = parseInt(countMatch[1], 10);
      if (n >= 20) networkReach += 4;
      else if (n >= 5) networkReach += 2;
    }
  }
  if (indicators.includes("Decision-Maker Access")) {
    networkReach += 7;
  }
  if (indicators.includes("Higher-Ed Focus (Non-K12)") || indicators.includes("Non-School Segment")) {
    networkReach = Math.min(networkReach, 5);
  }
  networkReach = Math.min(25, Math.round(networkReach));

  // 3. Semantic Alignment (0 - 25): Concept Embedding vs EDXSO Ideal Target + Query/Seed Context
  const profileEmbedding = computeConceptEmbedding(fullCorpus);
  const idealCosine = cosineSimilarity(profileEmbedding, EDXSO_IDEAL_TARGET_VECTOR);
  // Normalize idealCosine (~ -0.45..+0.95) into 0..1
  const normalizedIdeal = Math.max(0, Math.min(1, (idealCosine + 0.1) / 0.85));
  const querySim = computeTextSimilarity(queryOrSeedContext, fullCorpus);
  let semanticAlignment = Math.round(
    (normalizedIdeal * 0.72 + querySim * 0.28) * 25
  );
  if (indicators.includes("Higher-Ed Focus (Non-K12)") || indicators.includes("Non-School Segment")) {
    semanticAlignment = Math.min(semanticAlignment, 7);
  }
  semanticAlignment = Math.max(0, Math.min(25, semanticAlignment));

  // 4. Engagement or Seed Similarity Signal (0 - 15)
  let engagementOrSimilaritySignal = 0;
  if (isLookalike) {
    engagementOrSimilaritySignal = Math.min(
      15,
      Math.max(2, Math.round(maxSeedSimilarity * 15))
    );
  } else {
    const commentWordCount = input.contextText.trim().split(/\s+/).length;
    const depthPts = commentWordCount >= 24 ? 7 : commentWordCount >= 12 ? 5 : 3;
    const multiPostPts = engagementCount >= 3 ? 8 : engagementCount === 2 ? 6 : 3;
    engagementOrSimilaritySignal = Math.min(15, depthPts + multiPostPts);
  }

  const total = Math.min(
    100,
    ecosystemFit + networkReach + semanticAlignment + engagementOrSimilaritySignal
  );

  let personaTier: PersonaTier = "Low Fit";
  if (total >= 80) {
    personaTier = "Primary Decision-Maker / Advisor";
  } else if (total >= 62) {
    personaTier = "Ecosystem Multiplier";
  } else if (total >= 42) {
    personaTier = "Adjacent EdTech Operator";
  }

  // Grounded human-readable explanation
  const reasons: string[] = [];
  const positiveIndicators = indicators.filter(
    (i) => !i.includes("Non-K12") && !i.includes("Non-School")
  );
  if (positiveIndicators.length > 0) {
    reasons.push(
      `Matches EDXSO target signals (${positiveIndicators.slice(0, 4).join(", ")})`
    );
  } else {
    reasons.push(
      `Limited K12 school-ecosystem alignment based on available role (${input.currentRole}) and organization (${input.organization})`
    );
  }

  if (!isLookalike) {
    reasons.push(
      engagementCount > 1
        ? `actively engaged across ${engagementCount} relevant posts`
        : "demonstrated relevant engagement in comment context"
    );
  } else {
    reasons.push(
      `exhibits ${Math.round(maxSeedSimilarity * 100)}% semantic similarity to top commenter seed profiles`
    );
  }

  if (
    indicators.includes("Higher-Ed Focus (Non-K12)") ||
    indicators.includes("Non-School Segment")
  ) {
    reasons.push(
      "penalized for non-K12 segment drift (University/Corporate/B2C rather than K12 schools)"
    );
  }

  return {
    scoreBreakdown: {
      ecosystemFit,
      networkReach,
      semanticAlignment,
      engagementOrSimilaritySignal,
      total,
    },
    indicators,
    personaTier,
    explanation: `${reasons.join("; ")}.`,
  };
}

export function analyzeCommenters(params: {
  commenters: DeduplicatedCommenter[];
  queryContext: string;
  aiMethod?: AiMethod;
}): AnalyzedCommenter[] {
  const { commenters, queryContext, aiMethod = "local_semantic_v1" } = params;

  const analyzed: AnalyzedCommenter[] = commenters.map((c) => {
    const commentTexts = c.comments.map((cm) => cm.text).join(" ");
    const scored = scoreProfileForEdxso({
      input: {
        name: c.name,
        headline: c.headline,
        currentRole: c.currentRole,
        organization: c.organization,
        experienceSummary: c.experienceSummary,
        skills: c.skills,
        schoolNetworkSignals: c.schoolNetworkSignals,
        contextText: commentTexts,
      },
      queryOrSeedContext: queryContext,
      engagementCount: c.commentCount,
      isLookalike: false,
    });

    return {
      id: c.id,
      category: "original_commenter",
      name: c.name,
      linkedinUrl: c.linkedinUrl,
      canonicalLinkedinUrl: c.canonicalLinkedinUrl,
      avatarUrl: c.avatarUrl,
      headline: c.headline,
      currentRole: c.currentRole,
      organization: c.organization,
      location: c.location,
      associatedPostUrls: c.associatedPostUrls,
      associatedPostIds: c.associatedPostIds,
      comments: c.comments,
      commentCount: c.commentCount,
      schoolEcosystemIndicators: scored.indicators,
      relevanceScore: scored.scoreBreakdown.total,
      scoreBreakdown: scored.scoreBreakdown,
      relevanceExplanation: scored.explanation,
      personaTier: scored.personaTier,
      aiMethod,
      dataSource: c.dataSource,
      isTestData: c.isTestData,
    };
  });

  return analyzed.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
