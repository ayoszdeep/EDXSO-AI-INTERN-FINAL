import test from "node:test";
import assert from "node:assert/strict";
import { parseImportedCommenters } from "../data/import-parser";
import {
  activityIdToDate,
  canonicalizeLinkedInUrl,
  cleanLinkedInUrl,
  extractActivityId,
  splitHeadline,
} from "../data/linkedin-urls";
import { parsePostAuthorFromTitle, parseProfileHit, searchHitToPost } from "../data/providers/web-search";
import { mapApifyComments } from "../data/providers/apify";
import { buildLookalikeQueries } from "../engine/lookalike-sourcing";
import { parseClassificationResponse, pickModels } from "../engine/gemini";
import { exportResultToCsv } from "../engine/exporter";
import { runDiscoveryPipeline } from "../engine/pipeline";
import { AnalyzedCommenter, LinkedInPost } from "../types";

// ---------- URL helpers ----------

test("activity ids are extracted from every post/comment URL shape and decode to the post date", () => {
  assert.equal(
    extractActivityId("https://www.linkedin.com/posts/jane_k12-sales-activity-7328838056403173380-AbCd"),
    "7328838056403173380"
  );
  assert.equal(
    extractActivityId("https://www.linkedin.com/feed/update/urn:li:activity:7328838056403173380/"),
    "7328838056403173380"
  );
  assert.equal(
    extractActivityId(
      "https://www.linkedin.com/feed/update/urn:li:activity:7328838056403173380?commentUrn=urn%3Ali%3Acomment%3A(activity%3A7328838056403173380%2C7331)"
    ),
    "7328838056403173380"
  );
  // 7328838056403173380 >> 22 = 1747334474... ms -> mid-May 2025
  const iso = activityIdToDate("7328838056403173380");
  assert.ok(iso && iso.startsWith("2025-05"), `decoded ${iso}`);
  assert.equal(activityIdToDate("999999999"), null);
});

test("profile URLs keep case for display but dedupe case-insensitively", () => {
  const urn = "https://in.linkedin.com/in/ACoAABcdEfG/?trk=feed";
  assert.equal(cleanLinkedInUrl(urn), "https://www.linkedin.com/in/ACoAABcdEfG");
  assert.equal(canonicalizeLinkedInUrl(urn), "https://www.linkedin.com/in/acoaabcdefg");
});

test("headline splitting never invents an organisation", () => {
  assert.deepEqual(splitHeadline("Former Principal at DPS Pune | School Consultant"), {
    role: "Former Principal",
    organization: "DPS Pune",
  });
  assert.deepEqual(splitHeadline("Education Consultant"), { role: "Education Consultant", organization: "" });
});

// ---------- Import parser ----------

test("import parser handles CSV with header, quoted commas and post_url", () => {
  const csv = `Name,Profile URL,Role,Company,Location,Comment,Post URL
"Rao, Anita",https://www.linkedin.com/in/anita-rao/,Former Principal,ABC School,"Pune, India","Great point, trustees decide",https://www.linkedin.com/posts/x_y-activity-7328838056403173380-ab`;
  const rows = parseImportedCommenters(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Rao, Anita");
  assert.equal(rows[0].linkedinUrl, "https://www.linkedin.com/in/anita-rao");
  assert.equal(rows[0].organization, "ABC School");
  assert.equal(rows[0].location, "Pune, India");
  assert.equal(rows[0].commentText, "Great point, trustees decide");
  assert.ok(rows[0].postUrl?.includes("7328838056403173380"));
});

test("import parser accepts Apify comment JSON and pipe rows; rejects non-profile URLs", () => {
  const apify = JSON.stringify([
    {
      type: "comment",
      commentary: "We run 12 schools",
      actor: { name: "Vik Mehta", linkedinUrl: "https://www.linkedin.com/in/vik", position: "Trustee at Meridian Schools" },
    },
  ]);
  const a = parseImportedCommenters(apify);
  assert.equal(a[0].name, "Vik Mehta");
  assert.equal(a[0].currentRole, "Trustee");
  assert.equal(a[0].organization, "Meridian Schools");

  const pipes = parseImportedCommenters("Asha K | https://example.com/asha | Consultant | X | | hi");
  assert.equal(pipes.length, 1);
  assert.equal(pipes[0].linkedinUrl, "", "non-LinkedIn URL must not be kept as a profile URL");
});

test("import parser extracts commenters from text copied off a LinkedIn post", () => {
  const copied = `Most relevant
Anita Rao
• 2nd
Former Principal at ABC School | Education Consultant
3d
Trustees in tier-2 cities ask peers before buying.
Like
Reply
2 Likes
Rahul Verma
• 3rd+
K12 Sales Head at EduStack
1w
Agree, warm intros win.
Like
Reply`;
  const rows = parseImportedCommenters(copied);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Anita Rao");
  assert.equal(rows[0].currentRole, "Former Principal");
  assert.equal(rows[0].commentText, "Trustees in tier-2 cities ask peers before buying.");
  assert.equal(rows[0].linkedinUrl, "");
  assert.equal(rows[1].name, "Rahul Verma");
  assert.equal(rows[1].organization, "EduStack");
});

// ---------- Search index parsing ----------

test("post titles and profile hits from the search index parse into honest records", () => {
  assert.equal(parsePostAuthorFromTitle("Jane Doe on LinkedIn: K12 sales is about trust"), "Jane Doe");
  assert.equal(parsePostAuthorFromTitle("K12 sales is about trust | Jane Doe | 14 comments"), "Jane Doe");

  const post = searchHitToPost(
    {
      title: "Jane Doe on LinkedIn: K12 sales is about trust",
      link: "https://in.linkedin.com/posts/janedoe_k12-sales-activity-7328838056403173380-AbCd?utm_source=share",
      snippet: "School owners buy on references...",
    },
    0,
    "serper"
  );
  assert.equal(post.authorName, "Jane Doe");
  assert.ok(post.publishedAt.startsWith("2025-05"));
  assert.equal(post.authorProfileUrl, "", "author profile URL is not guessed from the post slug");
  assert.equal(post.isTestData, false);

  const prov = { provider: "serper" as const, query: "q", seedCommenterIds: ["c1"], seedCommenterNames: ["Seed"] };
  const cand = parseProfileHit(
    {
      title: "Anita Rao - Former Principal - Delhi Public School | LinkedIn",
      link: "https://in.linkedin.com/in/anita-rao-123",
      snippet: "Former Principal · Experience: Delhi Public School · Location: Pune · 500+ connections",
    },
    prov
  );
  assert.ok(cand);
  assert.equal(cand.name, "Anita Rao");
  assert.equal(cand.currentRole, "Former Principal");
  assert.equal(cand.organization, "Delhi Public School");
  assert.equal(cand.location, "Pune");
  assert.equal(cand.linkedinUrl, "https://www.linkedin.com/in/anita-rao-123");
  assert.equal(parseProfileHit({ title: "x", link: "https://www.linkedin.com/company/abc", snippet: "" }, prov), null);
});

// ---------- Apify mapping ----------

function fakePost(id: string): LinkedInPost {
  return {
    id: `post-${id}`,
    url: `https://www.linkedin.com/posts/a_b-activity-${id}-xy`,
    canonicalUrl: `https://www.linkedin.com/posts/a_b-activity-${id}-xy`,
    authorName: "A",
    authorRole: "",
    authorProfileUrl: "",
    publishedAt: "2026-11-01T00:00:00.000Z",
    snippet: "",
    fullText: "",
    topics: [],
    engagementStats: { reactions: 0, comments: 0 },
    relevanceToQuery: 1,
    dataSource: "authorized_provider",
    isTestData: false,
  };
}

test("Apify comments are attributed to the right post and never guessed", () => {
  const posts = [fakePost("7300000000000000001"), fakePost("7300000000000000002")];
  const records = mapApifyComments(
    [
      { type: "comment", postId: "7300000000000000002", commentary: "hi", actor: { name: "X", linkedinUrl: "https://www.linkedin.com/in/x", position: "Principal at Y" } },
      {
        type: "comment",
        linkedinUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7300000000000000001?commentUrn=1",
        commentary: "yo",
        actor: { name: "Z", linkedinUrl: "https://www.linkedin.com/in/z" },
      },
      { type: "comment", commentary: "orphan", actor: { name: "Q", linkedinUrl: "https://www.linkedin.com/in/q" } },
    ],
    posts
  );
  assert.equal(records.length, 2, "untraceable comment dropped");
  assert.equal(records[0].postId, "post-7300000000000000002");
  assert.equal(records[0].currentRole, "Principal");
  assert.equal(records[1].postId, "post-7300000000000000001");
});

// ---------- Lookalike query building ----------

test("lookalike queries are derived from seed roles/locations and keep seed traceability", () => {
  const seed = {
    id: "commenter-1",
    name: "Anita Rao",
    currentRole: "Former Principal",
    headline: "Former Principal at ABC School",
    location: "Pune, India",
    schoolEcosystemIndicators: ["Former Principal", "School & Education Advisor"],
    relevanceScore: 80,
  } as unknown as AnalyzedCommenter;
  const qs = buildLookalikeQueries([seed]);
  assert.ok(qs.length >= 1);
  assert.equal(qs[0].query, 'site:linkedin.com/in "former principal" Pune');
  assert.deepEqual(qs[0].seedIds, ["commenter-1"]);
});

// ---------- Gemini helpers ----------

test("Gemini model picker orders fast Flash-Lite first, then newest Flash; skips image/tts/preview", () => {
  const picked = pickModels([
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3-flash-preview", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-embedding-2-preview", supportedGenerationMethods: ["embedContent"] },
  ]);
  assert.deepEqual(picked.generate, [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]);
  assert.equal(picked.embed, "gemini-embedding-001");
});

test("Gemini classification JSON is parsed defensively", () => {
  const m = parseClassificationResponse(
    '```json\n[{"id":"commenter-1","fitScore":91.4,"persona":"Former Principal","isSchoolEcosystem":true,"rationale":"ok"},{"id":"bad"}]\n```',
    "gemini-x"
  );
  assert.equal(m.size, 1);
  assert.equal(m.get("commenter-1")?.fitScore, 91);
});

// ---------- Live pipeline end-to-end with mocked providers ----------

test("live keyword run: Serper posts -> Apify commenters -> seed-derived lookalikes -> Gemini ranking", async () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

    if (url.startsWith("https://google.serper.dev/images")) {
      return json({
        images: [
          {
            link: "https://in.linkedin.com/in/meera-shah",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:meera-dp",
            imageUrl: "https://media.licdn.com/dms/image/meera.jpg",
          },
          {
            link: "https://www.linkedin.com/in/someone-else",
            thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:wrong-person",
          },
        ],
      });
    }
    if (url.startsWith("https://google.serper.dev/search")) {
      if (String(body.q).startsWith("site:linkedin.com/posts")) {
        return json({
          organic: [1, 2, 3, 4, 5, 6].map((n) => ({
            title: `Author ${n} on LinkedIn: K12 B2B sales lesson ${n}`,
            link: `https://www.linkedin.com/posts/author${n}_k12-b2b-sales-activity-73000000000000000${n}0-ab`,
            snippet: `School trustees and principals decide purchases ${n}`,
          })),
        });
      }
      return json({
        organic: [
          {
            title: "Meera Shah - Former Principal - Sunrise School | LinkedIn",
            link: "https://www.linkedin.com/in/meera-shah",
            snippet: "Former Principal · Experience: Sunrise School · Location: Pune · school consultant for 15 schools",
          },
          {
            // the same person who commented must never come back as a lookalike
            title: "Commenter One - Former Principal - ABC | LinkedIn",
            link: "https://in.linkedin.com/in/commenter-one/",
            snippet: "Former Principal",
          },
        ],
      });
    }
    if (url.startsWith("https://api.apify.com/")) {
      assert.equal(body.posts.length, 5);
      return json([
        {
          type: "comment",
          postId: "730000000000000001" + "0",
          commentary: "As a former principal advising 15 schools, trustees ask peers first.",
          actor: {
            name: "Commenter One",
            linkedinUrl: "https://www.linkedin.com/in/commenter-one",
            position: "Former Principal at ABC",
            pictureUrl: "https://media.licdn.com/dms/image/commenter-one.jpg",
          },
        },
        {
          type: "comment",
          postId: "730000000000000002" + "0",
          commentary: "Same here.",
          actor: { name: "Commenter One", linkedinUrl: "https://www.linkedin.com/in/Commenter-One/", position: "Former Principal at ABC" },
        },
      ]);
    }
    if (url.includes("generativelanguage.googleapis.com") && url.endsWith("/models?pageSize=1000")) {
      return json({
        models: [
          { name: "models/gemini-9.9-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
        ],
      });
    }
    if (url.includes(":batchEmbedContents")) {
      return json({ embeddings: body.requests.map(() => ({ values: [0.6, 0.8] })) });
    }
    if (url.includes(":generateContent")) {
      const prompt: string = body.contents[0].parts[0].text;
      const ids = Array.from(prompt.matchAll(/"id":"([^"]+)"/g)).map((m) => m[1]);
      const out = ids.map((id) => ({ id, fitScore: 90, persona: "Former Principal / School Leader", isSchoolEcosystem: true, rationale: "Former principal." }));
      return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] });
    }
    return new Response("not mocked", { status: 500 });
  }) as typeof fetch;

  try {
    const result = await runDiscoveryPipeline({
      mode: "keyword",
      query: "K12 B2B Sales live-test",
      dataSource: "authorized_provider",
      maxPosts: 5,
      apiKeys: { serperApiKey: "s", apifyApiToken: "a", geminiApiKey: "g" },
    });

    assert.equal(result.isTestData, false);
    assert.equal(result.posts.length, 5);
    assert.equal(result.commenters.length, 1, "deduplicated across posts despite URL case/slash differences");
    const c = result.commenters[0];
    assert.equal(c.associatedPostUrls.length, 2);
    assert.equal(c.linkedinUrl, "https://www.linkedin.com/in/commenter-one");
    assert.equal(c.avatarUrl, "https://media.licdn.com/dms/image/commenter-one.jpg");
    assert.equal(c.aiClassification?.fitScore, 90);

    assert.equal(result.lookalikes.length, 1, "commenter excluded from lookalikes");
    const l = result.lookalikes[0];
    assert.equal(l.name, "Meera Shah");
    assert.equal(l.avatarUrl, "https://encrypted-tbn0.gstatic.com/images?q=tbn:meera-dp");
    assert.equal(l.isTestData, false);
    assert.equal(l.discoveredVia?.seedCommenterNames[0], "Commenter One");
    assert.equal(l.seedProfiles[0].seedCommenterName, "Commenter One");
    assert.ok(result.providers.ai.includes("gemini-9.9-flash"));
    assert.ok(calls.some((u) => u.includes(":batchEmbedContents")));

    const csv = exportResultToCsv(result);
    assert.ok(csv.includes("discovery_query"));
    assert.ok(csv.includes("Meera Shah"));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("CSV export neutralises spreadsheet formulas from external text", async () => {
  const result = await runDiscoveryPipeline({
    mode: "post_url",
    postUrl: "https://www.linkedin.com/posts/x_y-activity-7300000000000000999-ab",
    manualInput: {
      commenters: [{ name: "=HYPERLINK(\"http://evil\")", linkedinUrl: "", commentText: "+1 great" }],
    },
  });
  const csv = exportResultToCsv(result);
  assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`));
  assert.ok(!/,=HYPERLINK/.test(csv));
});

// ---------- Short links and share-style post URLs ----------

test("share- URLs: Apify comments are attributed via the echoed input URL", () => {
  const sharePost = {
    ...fakePost("7531569171604758528"),
    url: "https://www.linkedin.com/posts/rajni_hiring-share-7531569171604758528-a44O",
    canonicalUrl: "https://www.linkedin.com/posts/rajni_hiring-share-7531569171604758528-a44o",
  };
  const other = fakePost("7300000000000000001");
  const records = mapApifyComments(
    [
      {
        type: "comment",
        postId: "urn:li:activity:7531569174381457408", // activity id differs from the share id
        linkedinUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7531569174381457408?commentUrn=x",
        query: { post: "https://www.linkedin.com/posts/rajni_hiring-share-7531569171604758528-a44O" },
        commentary: "Interested",
        actor: { name: "A Person", linkedinUrl: "https://www.linkedin.com/in/a-person" },
      },
    ],
    [other, sharePost]
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].postId, sharePost.id);
});

test("lnkd.in short links are expanded from the redirect header only", async () => {
  const { expandLinkedInShortLink, isLinkedInShortLink } = await import("../data/linkedin-urls");
  assert.equal(isLinkedInShortLink("https://lnkd.in/p/g-YzbFzC"), true);
  assert.equal(isLinkedInShortLink("https://www.linkedin.com/posts/x"), false);

  const realFetch = globalThis.fetch;
  const seen: Array<{ url: string; method?: string; redirect?: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), method: init?.method, redirect: init?.redirect });
    return new Response(null, {
      status: 301,
      headers: {
        location:
          "https://www.linkedin.com/posts/rajni_hiring-share-7531569171604758528-a44O/?utm_source=share&rcm=ACoAAF2",
      },
    });
  }) as typeof fetch;
  try {
    const expanded = await expandLinkedInShortLink("https://lnkd.in/p/g-YzbFzC");
    assert.equal(expanded, "https://www.linkedin.com/posts/rajni_hiring-share-7531569171604758528-a44O");
    assert.equal(seen.length, 1, "only the short link is requested; the LinkedIn page is never fetched");
    assert.equal(seen[0].method, "HEAD");
    assert.equal(seen[0].redirect, "manual");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("provider text with broken HTML entities is decoded; share- slugs give clean topics", async () => {
  const { decodeHtmlText, inferTopicsFromPostUrl } = await import("../data/linkedin-urls");
  assert.equal(decodeHtmlText("Full-Stack amp; Backend"), "Full-Stack & Backend");
  assert.equal(decodeHtmlText("R&amp;D &quot;lead&quot; &#39;x&#39;"), `R&D "lead" 'x'`);
  assert.deepEqual(
    inferTopicsFromPostUrl("https://www.linkedin.com/posts/rajni_hiring-internship-share-7531569171604758528-a44O"),
    ["hiring", "internship"]
  );
});

test("non-school seeds still produce role-based lookalike queries", () => {
  const seed = {
    id: "commenter-1",
    name: "Dev Seed",
    currentRole: "Java Backend Developer (Spring)",
    headline: "Java Backend Developer (Spring) | Microservices",
    location: null,
    schoolEcosystemIndicators: [],
    relevanceScore: 12,
  } as unknown as AnalyzedCommenter;
  const qs = buildLookalikeQueries([seed]);
  assert.equal(qs.length, 1);
  assert.ok(qs[0].query.includes('"Java Backend Developer"'), qs[0].query);
});

test("avatar extraction handles Apify shapes, CSV imports, and ignores LinkedIn ghost placeholders", () => {
  const posts = [fakePost("7300000000000000001")];
  const records = mapApifyComments(
    [
      {
        type: "comment",
        postId: "7300000000000000001",
        commentary: "Hello",
        actor: {
          name: "Real Pic",
          linkedinUrl: "https://www.linkedin.com/in/real-pic",
          pictureUrl: "https://media.licdn.com/dms/image/v2/real.jpg",
        },
      },
      {
        type: "comment",
        postId: "7300000000000000001",
        commentary: "Ghost",
        actor: {
          name: "Ghost Pic",
          linkedinUrl: "https://www.linkedin.com/in/ghost-pic",
          pictureUrl: "https://static.licdn.com/aero-v1/sc/h/ghost-person.png",
        },
      },
    ],
    posts
  );
  assert.equal(records[0].avatarUrl, "https://media.licdn.com/dms/image/v2/real.jpg");
  assert.equal(records[1].avatarUrl, undefined);

  const csvRows = parseImportedCommenters(
    `name,linkedin_url,profile_pic,comment\nAnita,https://www.linkedin.com/in/anita,https://media.licdn.com/anita.jpg,Hi`
  );
  assert.equal(csvRows[0].avatarUrl, "https://media.licdn.com/anita.jpg");
});
