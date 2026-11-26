import { AnalyzedCommenter } from "@/lib/types";

/**
 * Lookalike candidate sourcing for live runs.
 *
 * From the strongest seed commenters we derive role/persona phrases (e.g.
 * "former principal", "school consultant", "trustee") plus their location,
 * and run public profile searches such as:
 *
 *   site:linkedin.com/in "former principal" (school OR K12) Pune
 *
 * Each query remembers which seed(s) produced it, so every lookalike keeps a
 * trace back to the commenter(s) that led to it.
 */

const INDICATOR_PHRASES: Record<string, string[]> = {
  "Former Principal": ["former principal", "retired principal"],
  "School Principal": ["principal"],
  "Trustee / School Owner": ["trustee", "school owner"],
  "School Director": ["school director"],
  "School & Education Advisor": ["school consultant", "education consultant"],
  "Education Entrepreneur": ["education entrepreneur", "founder"],
  "Multi-School Network": ["school network", "group of schools"],
  "Decision-Maker Access": ["school partnerships"],
  "K12 B2B / EdTech Partnerships": ["K12 sales", "school partnerships"],
  "K12 Boards & NEP 2020": ["CBSE", "academic consultant"],
};

const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(former|retired|ex[-\s]?)\s*principal\b/i, "former principal"],
  [/\bvice[-\s]principal\b/i, "vice principal"],
  [/\bprincipal\b/i, "principal"],
  [/\bhead of school\b/i, "head of school"],
  [/\b(managing\s+)?trustee\b/i, "trustee"],
  [/\bschool\s+owner\b/i, "school owner"],
  [/\b(school|academic)\s+director\b/i, "school director"],
  [/\bchairman|chairperson\b/i, "chairman school"],
  [/\b(school|education|academic|k12)\s+(consultant|advisor|adviser)\b/i, "school consultant"],
  [/\b(consultant|advisor|adviser)\b/i, "education consultant"],
  [/\bco-?founder|founder\b/i, "founder"],
  [/\b(k-?12|school)\s+(sales|partnerships?|business development|bd)\b/i, "K12 sales"],
  [/\b(sales|business development|partnerships?)\b/i, "school partnerships"],
  [/\bcurriculum\b/i, "curriculum head"],
  [/\bacademic\s+head|dean\b/i, "academic head"],
  [/\bcoordinator\b/i, "school coordinator"],
];

export interface LookalikeQuery {
  query: string;
  seedIds: string[];
  seedNames: string[];
}

function rolePhrasesFor(seed: AnalyzedCommenter): string[] {
  const phrases: string[] = [];
  const roleText = `${seed.currentRole} ${seed.headline}`;
  for (const [re, phrase] of ROLE_PATTERNS) {
    if (re.test(roleText)) phrases.push(phrase);
  }
  for (const ind of seed.schoolEcosystemIndicators) {
    const key = ind.startsWith("Multi-School") ? "Multi-School Network" : ind;
    phrases.push(...(INDICATOR_PHRASES[key] ?? []));
  }
  return Array.from(new Set(phrases));
}

function locationTerm(seed: AnalyzedCommenter): string {
  if (!seed.location) return "";
  const first = seed.location.split(",")[0]?.trim() ?? "";
  return /^[\p{L}\s.'-]{2,40}$/u.test(first) ? first : "";
}

export function buildLookalikeQueries(
  seeds: AnalyzedCommenter[],
  maxQueries = 5
): LookalikeQuery[] {
  const ranked = [...seeds].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 8);
  const byQuery = new Map<string, LookalikeQuery>();

  for (const seed of ranked) {
    const phrases = rolePhrasesFor(seed);
    if (phrases.length === 0) continue;
    const loc = locationTerm(seed);
    const primary = phrases[0];
    const domain = /school|k12|principal|trustee|cbse/i.test(primary) ? "" : " (school OR K12)";
    const query = `site:linkedin.com/in "${primary}"${domain}${loc ? ` ${loc}` : ""}`;
    const existing = byQuery.get(query);
    if (existing) {
      existing.seedIds.push(seed.id);
      existing.seedNames.push(seed.name);
    } else {
      byQuery.set(query, { query, seedIds: [seed.id], seedNames: [seed.name] });
    }
    if (byQuery.size >= maxQueries) break;
  }

  // If seeds share one phrase, add a second-phrase query from the top seed for diversity
  if (byQuery.size < Math.min(3, maxQueries) && ranked[0]) {
    const top = ranked[0];
    for (const phrase of rolePhrasesFor(top).slice(1, 3)) {
      const query = `site:linkedin.com/in "${phrase}" (school OR K12)`;
      if (!byQuery.has(query)) byQuery.set(query, { query, seedIds: [top.id], seedNames: [top.name] });
      if (byQuery.size >= maxQueries) break;
    }
  }

  return Array.from(byQuery.values());
}
