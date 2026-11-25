import fs from "node:fs";
import path from "node:path";
import { exportResultToCsv, exportResultToJson } from "../lib/engine/exporter";
import { runDiscoveryPipeline } from "../lib/engine/pipeline";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`
EDXSO LinkedIn Engagement & Lookalike Profile Discovery CLI

Usage:
  npm run cli -- --query "K12 B2B Sales"
  npm run cli -- --url "https://www.linkedin.com/posts/..."
  npm run cli -- --query "K12 B2B Sales" --format csv --out output.csv

Options:
  --query <phrase>         Keyword/phrase for post discovery (default: "K12 B2B Sales")
  --url <linkedin_url>     Direct LinkedIn post URL to analyze
  --max-posts <number>     Number of posts to discover (default: 5)
  --max-lookalikes <num>   Max lookalikes to return (default: 12)
  --format <json|csv>      Output export format (default: summary, or json/csv with --out)
  --out <filepath>         Write full export to disk
  --help                   Show this help message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    printHelp();
    process.exit(0);
  }

  const mode = args.url ? "post_url" : "keyword";
  const result = await runDiscoveryPipeline({
    mode,
    query: args.query ?? "K12 B2B Sales",
    postUrl: args.url,
    maxPosts: args["max-posts"] ? Number(args["max-posts"]) : 5,
    maxLookalikes: args["max-lookalikes"] ? Number(args["max-lookalikes"]) : 12,
  });

  if (args.out) {
    const format = args.format === "csv" || args.out.endsWith(".csv") ? "csv" : "json";
    const serialized =
      format === "csv" ? exportResultToCsv(result) : exportResultToJson(result);
    const resolved = path.resolve(process.cwd(), args.out);
    fs.writeFileSync(resolved, serialized, "utf8");
    console.log(`Exported ${format.toUpperCase()} results to ${resolved}`);
  } else if (args.format === "json") {
    console.log(exportResultToJson(result));
    return;
  } else if (args.format === "csv") {
    console.log(exportResultToCsv(result));
    return;
  }

  console.log("\n=== EDXSO LinkedIn Discovery Run ===");
  console.log(`Run ID:       ${result.runId}`);
  console.log(`Input Mode:   ${result.inputMode} (${result.queryOrUrl})`);
  console.log(`Data Source:  ${result.dataSource} (testData=${result.isTestData})`);
  console.log(`AI Engine:    ${result.aiMethod}`);
  console.log(`Posts Found:  ${result.stats.postsFound}`);
  console.log(
    `Commenters:   ${result.stats.uniqueCommenters} unique (${result.stats.deduplicatedDuplicatesRemoved} duplicates merged)`
  );
  console.log(`Lookalikes:   ${result.stats.lookalikesDiscovered}`);

  console.log("\n--- Discovered Posts ---");
  result.posts.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.authorName} (${p.publishedAt.slice(0, 10)})`);
    console.log(`   URL: ${p.url}`);
    console.log(`   Snippet: ${p.snippet}`);
  });

  console.log("\n--- Top Ranked Original Commenters ---");
  result.commenters.slice(0, 5).forEach((c, idx) => {
    console.log(
      `${idx + 1}. [${c.relevanceScore}/100] ${c.name} — ${c.currentRole} @ ${c.organization}`
    );
    console.log(`   URL: ${c.linkedinUrl}`);
    console.log(`   Posts commented (${c.commentCount}): ${c.associatedPostUrls.join(", ")}`);
  });

  console.log("\n--- Top Ranked AI-Discovered Lookalikes ---");
  result.lookalikes.slice(0, 5).forEach((l, idx) => {
    const topSeed = l.seedProfiles[0];
    console.log(
      `${idx + 1}. [${l.relevanceScore}/100 | ${l.similarityScore}% sim] ${l.name} — ${l.currentRole} @ ${l.organization}`
    );
    console.log(`   URL: ${l.linkedinUrl}`);
    if (topSeed) {
      console.log(`   Seed Trace: ${topSeed.seedCommenterName} (${topSeed.similarityScore}%)`);
    }
  });
}

main().catch((err) => {
  console.error("CLI Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
