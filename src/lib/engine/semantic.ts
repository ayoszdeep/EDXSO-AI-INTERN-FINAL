/**
 * Semantic Embedding & Similarity Engine
 *
 * Combines:
 * 1. A 12-dimensional domain-grounded K12 Education Ecosystem Concept Embedding
 *    (handles synonymy & semantic equivalence beyond exact keyword matching).
 * 2. Normalized token + bigram TF-cosine similarity for nuanced textual overlap.
 * 3. Optional live LLM / Embedding enrichment (Gemini / OpenAI) when configured.
 */

export const EMBEDDING_DIMENSIONS = [
  "School Leadership & Former Principals",
  "Trustee, Owner & Board Governance",
  "School & Education Consulting",
  "Multi-School Network Reach",
  "K12 B2B GTM & Procurement",
  "Decision-Maker Relationships",
  "Education Entrepreneurship",
  "Curriculum, Accreditation & NEP",
  "K12 Domain Specificity",
  "Regional & Tier-2/3 Presence",
  "Higher-Ed Drift Penalty",
  "Non-School Corporate/B2C Drift",
] as const;

interface ConceptSpec {
  dimension: (typeof EMBEDDING_DIMENSIONS)[number];
  phrases: Array<{ pattern: RegExp; weight: number }>;
}

const CONCEPT_SPECS: ConceptSpec[] = [
  {
    dimension: "School Leadership & Former Principals",
    phrases: [
      { pattern: /\b(former|retired|ex[-\s]?)\s*(cbse|icse|ib|sainik|school)?\s*principal\b/gi, weight: 2.2 },
      { pattern: /\bprincipal\b/gi, weight: 1.4 },
      { pattern: /\b(head of school|academic head|dean|vice principal|school head)\b/gi, weight: 1.3 },
    ],
  },
  {
    dimension: "Trustee, Owner & Board Governance",
    phrases: [
      { pattern: /\b(managing\s+trustee|trustee|chairman|chairperson|school\s+owner|promoter)\b/gi, weight: 2.0 },
      { pattern: /\b(school\s+director|executive\s+director|governing\s+board|board\s+member|education\s+society)\b/gi, weight: 1.6 },
      { pattern: /\btrust\b/gi, weight: 0.9 },
    ],
  },
  {
    dimension: "School & Education Consulting",
    phrases: [
      { pattern: /\b(school|education|k12|k-12|academic)\s+(consultant|advisor|mentor|auditor)\b/gi, weight: 2.0 },
      { pattern: /\b(advisory|consulting|audit|transformation|accreditation|affiliation|setup)\b/gi, weight: 1.2 },
      { pattern: /\b(advisor|consultant|mentor)\b/gi, weight: 0.9 },
    ],
  },
  {
    dimension: "Multi-School Network Reach",
    phrases: [
      { pattern: /\b(multi[-\s]?school|multi[-\s]?campus|school\s+chain|school\s+group|consortium|federation|association|guild|alliance|collective)\b/gi, weight: 2.0 },
      { pattern: /\b(\d{1,4})\+?\s*(k12\s+)?(schools|campuses|institutions|principals)\b/gi, weight: 2.1 },
      { pattern: /\b(network|cluster|chapters|symposiums)\b/gi, weight: 1.1 },
    ],
  },
  {
    dimension: "K12 B2B GTM & Procurement",
    phrases: [
      { pattern: /\b(k12|k-12)\s*(b2b|saas|sales|gtm|edtech|procurement|distribution|partnerships)\b/gi, weight: 2.0 },
      { pattern: /\b(b2b|channel|distribution|erp|lms|edtech|vendor|pilots|procurement)\b/gi, weight: 1.2 },
      { pattern: /\bsales\b/gi, weight: 0.8 },
    ],
  },
  {
    dimension: "Decision-Maker Relationships",
    phrases: [
      { pattern: /\b(decision[-\s]?maker|trustee\s+review|boardroom|roundtable|conclave|warm\s+intro|peer\s+validation|reference\s+principals)\b/gi, weight: 1.9 },
      { pattern: /\b(trustees|school\s+owners|principals|founders|promoters)\b/gi, weight: 1.1 },
    ],
  },
  {
    dimension: "Education Entrepreneurship",
    phrases: [
      { pattern: /\b(education\s+entrepreneur|eduventures|edupreneurs|edtech\s+founder)\b/gi, weight: 2.1 },
      { pattern: /\b(founder|co-founder|managing\s+partner|ceo)\b/gi, weight: 1.0 },
    ],
  },
  {
    dimension: "Curriculum, Accreditation & NEP",
    phrases: [
      { pattern: /\b(cbse|icse|ib|cambridge|nep\s*2020|ncf|stem\s+labs?|pedagogy|teacher\s+(training|capacity|upskilling)|curriculum)\b/gi, weight: 1.4 },
    ],
  },
  {
    dimension: "K12 Domain Specificity",
    phrases: [
      { pattern: /\b(k12|k-12|schools?|campuses?|classroom|teachers?|students?)\b/gi, weight: 1.2 },
    ],
  },
  {
    dimension: "Regional & Tier-2/3 Presence",
    phrases: [
      { pattern: /\b(tier[-\s]?2|tier[-\s]?3|district|regional|state|north\s+india|south\s+india|east\s+india|west\s+india|pan-india)\b/gi, weight: 1.3 },
    ],
  },
  {
    dimension: "Higher-Ed Drift Penalty",
    phrases: [
      { pattern: /\b(university|higher\s+education|naac|undergraduate|postgraduate|assistant\s+professor|college\s+admissions)\b/gi, weight: 2.2 },
    ],
  },
  {
    dimension: "Non-School Corporate/B2C Drift",
    phrases: [
      { pattern: /\b(corporate\s+l&d|workforce\s+skilling|banking|jee\/neet|competitive\s+exam|b2c\s+online|youtube\s+growth)\b/gi, weight: 2.2 },
    ],
  },
];

// Ideal EDXSO target vector across the 12 dimensions (emphasizes school leadership,
// trustees/owners, consultants, multi-school reach, and decision-maker access;
// penalizes higher-ed and corporate/B2C drift).
export const EDXSO_IDEAL_TARGET_VECTOR = [
  0.38, // School Leadership & Former Principals
  0.38, // Trustee, Owner & Board Governance
  0.38, // School & Education Consulting
  0.42, // Multi-School Network Reach
  0.30, // K12 B2B GTM & Procurement
  0.36, // Decision-Maker Relationships
  0.28, // Education Entrepreneurship
  0.20, // Curriculum, Accreditation & NEP
  0.30, // K12 Domain Specificity
  0.14, // Regional & Tier-2/3 Presence
  -0.45, // Higher-Ed Drift Penalty
  -0.45, // Non-School Corporate/B2C Drift
];

export function computeConceptEmbedding(text: string): number[] {
  const raw = CONCEPT_SPECS.map((spec) => {
    let score = 0;
    for (const rule of spec.phrases) {
      const matches = text.match(rule.pattern);
      if (matches && matches.length > 0) {
        // Sublinear saturation so repeating a word doesn't dominate
        score += rule.weight * (1 + Math.log1p(matches.length - 1) * 0.45);
      }
    }
    return score;
  });

  return l2Normalize(raw);
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec.map(() => 0);
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "across",
  "who",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "about",
  "what",
  "when",
  "where",
  "how",
  "their",
  "they",
  "our",
  "your",
  "more",
  "than",
  "also",
  "now",
  "test",
  "fixture",
]);

const SYNONYM_MAP: Record<string, string[]> = {
  k12: ["school", "schools", "cbse", "icse", "campus", "k-12"],
  "k-12": ["k12", "school", "schools"],
  b2b: ["enterprise", "institutional", "procurement", "partnerships", "vendor"],
  sales: ["gtm", "partnerships", "channel", "distribution", "revenue", "procurement"],
  principal: ["head", "academic", "director", "leadership"],
  trustee: ["chairman", "owner", "board", "promoter", "governance"],
  consultant: ["advisor", "mentor", "auditor", "advisory"],
  edtech: ["erp", "lms", "education", "technology", "digital"],
};

export function tokenizeNormalized(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const expanded: string[] = [];
  for (const token of tokens) {
    expanded.push(token);
    const syns = SYNONYM_MAP[token];
    if (syns) {
      for (const s of syns) {
        expanded.push(s);
      }
    }
  }
  return expanded;
}

export function computeTokenCosineSimilarity(textA: string, textB: string): number {
  const tokensA = tokenizeNormalized(textA);
  const tokensB = tokenizeNormalized(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const t of tokensA) freqA.set(t, (freqA.get(t) ?? 0) + 1);
  for (const t of tokensB) freqB.set(t, (freqB.get(t) ?? 0) + 1);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, countA] of freqA.entries()) {
    const wA = 1 + Math.log(countA);
    normA += wA * wA;
    const countB = freqB.get(term);
    if (countB) {
      const wB = 1 + Math.log(countB);
      dot += wA * wB;
    }
  }

  for (const countB of freqB.values()) {
    const wB = 1 + Math.log(countB);
    normB += wB * wB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Blended semantic similarity combining 12-dim K12 concept embeddings
 * and synonym-expanded token cosine similarity.
 */
export function computeTextSimilarity(textA: string, textB: string): number {
  const embA = computeConceptEmbedding(textA);
  const embB = computeConceptEmbedding(textB);
  const conceptSim = Math.max(0, cosineSimilarity(embA, embB));
  const tokenSim = computeTokenCosineSimilarity(textA, textB);
  return Math.min(1, conceptSim * 0.58 + tokenSim * 0.42);
}

/**
 * Optional Gemini embedding/reasoning helper when user provides GEMINI_API_KEY.
 * Gracefully falls back to local semantic engine if unavailable or rate-limited.
 */
export async function tryGeminiSemanticSummary(
  prompt: string,
  apiKey?: string
): Promise<string | null> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
        key
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function tryOpenAiSemanticSummary(
  prompt: string,
  apiKey?: string
): Promise<string | null> {
  const key = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 256,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
