import { NextRequest, NextResponse } from "next/server";
import { runDiscoveryPipeline } from "@/lib/engine/pipeline";
import { DiscoveryRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DiscoveryRequest>;

    const mode = body.mode === "post_url" ? "post_url" : "keyword";
    const discoveryRequest: DiscoveryRequest = {
      mode,
      query: body.query ?? "K12 B2B Sales",
      postUrl: body.postUrl,
      dataSource: body.dataSource,
      maxPosts: body.maxPosts ?? 5,
      maxLookalikes: body.maxLookalikes ?? 12,
      manualInput: body.manualInput,
      apiKeys: body.apiKeys,
    };

    const result = await runDiscoveryPipeline(discoveryRequest);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run discovery workflow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const postUrl = searchParams.get("url") ?? undefined;
    const query = searchParams.get("query") ?? "K12 B2B Sales";

    const result = await runDiscoveryPipeline({
      mode: postUrl ? "post_url" : "keyword",
      query,
      postUrl,
      maxPosts: 5,
      maxLookalikes: 12,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run discovery workflow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
