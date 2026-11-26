import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "edxso-linkedin-discovery",
    timestamp: new Date().toISOString(),
    // Booleans only: key values are never exposed
    providersConfigured: {
      serper: Boolean(process.env.SERPER_API_KEY?.trim()),
      tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
      apify: Boolean(process.env.APIFY_API_TOKEN?.trim()),
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    },
  });
}
