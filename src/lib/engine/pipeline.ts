import { retrieveCompliantData } from "@/lib/data/compliant-provider";
import { canonicalizeLinkedInUrl } from "@/lib/data/linkedin-urls";
import { hasSearchKey, searchLinkedInProfiles, searchProviderName } from "@/lib/data/providers/web-search";
import { deduplicateCommenters } from "@/lib/engine/deduplicator";
import { discoverLookalikes } from "@/lib/engine/lookalike";
import { buildLookalikeQueries } from "@/lib/engine/lookalike-sourcing";
import { analyzeCommenters } from "@/lib/engine/scorer";
import { cosineSimilarity, EMBEDDING_DIMENSIONS } from "@/lib/engine/semantic";
import { classifyProfiles, ClassificationInput, embedTexts, resolveGeminiKey } from "@/lib/engine/gemini";
import {
  AiClassification,
  AiMethod,
  AnalyzedCommenter,
  CandidateProfileRecord,
  DiscoveryRequest,
  DiscoveryResult,
  LookalikeProfile,
  PersonaTier,
} from "@/lib/types";

/** Weight of the Gemini fit score in the final rank when LLM classification is available. */
export const LLM_BLEND_WEIGHT = 0.4;

export async function runDiscoveryPipeline(request: DiscoveryRequest): Promise<DiscoveryResult> {
  const executedAt = new Date().toISOString();
  const runId = `edxso-${Date.now().toString(36)}`;

  // Stages 1-3: input, post discovery, commenter retrieval
  const source = await retrieveCompliantData(request);
  const warnings = [...source.warnings];

  const queryContext =
    request.mode === "post_url"
      ? `${source.posts[0]?.snippet ?? ""} ${source.posts[0]?.topics.join(" ") ?? ""}`.trim() || "K12 school network"
      : (request.query || "K12 B2B Sales").trim();

  const geminiKey = resolveGeminiKey(request.apiKeys?.geminiApiKey);
  const aiMethod: AiMethod = geminiKey ? "gemini_hybrid" : "local_semantic_v1";

  // Stage 3b: dedupe by canonical profile URL
  const { uniqueCommenters, duplicatesRemoved } = deduplicateCommenters(source.rawComments);

  // Stage 4: rubric + local semantic analysis
  let commenters = analyzeCommenters({ commenters: uniqueCommenters, queryContext, aiMethod });

  // Stage 5a: candidate pool (test fixtures, or live public profile search seeded by commenters)
  let candidatePool: CandidateProfileRecord[] = [];
  let lookalikeProvider = "none";
  if (source.testCandidatePool) {
    candidatePool = source.testCandidatePool;
    lookalikeProvider = "labelled test dataset";
  } else if (commenters.length > 0 && hasSearchKey(source.searchKeys)) {
    const seeds = commenters.filter((c) => c.relevanceScore >= 40);
    const queries = buildLookalikeQueries(seeds.length > 0 ? seeds : commenters);
    if (queries.length === 0) {
      warnings.push("Seed commenters have no role information to build lookalike searches from.");
    } else {
      try {
        candidatePool = await searchLinkedInProfiles(queries, source.searchKeys);
        lookalikeProvider = `${searchProviderName(source.searchKeys)} public profile search (${queries.length} seed-derived queries)`;
      } catch (err) {
        warnings.push(`Lookalike search failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } else if (commenters.length > 0) {
    warnings.push(
      "Lookalike discovery on live data needs a search index key (SERPER_API_KEY or TAVILY_API_KEY); test-dataset profiles are never mixed into live results."
    );
  }

  // Stage 5b: optional Gemini embeddings for seed <-> candidate similarity
  let embeddingSimilarity: ((candId: string, seedId: string) => number | undefined) | undefined;
  if (geminiKey && candidatePool.length > 0 && commenters.length > 0) {
    const seedTexts = commenters.map(
      (c) => `${c.headline}. ${c.currentRole} at ${c.organization}. ${c.comments.map((m) => m.text).join(" ")}`
    );
    const candTexts = candidatePool.map(
      (c) => `${c.headline}. ${c.currentRole} at ${c.organization}. ${c.experienceSummary} ${c.recentTopics.join(" ")}`
    );
    const { vectors, error: embedError } = await embedTexts([...seedTexts, ...candTexts], geminiKey);
    if (vectors) {
      const seedVec = new Map(commenters.map((c, i) => [c.id, vectors[i]]));
      const candVec = new Map(candidatePool.map((c, i) => [c.id, vectors[commenters.length + i]]));
      // Gemini cosine for related professional text sits roughly in 0.5..1; rescale to 0..1
      embeddingSimilarity = (candId, seedId) => {
        const a = candVec.get(candId);
        const b = seedVec.get(seedId);
        if (!a || !b) return undefined;
        return Math.max(0, Math.min(1, (cosineSimilarity(a, b) - 0.5) / 0.45));
      };
    } else {
      warnings.push(`Gemini embeddings unavailable (${embedError ?? "unknown"}); used local semantic similarity only.`);
    }
  }

  const excludeAuthors = source.posts.map((p) => canonicalizeLinkedInUrl(p.authorProfileUrl)).filter(Boolean);
  let lookalikes = discoverLookalikes({
    commenters,
    candidatePool,
    queryContext,
    maxLookalikes: Math.max(request.maxLookalikes ?? 12, 1) * 2, // re-ranked and trimmed after LLM pass
    aiMethod,
    embeddingSimilarity,
    excludeCanonicalUrls: excludeAuthors,
  });

  // Stage 6: Gemini zero-shot classification blended into the final rank
  let aiProvider = "local 12-dim concept embedding + token cosine";
  if (geminiKey && (commenters.length > 0 || lookalikes.length > 0)) {
    const inputs: ClassificationInput[] = [
      ...commenters.map((c) => ({
        id: c.id,
        name: c.name,
        headline: c.headline,
        role: c.currentRole,
        organization: c.organization,
        location: c.location,
        context: `Comment: ${c.comments.map((m) => m.text).join(" / ")}`,
      })),
      ...lookalikes.map((l) => ({
        id: `L:${l.id}`,
        name: l.name,
        headline: l.headline,
        role: l.currentRole,
        organization: l.organization,
        location: l.location,
        context: `Public profile snippet: ${l.experienceSummary}`,
      })),
    ].slice(0, 75);
    const { results, model, error } = await classifyProfiles(inputs, queryContext, geminiKey);
    if (results.size > 0) {
      aiProvider = `Gemini ${model} classification${embeddingSimilarity ? " + Gemini embeddings" : ""} blended with local rubric`;
      commenters = commenters.map((c) => blend(c, results.get(c.id)));
      lookalikes = lookalikes.map((l) => blend(l, results.get(`L:${l.id}`)));
    } else if (error) {
      warnings.push(`${error} Ranking used the local semantic rubric only.`);
    }
  }

  commenters = [...commenters].sort((a, b) => b.relevanceScore - a.relevanceScore);
  lookalikes = [...lookalikes]
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.similarityScore - a.similarityScore)
    .slice(0, request.maxLookalikes ?? 12);

  const avg = (xs: number[]) => (xs.length > 0 ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

  return {
    runId,
    executedAt,
    inputMode: request.mode,
    queryOrUrl:
      request.mode === "post_url"
        ? (request.postUrl || request.manualInput?.postUrl || "").trim()
        : (request.query || "K12 B2B Sales").trim(),
    dataSource: source.dataSource,
    isTestData: source.isTestData,
    complianceNotice: source.complianceNotice,
    aiMethod,
    providers: {
      posts: source.providers.posts,
      comments: source.providers.comments,
      lookalikes: lookalikeProvider,
      ai: aiProvider,
    },
    warnings,
    posts: source.posts,
    stats: {
      postsFound: source.posts.length,
      rawCommentsExtracted: source.rawComments.length,
      uniqueCommenters: commenters.length,
      deduplicatedDuplicatesRemoved: duplicatesRemoved,
      lookalikesDiscovered: lookalikes.length,
      avgCommenterScore: avg(commenters.map((c) => c.relevanceScore)),
      avgLookalikeScore: avg(lookalikes.map((l) => l.relevanceScore)),
    },
    commenters,
    lookalikes,
    methodology: {
      summary:
        "Each profile is scored by a 100-point rubric: Ecosystem Persona Fit (35), Multi-School Network Reach (25), Semantic Alignment (25: cosine of a 12-dimension K12 concept embedding against EDXSO's ideal-target vector, plus synonym-expanded token cosine to the query), and Engagement / Seed Similarity (15), with penalties for higher-ed and corporate/B2C drift. With a Gemini key, seed-to-candidate similarity blends Gemini embeddings (60%) with the local similarity (40%), and the final score blends the rubric (60%) with a Gemini zero-shot persona fit score (40%). Live lookalikes are sourced through public profile searches derived from each seed's role, persona indicators and location.",
      embeddingDimensions: [...EMBEDDING_DIMENSIONS],
      weights: {
        ecosystemFit: 35,
        networkReach: 25,
        semanticAlignment: 25,
        engagementOrSimilaritySignal: 15,
      },
      compliancePathToProduction: [
        "LinkedIn Community Management API for posts and comments on pages EDXSO administers (partner approval required).",
        "Licensed data provider under a signed DPA for public post comments (Apify actor used here; swap via APIFY_COMMENTS_ACTOR).",
        "Public search index (Serper/Tavily) for post and profile discovery: reads only indexed titles, URLs and snippets.",
        "User-supplied post URLs plus user-exported commenter lists (CSV/JSON/copied text).",
      ],
    },
  };
}

function tierFor(total: number): PersonaTier {
  if (total >= 80) return "Primary Decision-Maker / Advisor";
  if (total >= 62) return "Ecosystem Multiplier";
  if (total >= 42) return "Adjacent EdTech Operator";
  return "Low Fit";
}

function blend<T extends AnalyzedCommenter | LookalikeProfile>(item: T, ai: AiClassification | undefined): T {
  if (!ai) return item;
  const rubric = item.scoreBreakdown.total;
  const score = Math.round(rubric * (1 - LLM_BLEND_WEIGHT) + ai.fitScore * LLM_BLEND_WEIGHT);
  return {
    ...item,
    aiClassification: ai,
    relevanceScore: score,
    personaTier: tierFor(score),
    relevanceExplanation: `${item.relevanceExplanation} Gemini (${ai.persona}, fit ${ai.fitScore}/100): ${ai.rationale}`,
  };
}
