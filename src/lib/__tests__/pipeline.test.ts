import test from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPipeline } from "../engine/pipeline";
import { exportResultToCsv, exportResultToJson } from "../engine/exporter";
import { canonicalizeLinkedInUrl } from "../data/compliant-provider";
import { discoverLookalikes } from "../engine/lookalike";
import { TEST_CANDIDATE_POOL } from "../data/labelled-test-dataset";

test("Keyword search 'K12 B2B Sales' discovers 5 relevant posts and extracts commenters", async () => {
  const result = await runDiscoveryPipeline({
    mode: "keyword",
    query: "K12 B2B Sales",
    maxPosts: 5,
    maxLookalikes: 12,
  });

  assert.equal(result.posts.length, 5);
  assert.equal(result.isTestData, true);
  assert.equal(result.dataSource, "labelled_test_dataset");
  assert.ok(result.stats.rawCommentsExtracted > result.stats.uniqueCommenters);
  assert.ok(result.stats.deduplicatedDuplicatesRemoved > 0);

  for (const post of result.posts) {
    assert.ok(post.url.startsWith("https://www.linkedin.com/posts/"));
    assert.ok(post.authorName.length > 0);
    assert.ok(post.publishedAt.length > 0);
    assert.ok(post.snippet.length > 20);
  }
});

test("Commenter deduplication canonicalizes URLs and retains all associated post URLs", async () => {
  const result = await runDiscoveryPipeline({
    mode: "keyword",
    query: "K12 B2B Sales",
    maxPosts: 5,
  });

  const kavita = result.commenters.find((c) =>
    c.name.includes("Kavita Sharma")
  );
  assert.ok(kavita, "Expected Dr. Kavita Sharma in commenters");
  assert.equal(kavita.commentCount, 3);
  assert.equal(kavita.associatedPostUrls.length, 3);
  assert.equal(
    kavita.canonicalLinkedinUrl,
    canonicalizeLinkedInUrl(
      "https://www.linkedin.com/in/test-fixture-dr-kavita-sharma-k12/?utm_source=feed"
    )
  );
});

test("Direct post URL mode processes a single post directly and supports manual engagement import", async () => {
  const customUrl =
    "https://www.linkedin.com/posts/custom-school-founder_k12-edtech-trustees-activity-999999999";

  const result = await runDiscoveryPipeline({
    mode: "post_url",
    postUrl: customUrl,
    manualInput: {
      postUrl: customUrl,
      postAuthorName: "Anita Menon",
      postSnippet: "How school trustees evaluate multi-campus K12 partners.",
      commenters: [
        {
          name: "Suresh Iyer",
          linkedinUrl: "https://www.linkedin.com/in/suresh-iyer-k12-sample/",
          currentRole: "Former Principal & School Advisor",
          organization: "Vidya Advisory",
          location: "Bengaluru, India",
          commentText:
            "Across 20 schools I mentor, trustees look for peer references first.",
        },
      ],
    },
  });

  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].url, customUrl);
  assert.equal(result.dataSource, "supplied_url_manual");
  assert.equal(result.commenters.length, 1);
  assert.equal(result.commenters[0].name, "Suresh Iyer");
  assert.ok(result.commenters[0].relevanceScore >= 65);
  assert.ok(result.lookalikes.length > 0);
});

test("Lookalikes are strictly separated from original commenters and carry seed traceability", async () => {
  const result = await runDiscoveryPipeline({
    mode: "keyword",
    query: "K12 B2B Sales",
    maxPosts: 5,
    maxLookalikes: 14,
  });

  const commenterUrls = new Set(
    result.commenters.map((c) => c.canonicalLinkedinUrl)
  );
  for (const lookalike of result.lookalikes) {
    assert.equal(lookalike.category, "ai_lookalike_profile");
    assert.equal(
      commenterUrls.has(lookalike.canonicalLinkedinUrl),
      false,
      `Lookalike ${lookalike.name} must not overlap with original commenters`
    );
    assert.ok(
      lookalike.seedProfiles.length >= 1,
      `Lookalike ${lookalike.name} must reference at least 1 seed commenter`
    );
    assert.ok(lookalike.similarityScore > 0);
    assert.ok(lookalike.linkedinUrl.startsWith("https://www.linkedin.com/in/"));
  }

  // Verify explicit guard if candidate pool contains an existing commenter
  const injectedPool = [
    ...TEST_CANDIDATE_POOL,
    {
      id: "dup-inject",
      name: result.commenters[0].name,
      linkedinUrl: `${result.commenters[0].linkedinUrl}/?trk=injected`,
      headline: result.commenters[0].headline,
      currentRole: result.commenters[0].currentRole,
      organization: result.commenters[0].organization,
      location: result.commenters[0].location,
      experienceSummary: "Injected duplicate check",
      skills: ["Former Principal"],
      schoolNetworkSignals: ["Former Principal"],
      recentTopics: ["K12 B2B Sales"],
      dataSource: "labelled_test_dataset" as const,
      isTestData: true,
    },
  ];

  const guardedLookalikes = discoverLookalikes({
    commenters: result.commenters,
    candidatePool: injectedPool,
    queryContext: "K12 B2B Sales",
    maxLookalikes: 20,
  });

  assert.equal(
    guardedLookalikes.some((l) => l.id === "dup-inject"),
    false,
    "Guarded lookalike discovery must exclude injected commenter duplicate"
  );
});

test("Semantic ranking scores K12 school decision-makers higher than non-K12 drift profiles", async () => {
  const result = await runDiscoveryPipeline({
    mode: "keyword",
    query: "K12 B2B Sales",
    maxPosts: 5,
    maxLookalikes: 14,
  });

  const topCommenter = result.commenters[0];
  const corpCommenter = result.commenters.find((c) =>
    c.name.includes("Sunita Verma")
  );
  assert.ok(topCommenter && corpCommenter);
  assert.ok(
    topCommenter.relevanceScore - corpCommenter.relevanceScore >= 40,
    `Expected >=40 point separation between top K12 leader (${topCommenter.relevanceScore}) and Corporate L&D (${corpCommenter.relevanceScore})`
  );

  const topLookalike = result.lookalikes[0];
  const higherEdLookalike = result.lookalikes.find((l) =>
    l.name.includes("Tarunima Bose")
  );
  assert.ok(topLookalike && higherEdLookalike);
  assert.ok(
    topLookalike.relevanceScore - higherEdLookalike.relevanceScore >= 40,
    `Expected >=40 point separation between top K12 lookalike (${topLookalike.relevanceScore}) and Higher-Ed professor (${higherEdLookalike.relevanceScore})`
  );
});

test("JSON and CSV exports separate commenters and lookalikes and preserve provenance", async () => {
  const result = await runDiscoveryPipeline({
    mode: "keyword",
    query: "K12 B2B Sales",
    maxPosts: 5,
    maxLookalikes: 6,
  });

  const jsonParsed = JSON.parse(exportResultToJson(result));
  assert.equal(jsonParsed.runMetadata.isTestData, true);
  assert.ok(Array.isArray(jsonParsed.original_commenters));
  assert.ok(Array.isArray(jsonParsed.ai_lookalike_profiles));
  assert.equal(jsonParsed.original_commenters.length, result.commenters.length);
  assert.equal(jsonParsed.ai_lookalike_profiles.length, result.lookalikes.length);

  const csv = exportResultToCsv(result);
  const lines = csv.trim().split("\n");
  assert.equal(
    lines.length,
    1 + result.commenters.length + result.lookalikes.length
  );
  assert.ok(lines[0].includes("record_category"));
  assert.ok(lines[0].includes("seed_profiles_traceability"));
  assert.ok(csv.includes("original_commenter"));
  assert.ok(csv.includes("ai_lookalike_profile"));
});
