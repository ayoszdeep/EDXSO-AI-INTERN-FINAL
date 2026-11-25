import { retrieveCompliantData } from "@/lib/data/compliant-provider";
import { deduplicateCommenters } from "@/lib/engine/deduplicator";
import { discoverLookalikes } from "@/lib/engine/lookalike";
import { analyzeCommenters } from "@/lib/engine/scorer";
import {
  EMBEDDING_DIMENSIONS,
  tryGeminiSemanticSummary,
  tryOpenAiSemanticSummary,
} from "@/lib/engine/semantic";
import { AiMethod, DiscoveryRequest, DiscoveryResult } from "@/lib/types";

export async function runDiscoveryPipeline(
  request: DiscoveryRequest
): Promise<DiscoveryResult> {
  const executedAt = new Date().toISOString();
  const runId = `edxso-${Date.now().toString(36)}`;

  // Stages 1-2: Search Input & Compliant Post/Comment Retrieval
  const sourceBundle = await retrieveCompliantData(request);

  const queryContext =
    request.mode === "post_url"
      ? `${sourceBundle.posts[0]?.snippet ?? ""} ${sourceBundle.posts[0]?.topics.join(" ") ?? ""}`
      : (request.query || "K12 B2B Sales").trim();

  // Detect optional live LLM configuration
  const hasGemini = Boolean(
    request.apiKeys?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  );
  const hasOpenAi = Boolean(
    request.apiKeys?.openAiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
  const aiMethod: AiMethod = hasGemini
    ? "gemini_hybrid"
    : hasOpenAi
      ? "openai_hybrid"
      : "local_semantic_v1";

  // Stage 3: Commenter Extraction & Canonical URL Deduplication
  const { uniqueCommenters, duplicatesRemoved } = deduplicateCommenters(
    sourceBundle.rawComments
  );

  // Stage 4: AI Profile Analysis & EDXSO Outreach Scoring
  let analyzedCommenters = analyzeCommenters({
    commenters: uniqueCommenters,
    queryContext,
    aiMethod,
  });

  // Stage 5: Lookalike Profile Discovery (Strictly separated from commenters)
  const lookalikes = discoverLookalikes({
    commenters: analyzedCommenters,
    candidatePool: sourceBundle.candidatePool,
    queryContext,
    maxLookalikes: request.maxLookalikes ?? 12,
    aiMethod,
  });

  // Optional LLM outreach rationale enhancement for top #1 commenter if API key supplied
  if ((hasGemini || hasOpenAi) && analyzedCommenters.length > 0) {
    const topProspect = analyzedCommenters[0];
    const llmPrompt = `In 1 concise sentence (max 30 words), explain why "${topProspect.name}" (${topProspect.currentRole} at ${topProspect.organization}) is high-priority for EDXSO's K12 school-network B2B outreach given indicators: ${topProspect.schoolEcosystemIndicators.join(", ")}.`;

    const llmInsight = hasGemini
      ? await tryGeminiSemanticSummary(llmPrompt, request.apiKeys?.geminiApiKey)
      : await tryOpenAiSemanticSummary(
          llmPrompt,
          request.apiKeys?.openAiApiKey
        );

    if (llmInsight) {
      analyzedCommenters = analyzedCommenters.map((item, idx) =>
        idx === 0
          ? {
              ...item,
              relevanceExplanation: `${item.relevanceExplanation} AI Note: ${llmInsight}`,
            }
          : item
      );
    }
  }

  // Stage 6: Summary Statistics & Methodology Documentation
  const avgCommenterScore =
    analyzedCommenters.length > 0
      ? Math.round(
          analyzedCommenters.reduce((sum, c) => sum + c.relevanceScore, 0) /
            analyzedCommenters.length
        )
      : 0;

  const avgLookalikeScore =
    lookalikes.length > 0
      ? Math.round(
          lookalikes.reduce((sum, l) => sum + l.relevanceScore, 0) /
            lookalikes.length
        )
      : 0;

  return {
    runId,
    executedAt,
    inputMode: request.mode,
    queryOrUrl:
      request.mode === "post_url"
        ? (request.postUrl || request.manualInput?.postUrl || "").trim()
        : (request.query || "K12 B2B Sales").trim(),
    dataSource: sourceBundle.dataSource,
    isTestData: sourceBundle.isTestData,
    complianceNotice: sourceBundle.complianceNotice,
    aiMethod,
    posts: sourceBundle.posts,
    stats: {
      postsFound: sourceBundle.posts.length,
      rawCommentsExtracted: sourceBundle.rawComments.length,
      uniqueCommenters: analyzedCommenters.length,
      deduplicatedDuplicatesRemoved: duplicatesRemoved,
      lookalikesDiscovered: lookalikes.length,
      avgCommenterScore,
      avgLookalikeScore,
    },
    commenters: analyzedCommenters,
    lookalikes,
    methodology: {
      summary:
        "Profiles are embedded into a 12-dimensional K12 Education Ecosystem semantic vector combined with synonym-expanded token cosine similarity. Ranking blends Ecosystem Persona Fit (35 pts), Multi-School Network Reach (25 pts), Semantic Alignment (25 pts), and Engagement/Seed Similarity Signal (15 pts), with explicit penalties for non-K12 drift (higher-ed or corporate/B2C).",
      embeddingDimensions: [...EMBEDDING_DIMENSIONS],
      weights: {
        ecosystemFit: 35,
        networkReach: 25,
        semanticAlignment: 25,
        engagementOrSimilaritySignal: 15,
      },
      compliancePathToProduction: [
        "Official LinkedIn Community Management / Marketing Developer APIs for partner-authorized organization posts and comments.",
        "Licensed B2B enrichment providers (e.g., People Data Labs, Proxycurl, CoreSignal, or Serper/Tavily public web index) under signed DPAs.",
        "User-supplied LinkedIn post URLs paired with user-exported engagement CSV/JSON or CRM contact lists.",
      ],
    },
  };
}
