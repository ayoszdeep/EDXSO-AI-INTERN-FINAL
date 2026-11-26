import { AiClassification } from "@/lib/types";
import { TtlCache } from "@/lib/data/providers/cache";

/**
 * Google Gemini integration:
 *  - text embeddings for seed <-> candidate semantic similarity
 *  - zero-shot JSON classification of each profile against EDXSO's target personas
 *
 * Model ids change often, so instead of hard-coding one we list the models the
 * key can access and pick the newest stable Flash + embedding models.
 * Override with GEMINI_MODEL / GEMINI_EMBEDDING_MODEL.
 * Every call fails soft: on any error the caller keeps the local semantic score.
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
interface ModelChoice {
  /** Ordered candidates for text generation; tried until one answers. */
  generate: string[];
  embed: string | null;
}
const modelCache = new TtlCache<ModelChoice>(60 * 60 * 1000, 20);
/** First generation model that answered for a key, so later calls skip dead/overloaded ones. */
const workingModel = new TtlCache<string>(30 * 60 * 1000, 20);

export function resolveGeminiKey(key?: string): string | undefined {
  return key?.trim() || process.env.GEMINI_API_KEY?.trim() || undefined;
}

function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Orders text models for a short JSON classification task. Flash-Lite comes
 * first: in testing it answered in 2-5 s while the newest full Flash models
 * were often overloaded (503) or slower than the serverless time budget.
 */
export function pickModels(
  models: Array<{ name: string; supportedGenerationMethods?: string[] }>
): ModelChoice {
  const bare = models
    .map((m) => ({ id: m.name.replace(/^models\//, ""), methods: m.supportedGenerationMethods ?? [] }))
    .filter((m) => !/(image|tts|audio|live|thinking|exp|omni|preview)/.test(m.id));
  const canGen = bare.filter((m) => m.methods.includes("generateContent")).map((m) => m.id);
  const byVersion = (a: string, b: string) => versionOf(b) - versionOf(a);

  const ordered = [
    ...canGen.filter((id) => id === "gemini-flash-lite-latest"),
    ...canGen.filter((id) => /^gemini-\d+(\.\d+)?-flash-lite$/.test(id)).sort(byVersion),
    ...canGen.filter((id) => /^gemini-\d+(\.\d+)?-flash$/.test(id)).sort(byVersion),
    ...canGen.filter((id) => id === "gemini-flash-latest"),
  ];

  const embedAll = bare.filter((m) => m.methods.includes("embedContent") || m.methods.includes("batchEmbedContents"));
  const embed =
    embedAll.find((m) => /^gemini-embedding-\d+$/.test(m.id)) ??
    embedAll.find((m) => /gemini-embedding/.test(m.id)) ??
    embedAll.find((m) => /text-embedding/.test(m.id));
  return { generate: Array.from(new Set(ordered)).slice(0, 4), embed: embed?.id ?? null };
}

export async function resolveGeminiModels(key: string): Promise<ModelChoice> {
  const envGen = process.env.GEMINI_MODEL?.trim();
  const envEmbed = process.env.GEMINI_EMBEDDING_MODEL?.trim();
  const cacheKey = key.slice(-8);
  let picked = modelCache.get(cacheKey);
  if (!picked) {
    picked = { generate: [], embed: null };
    try {
      const res = await fetch(`${API}/models?pageSize=1000`, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
        };
        picked = pickModels(data.models ?? []);
      }
    } catch {
      // fall through with an empty choice
    }
    modelCache.set(cacheKey, picked);
  }
  const working = workingModel.get(cacheKey);
  const generate = Array.from(
    new Set([...(envGen ? [envGen] : []), ...(working ? [working] : []), ...picked.generate])
  );
  return { generate, embed: envEmbed || picked.embed };
}

/** Returns one vector per input text, or null if embeddings are unavailable. */
export async function embedTexts(texts: string[], key: string): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const { embed } = await resolveGeminiModels(key);
  if (!embed) return null;
  try {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const chunk = texts.slice(i, i + 100);
      const res = await fetch(`${API}/models/${embed}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          requests: chunk.map((text) => ({
            model: `models/${embed}`,
            content: { parts: [{ text: text.slice(0, 6000) }] },
            taskType: "SEMANTIC_SIMILARITY",
          })),
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
      const vecs = (data.embeddings ?? []).map((e) => e.values ?? []);
      if (vecs.length !== chunk.length || vecs.some((v) => v.length === 0)) return null;
      out.push(...vecs);
    }
    return out;
  } catch {
    return null;
  }
}

export interface ClassificationInput {
  id: string;
  name: string;
  headline: string;
  role: string;
  organization: string;
  location: string | null;
  context: string; // comment text or search snippet
}

const PERSONAS = [
  "School / Education Consultant or Advisor",
  "Former Principal / School Leader",
  "School Director, Owner or Trustee",
  "Education Entrepreneur",
  "School Network Professional (works with multiple schools)",
  "Has relationships with school decision-makers (e.g. K12 B2B sales/partnerships)",
  "Not a target (higher-ed, corporate, student, unrelated)",
];

export function buildClassificationPrompt(profiles: ClassificationInput[], queryContext: string): string {
  return `You are ranking LinkedIn prospects for EDXSO, which sells to K12 schools through school-network outreach.
Target personas:
${PERSONAS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Search context: "${queryContext.slice(0, 300)}"

For EACH profile below, judge ONLY from the given text (do not assume facts that are not stated):
- fitScore: integer 0-100 for how valuable this person is for EDXSO school-network outreach
- persona: the single best-matching persona label from the list above
- isSchoolEcosystem: true if they clearly work in or around K12 schools
- rationale: one sentence (max 25 words) citing the evidence

Return a JSON array of objects with keys: id, fitScore, persona, isSchoolEcosystem, rationale. Include every id exactly once.

Profiles:
${JSON.stringify(
  profiles.map((p) => ({
    id: p.id,
    name: p.name,
    headline: p.headline.slice(0, 220),
    role: p.role.slice(0, 120),
    organization: p.organization.slice(0, 120),
    location: p.location,
    context: p.context.slice(0, 400),
  }))
)}`;
}

export function parseClassificationResponse(
  text: string,
  model: string
): Map<string, AiClassification> {
  const out = new Map<string, AiClassification>();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arr = cleaned.match(/\[[\s\S]*\]/);
    if (!arr) return out;
    try {
      parsed = JSON.parse(arr[0]);
    } catch {
      return out;
    }
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const id = typeof row.id === "string" ? row.id : null;
    const score = Number(row.fitScore);
    if (!id || !Number.isFinite(score)) continue;
    out.set(id, {
      fitScore: Math.max(0, Math.min(100, Math.round(score))),
      persona: String(row.persona ?? "").slice(0, 120),
      isSchoolEcosystem: Boolean(row.isSchoolEcosystem),
      rationale: String(row.rationale ?? "").slice(0, 300),
      model,
    });
  }
  return out;
}

async function generateJson(
  model: string,
  prompt: string,
  key: string
): Promise<{ ok: true; text: string } | { ok: false; status: number | "timeout" | "error"; message: string }> {
  try {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, status: res.status, message: `${model} returned ${res.status}` };
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
    return { ok: true, text };
  } catch (err) {
    const timeout = err instanceof Error && /timeout|abort/i.test(err.message + err.name);
    return { ok: false, status: timeout ? "timeout" : "error", message: `${model} ${timeout ? "timed out" : "request failed"}` };
  }
}

export async function classifyProfiles(
  profiles: ClassificationInput[],
  queryContext: string,
  key: string
): Promise<{ results: Map<string, AiClassification>; model: string | null; error?: string }> {
  if (profiles.length === 0) return { results: new Map(), model: null };
  const { generate } = await resolveGeminiModels(key);
  if (generate.length === 0) {
    return { results: new Map(), model: null, error: "No Gemini text model available for this API key." };
  }

  const batches: ClassificationInput[][] = [];
  for (let i = 0; i < profiles.length; i += 20) batches.push(profiles.slice(i, i + 20));

  // Find a responsive model with the first batch, then run the rest in parallel on it
  let model: string | null = null;
  let firstText = "";
  const errors: string[] = [];
  for (const candidate of generate) {
    const r = await generateJson(candidate, buildClassificationPrompt(batches[0], queryContext), key);
    if (r.ok) {
      model = candidate;
      firstText = r.text;
      workingModel.set(key.slice(-8), candidate);
      break;
    }
    errors.push(r.message);
    // Auth/bad-request errors would fail for every model; stop early
    if (r.status === 400 || r.status === 401 || r.status === 403) break;
  }
  if (!model) {
    return { results: new Map(), model: null, error: `Gemini classification unavailable (${errors.join("; ")}).` };
  }

  const results = parseClassificationResponse(firstText, model);
  const chosen = model;
  const rest = await Promise.all(
    batches.slice(1).map((b) => generateJson(chosen, buildClassificationPrompt(b, queryContext), key))
  );
  for (const r of rest) {
    if (r.ok) for (const [k, v] of parseClassificationResponse(r.text, chosen)) results.set(k, v);
  }
  return { results, model };
}
