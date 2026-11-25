import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "edxso-linkedin-discovery",
    timestamp: new Date().toISOString(),
    providersConfigured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      serper: Boolean(process.env.SERPER_API_KEY),
      tavily: Boolean(process.env.TAVILY_API_KEY),
    },
  });
}
