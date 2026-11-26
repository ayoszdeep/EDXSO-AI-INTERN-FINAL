import { NextRequest, NextResponse } from "next/server";
import { runDiscoveryPipeline } from "@/lib/engine/pipeline";
import { DiscoveryRequest } from "@/lib/types";

// Live runs call the search index, the comments provider (up to ~50s) and Gemini.
export const maxDuration = 60;

const MAX_IMPORTED_ROWS = 2000;

function str(v: unknown, max = 2000): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DiscoveryRequest>;
    const mode = body.mode === "post_url" ? "post_url" : "keyword";
    const dataSource =
      body.dataSource === "labelled_test_dataset" ||
      body.dataSource === "authorized_provider" ||
      body.dataSource === "supplied_url_manual"
        ? body.dataSource
        : undefined;

    const commenters = Array.isArray(body.manualInput?.commenters)
      ? body.manualInput.commenters.slice(0, MAX_IMPORTED_ROWS).filter((c) => c && typeof c.name === "string")
      : [];

    const discoveryRequest: DiscoveryRequest = {
      mode,
      query: str(body.query, 200) ?? "K12 B2B Sales",
      postUrl: str(body.postUrl, 1000),
      dataSource,
      maxPosts: Math.min(Math.max(Number(body.maxPosts) || 5, 1), 10),
      maxLookalikes: Math.min(Math.max(Number(body.maxLookalikes) || 12, 1), 30),
      manualInput: body.manualInput ? { ...body.manualInput, commenters } : undefined,
      apiKeys: {
        geminiApiKey: str(body.apiKeys?.geminiApiKey, 200),
        serperApiKey: str(body.apiKeys?.serperApiKey, 200),
        tavilyApiKey: str(body.apiKeys?.tavilyApiKey, 200),
        apifyApiToken: str(body.apiKeys?.apifyApiToken, 200),
      },
    };

    const result = await runDiscoveryPipeline(discoveryRequest);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run discovery workflow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const postUrl = searchParams.get("url") ?? undefined;
    const query = searchParams.get("query") ?? "K12 B2B Sales";
    const source = searchParams.get("source");

    const result = await runDiscoveryPipeline({
      mode: postUrl ? "post_url" : "keyword",
      query,
      postUrl,
      dataSource:
        source === "live" ? "authorized_provider" : source === "test" ? "labelled_test_dataset" : undefined,
      maxPosts: 5,
      maxLookalikes: 12,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run discovery workflow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
