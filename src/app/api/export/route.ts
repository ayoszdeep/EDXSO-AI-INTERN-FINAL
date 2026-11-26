import { NextRequest, NextResponse } from "next/server";
import { exportResultToCsv, exportResultToJson } from "@/lib/engine/exporter";
import { runDiscoveryPipeline } from "@/lib/engine/pipeline";
import { DiscoveryRequest, DiscoveryResult } from "@/lib/types";

interface ExportRequestBody {
  format?: "csv" | "json";
  result?: DiscoveryResult;
  query?: DiscoveryRequest;
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    const format = body.format === "csv" ? "csv" : "json";

    const result =
      body.result ??
      (await runDiscoveryPipeline(
        body.query ?? { mode: "keyword", query: "K12 B2B Sales", maxPosts: 5 }
      ));

    if (format === "csv") {
      const csv = exportResultToCsv(result);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="edxso-prospects-${result.runId}.csv"`,
        },
      });
    }

    const json = exportResultToJson(result);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="edxso-prospects-${result.runId}.json"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
