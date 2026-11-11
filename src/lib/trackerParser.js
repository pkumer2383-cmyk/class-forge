// src/lib/trackerParser.js
// =====================================================
// ClassForge — Degree tracker parsing
// =====================================================
// A "degree tracker" is a user's set of graduation requirements,
// represented as an array of category objects:
//   {
//     id: string,
//     name: string,        // "Major Core", "General Education", etc.
//     credits: number,     // credits required to satisfy this category
//     description?: string,
//   }
//
// We accept four input formats:
//   1. CSV / TSV with at least "name" and "credits" columns
//   2. JSON: array of category objects, or { categories: [...] }
//   3. Plain text: lines like "Major: 45 credits" or "Major - 45"
//   4. PDF: extract text via pdf.js (handled in ClassForge.js), then
//      route through #3 (plain text)
// =====================================================

import { parseDelimited } from './parsers.js';

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function numberOr(v, fb = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fb;
}

// ---------- Tabular ----------

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function canonicalize(h) {
  const s = String(h || '').trim().toLowerCase();
  if (['name','category','requirement','area','title'].includes(s)) return 'name';
  if (['credits','credit','hours','units','required','required credits','min credits','minimum'].includes(s)) return 'credits';
  if (['description','desc','notes'].includes(s)) return 'description';
  return s.replace(/\s+/g, '_');
}

export function parseTrackerTabular(text, delimiter) {
  const rows = parseDelimited(text, delimiter || detectDelimiter(text));
  if (rows.length < 2) return [];
  const headers = rows[0].map(canonicalize);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = (rows[i][j] || '').trim(); });
    if (!obj.name) continue;
    const credits = numberOr(obj.credits, 0);
    if (credits <= 0) continue;
    out.push({
      id: 'req_' + slug(obj.name) + '_' + (out.length + 1),
      name: obj.name,
      credits,
      description: obj.description || '',
    });
  }
  return out;
}

// ---------- JSON ----------

export function parseTrackerJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(data)) {
    if (data && Array.isArray(data.categories)) data = data.categories;
    else if (data && Array.isArray(data.requirements)) data = data.requirements;
    else return [];
  }
  return data
    .map((c, i) => {
      const name = c.name || c.category || c.title || c.requirement;
      const credits = numberOr(c.credits ?? c.hours ?? c.units ?? c.required, 0);
      if (!name || credits <= 0) return null;
      return {
        id: c.id || ('req_' + slug(name) + '_' + (i + 1)),
        name: String(name),
        credits,
        description: c.description || c.notes || '',
      };
    })
    .filter(Boolean);
}

// ---------- Plain text ----------

// Find lines that look like "Some Category: 30 credits" or "Major - 45 hours"
// or "1. Major Requirements (45 credits)" etc.
// We take any line containing a number + a "credit/credits/hours/units" word.
const TEXT_PATTERNS = [
  // "Major Core: 30 credits"  /  "Major Core - 30 credits"
  /^(.+?)[\s]*[-:|–][\s]*(\d+(?:\.\d+)?)\s*(credits?|cr|hours?|hrs?|units?)\b/i,
  // "Major Core (30 credits)"
  /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*(credits?|cr|hours?|hrs?|units?)\s*\)/i,
  // "Major Core 30 credits"
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(credits?|cr|hours?|hrs?|units?)\b/i,
  // "30 credits of Major Core"
  /^(\d+(?:\.\d+)?)\s+(credits?|cr|hours?|hrs?|units?)\s+(?:of|in|for)\s+(.+)$/i,
];

export function parseTrackerText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const raw of lines) {
    // Strip leading list markers: "1.", "-", "•", "(a)" etc.
    const line = raw
      .replace(/^[\u2022\u25E6•\-\*]\s+/, '')
      .replace(/^\(?[a-z0-9]+[\.\)]\s+/i, '')
      .trim();
    if (line.length < 4) continue;

    // Skip lines that don't contain a digit at all (cheap pre-filter).
    if (!/\d/.test(line)) continue;

    let m, name, credits;
    for (let i = 0; i < TEXT_PATTERNS.length; i++) {
      const pat = TEXT_PATTERNS[i];
      m = line.match(pat);
      if (!m) continue;
      if (i === 3) {
        // "30 credits of X" pattern: capture order is credits, unit, name
        credits = parseFloat(m[1]);
        name = m[3];
      } else {
        name = m[1];
        credits = parseFloat(m[2]);
      }
      break;
    }
    if (!m || !name) continue;

    name = name.trim()
      .replace(/^(required|minimum|min)\s+/i, '')
      .replace(/[:\-–|]+$/, '')
      .trim();
    if (!name || name.length > 80) continue; // sanity
    if (credits <= 0 || credits > 200) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: 'req_' + slug(name) + '_' + (out.length + 1),
      name,
      credits,
      description: '',
    });
  }
  return out;
}

// ---------- Top-level dispatcher ----------

export function parseTrackerByFilename(filename, content) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (ext === 'json') return parseTrackerJSON(content);
  if (ext === 'csv')  return parseTrackerTabular(content, ',');
  if (ext === 'tsv')  return parseTrackerTabular(content, '\t');
  // PDF or TXT: caller has already extracted text; try tabular first then text.
  const tabular = parseTrackerTabular(content);
  if (tabular.length >= 2) return tabular;
  return parseTrackerText(content);
}