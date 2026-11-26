import { ImportedCommenter } from "@/lib/types";
import { cleanAvatarUrl, cleanLinkedInUrl, isValidLinkedInProfileUrl, splitHeadline } from "@/lib/data/linkedin-urls";

/**
 * Parses user-supplied commenter records. Pure function shared by the browser
 * (live preview count) and the server (actual run). Accepted formats:
 *
 * 1. JSON array, flat rows:  [{ "name", "linkedinUrl", "role", "organization", "location", "comment", "postUrl" }]
 * 2. JSON array in the Apify/HarvestAPI comment shape: [{ actor: { name, linkedinUrl, position }, commentary, ... }]
 * 3. CSV with a header row (column names are matched loosely, e.g. "Profile URL", "linkedin_url").
 * 4. Pipe-delimited lines:  Name | LinkedIn URL | Role | Organization | Location | Comment | Post URL
 * 5. Text copied straight from a LinkedIn comment section (names, headlines, comments).
 *    Copied text carries no profile links, so those rows have linkedinUrl = "".
 *
 * Never invents data: unknown fields stay empty.
 */
export function parseImportedCommenters(raw: string): ImportedCommenter[] {
  const trimmed = (raw ?? "").replace(/^﻿/, "").trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed);
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0] ?? "";

  if (firstLine.includes("|") && looksLikePipeRows(lines)) {
    return finalize(lines.map(parsePipeLine));
  }

  if (looksLikeCsvHeader(firstLine)) {
    return finalize(parseCsv(trimmed));
  }

  return finalize(parseCopiedLinkedInText(trimmed));
}

type Row = Record<string, unknown>;

const FIELD_ALIASES: Record<keyof ImportedCommenter, string[]> = {
  name: ["name", "fullname", "full name", "commenter", "commentername", "author", "authorname"],
  linkedinUrl: [
    "linkedinurl",
    "linkedin_url",
    "linkedin url",
    "profileurl",
    "profile_url",
    "profile url",
    "profile",
    "url",
    "linkedin",
  ],
  avatarUrl: [
    "avatarurl",
    "avatar_url",
    "avatar url",
    "avatar",
    "pictureurl",
    "picture_url",
    "picture url",
    "picture",
    "photourl",
    "photo_url",
    "photo url",
    "photo",
    "profilepic",
    "profile_pic",
    "profile pic",
    "profilepicture",
    "profile_picture",
    "imageurl",
    "image_url",
    "dp",
  ],
  currentRole: ["currentrole", "current_role", "role", "title", "jobtitle", "job title", "position"],
  organization: ["organization", "organisation", "org", "company", "companyname", "employer"],
  location: ["location", "city", "region", "geo"],
  headline: ["headline", "tagline", "occupation"],
  commentText: ["commenttext", "comment_text", "comment", "commentary", "text", "content"],
  postUrl: ["posturl", "post_url", "post url", "post", "sourcepost", "source post"],
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-]+/g, " ").trim();
}

function pickField(row: Row, field: keyof ImportedCommenter): string {
  const aliases = FIELD_ALIASES[field].map(normalizeKey);
  for (const [key, value] of Object.entries(row)) {
    const nk = normalizeKey(key);
    if (aliases.includes(nk) || aliases.includes(nk.replace(/\s/g, ""))) {
      if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
      }
    }
  }
  return "";
}

function rowToCommenter(row: Row): ImportedCommenter {
  // Apify / HarvestAPI shape: { actor: { name, linkedinUrl, position }, commentary, postId }
  const actor = (row.actor ?? row.author) as Row | undefined;
  if (actor && typeof actor === "object") {
    const headline = String(actor.position ?? actor.headline ?? "").trim();
    const split = splitHeadline(headline);
    const avatarUrl =
      cleanAvatarUrl(actor.pictureUrl) ??
      cleanAvatarUrl(actor.picture) ??
      cleanAvatarUrl(actor.avatarUrl) ??
      cleanAvatarUrl(actor.avatar) ??
      cleanAvatarUrl(actor.profilePicture) ??
      cleanAvatarUrl(actor.photoUrl) ??
      cleanAvatarUrl(actor.imageUrl);
    return {
      name: String(actor.name ?? "").trim(),
      linkedinUrl: String(actor.linkedinUrl ?? actor.profileUrl ?? actor.url ?? "").trim(),
      avatarUrl,
      headline,
      currentRole: split.role,
      organization: split.organization,
      commentText: String(row.commentary ?? row.text ?? row.comment ?? "").trim(),
      postUrl: String(row.postUrl ?? row.post_url ?? "").trim(),
    };
  }

  const headline = pickField(row, "headline");
  const split = splitHeadline(headline);
  return {
    name: pickField(row, "name"),
    linkedinUrl: pickField(row, "linkedinUrl"),
    avatarUrl: cleanAvatarUrl(pickField(row, "avatarUrl")),
    currentRole: pickField(row, "currentRole") || split.role,
    organization: pickField(row, "organization") || split.organization,
    location: pickField(row, "location"),
    headline,
    commentText: pickField(row, "commentText"),
    postUrl: pickField(row, "postUrl"),
  };
}

function parseJson(text: string): ImportedCommenter[] {
  const parsed = JSON.parse(text) as unknown;
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Row).commenters)
      ? ((parsed as Row).commenters as unknown[])
      : Array.isArray((parsed as Row).original_commenters)
        ? ((parsed as Row).original_commenters as unknown[])
        : [parsed];
  return finalize(
    rows
      .filter((r): r is Row => Boolean(r) && typeof r === "object")
      .map(rowToCommenter)
  );
}

function looksLikePipeRows(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim());
  const withPipes = nonEmpty.filter((l) => l.split("|").length >= 2);
  return withPipes.length >= Math.ceil(nonEmpty.length * 0.6);
}

function parsePipeLine(line: string): ImportedCommenter {
  const parts = line.split("|").map((p) => p.trim());
  return {
    name: parts[0] || "",
    linkedinUrl: parts[1] || "",
    currentRole: parts[2] || "",
    organization: parts[3] || "",
    location: parts[4] || "",
    commentText: parts[5] || "",
    postUrl: parts[6] || "",
  };
}

function looksLikeCsvHeader(line: string): boolean {
  if (!line.includes(",") && !line.includes("\t")) return false;
  const cells = splitCsvLine(line, line.includes("\t") ? "\t" : ",").map(normalizeKey);
  const known = new Set(
    Object.values(FIELD_ALIASES)
      .flat()
      .map(normalizeKey)
  );
  return cells.some((c) => known.has(c) || known.has(c.replace(/\s/g, "")));
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Splits CSV text into logical records, honouring newlines inside quoted cells. */
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (cur.trim()) records.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) records.push(cur);
  return records;
}

function parseCsv(text: string): ImportedCommenter[] {
  const records = splitCsvRecords(text);
  if (records.length < 2) return [];
  const delimiter = records[0].includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(records[0], delimiter);
  return records.slice(1).map((record) => {
    const cells = splitCsvLine(record, delimiter);
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return rowToCommenter(row);
  });
}

const UI_NOISE =
  /^(like|reply|replies|load more comments|load previous replies|see more|see translation|report|author|top contributor|most relevant|most recent|\d+\s+(repl(y|ies)|reactions?|likes?)|\d+)$/i;
const TIMESTAMP = /^(\d+\s*(s|m|h|d|w|mo|yr|y)|\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago|edited|\(edited\))(\s*•?\s*edited)?$/i;
const CONNECTION_DEGREE = /^[•·]?\s*(1st|2nd|3rd\+?|3rd|you|following|follow)$/i;

/**
 * Heuristic parser for text selected and copied from a LinkedIn comment
 * section. A comment block looks like:
 *
 *   Jane Doe
 *   • 2nd
 *   Former Principal at ABC School | Consultant
 *   3d
 *   Great insight on trustee buy-in...
 *   Like
 *   Reply
 */
function parseCopiedLinkedInText(text: string): ImportedCommenter[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ImportedCommenter[] = [];
  let i = 0;
  while (i < lines.length) {
    // A block starts with a name followed (within 2 lines) by a degree marker or timestamp.
    const name = lines[i];
    const next = lines[i + 1] ?? "";
    const isNameLine =
      !UI_NOISE.test(name) &&
      !TIMESTAMP.test(name) &&
      !CONNECTION_DEGREE.test(name) &&
      name.length <= 80 &&
      (CONNECTION_DEGREE.test(next) ||
        /^.+\s[•·]\s*(1st|2nd|3rd\+?)$/i.test(name) ||
        TIMESTAMP.test(lines[i + 2] ?? "") ||
        TIMESTAMP.test(lines[i + 3] ?? ""));

    if (!isNameLine) {
      i++;
      continue;
    }

    let j = i + 1;
    let linkedinUrl = "";
    const cleanName = name.replace(/\s[•·]\s*(1st|2nd|3rd\+?).*$/i, "").trim();
    while (j < lines.length && CONNECTION_DEGREE.test(lines[j])) j++;

    let headline = "";
    if (j < lines.length && !TIMESTAMP.test(lines[j])) {
      headline = lines[j];
      j++;
    }
    while (j < lines.length && TIMESTAMP.test(lines[j])) j++;

    const commentLines: string[] = [];
    while (j < lines.length && !/^(like|reply)$/i.test(lines[j])) {
      const urlMatch = lines[j].match(/https?:\/\/[^\s]*linkedin\.com\/in\/[^\s)]+/i);
      if (urlMatch && !linkedinUrl) linkedinUrl = urlMatch[0];
      else commentLines.push(lines[j]);
      j++;
      if (commentLines.length > 40) break;
    }
    while (j < lines.length && (UI_NOISE.test(lines[j]) || /^[|·•]$/.test(lines[j]))) j++;

    const split = splitHeadline(headline);
    results.push({
      name: cleanName,
      linkedinUrl,
      headline,
      currentRole: split.role,
      organization: split.organization,
      commentText: commentLines.join(" ").trim(),
    });
    i = Math.max(j, i + 1);
  }
  return results;
}

function finalize(rows: ImportedCommenter[]): ImportedCommenter[] {
  return rows
    .map((r) => ({
      ...r,
      name: (r.name ?? "").trim(),
      linkedinUrl: isValidLinkedInProfileUrl(r.linkedinUrl ?? "")
        ? cleanLinkedInUrl(r.linkedinUrl)
        : "",
      avatarUrl: cleanAvatarUrl(r.avatarUrl),
    }))
    .filter((r) => r.name.length > 1 && !/^(name|full name)$/i.test(r.name));
}
