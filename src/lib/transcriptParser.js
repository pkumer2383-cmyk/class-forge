// src/lib/transcriptParser.js
// =====================================================
// ClassForge — Transcript parsing
// =====================================================
// Best-effort extraction of completed courses from a transcript.
// Returns: [{ code, title, credits, grade, semester }]
// Caller assigns ids + tags.
// =====================================================

import { parseDelimited } from './parsers.js';

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function num(v, fb = null) { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; }

// ---------- CSV / TSV ----------

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  return (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
}

function canonicalize(h) {
  const s = String(h || '').trim().toLowerCase();
  if (['code','course','course code','coursecode','catalog','catalog number','crse','subject + number'].includes(s)) return 'code';
  if (['title','course title','name','course name','description'].includes(s)) return 'title';
  if (['credits','credit','units','hours','credit hours','cr','attempted','earned'].includes(s)) return 'credits';
  if (['grade','final grade','letter grade','mark'].includes(s)) return 'grade';
  if (['semester','term','session','quarter'].includes(s)) return 'semester';
  return s.replace(/\s+/g, '_');
}

export function parseTranscriptTabular(text, delimiter) {
  const rows = parseDelimited(text, delimiter || detectDelimiter(text));
  if (rows.length < 2) return [];
  const headers = rows[0].map(canonicalize);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = (rows[i][j] || '').trim(); });
    if (!obj.code && !obj.title) continue;
    const credits = num(obj.credits, 0);
    if (credits <= 0) continue;
    out.push({
      code: obj.code || obj.title,
      title: obj.title || obj.code || '',
      credits,
      grade: obj.grade || '',
      semester: obj.semester || '',
    });
  }
  return out;
}

// ---------- JSON ----------

export function parseTranscriptJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(data)) {
    if (data && Array.isArray(data.courses)) data = data.courses;
    else if (data && Array.isArray(data.transcript)) data = data.transcript;
    else return [];
  }
  return data
    .map(c => {
      const code = c.code || c.course || c.courseCode;
      const credits = num(c.credits ?? c.units ?? c.hours, 0);
      if (!code || credits <= 0) return null;
      return {
        code: String(code),
        title: c.title || c.name || code,
        credits,
        grade: c.grade || '',
        semester: c.semester || c.term || '',
      };
    })
    .filter(Boolean);
}

// ---------- Plain text / PDF-extracted ----------
//
// Common transcript line patterns:
//   "CS 101  Intro to CS  3.00  A"
//   "MATH-110 Calculus I  4  B+"
//   "CS101 Intro to Comp Sci 3 A 4.00"   (with grade points appended)
//   "Fall 2024" / "Spring 2025" — semester headers
//
// Strategy:
//   1. Walk lines.
//   2. If line looks like a semester header, remember it.
//   3. If line matches a course pattern, capture code/title/credits/grade
//      and tag with the current semester.

const TERM_HEADER = /^(?:term[:\s]+)?(fall|spring|summer|winter|autumn)\s+(\d{2,4})\b/i;
const TERM_HEADER_SHORT = /\b(fall|spring|summer|winter|autumn)\s+(\d{2,4})\b/i;

// Course code patterns:
//   "CS 101", "CS101", "CS-101", "MATH 110A", "ENGL-1101"
const CODE = '([A-Z]{2,5})\\s*[-]?\\s*(\\d{2,4}[A-Z]?)';

const PATTERNS = [
  // CS 101  Intro to CS    3.00   A     (title + credits + grade)
  new RegExp('^' + CODE + '\\s+(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s+([A-DF][+-]?|P|NP|W|I|AU|CR|NC)\\b', 'i'),
  // CS 101  3.00  A   (no title)
  new RegExp('^' + CODE + '\\s+(\\d+(?:\\.\\d+)?)\\s+([A-DF][+-]?|P|NP|W|I|AU|CR|NC)\\b', 'i'),
  // CS 101  Intro to CS  3.00 (no grade — in-progress)
  new RegExp('^' + CODE + '\\s+(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*$', 'i'),
];

export function parseTranscriptText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  let currentSemester = '';

  for (const line of lines) {
    // Semester header detection
    let h = line.match(TERM_HEADER);
    if (!h) h = line.match(TERM_HEADER_SHORT);
    if (h && line.length < 40) {
      let yr = h[2];
      if (yr.length === 2) yr = (parseInt(yr, 10) >= 50 ? '19' : '20') + yr;
      currentSemester = capitalize(h[1]) + ' ' + yr;
      // semester header line might also contain a course; don't continue,
      // try parsing the rest of the line below.
    }

    // Try each course pattern, longest-match first
    let matched = false;
    for (let i = 0; i < PATTERNS.length; i++) {
      const m = line.match(PATTERNS[i]);
      if (!m) continue;
      const subject = m[1].toUpperCase();
      const number = m[2];
      const code = subject + ' ' + number;

      let title = '', credits = 0, grade = '';
      if (i === 0) {
        title = String(m[3]).trim();
        credits = parseFloat(m[4]);
        grade = String(m[5]).toUpperCase();
      } else if (i === 1) {
        credits = parseFloat(m[3]);
        grade = String(m[4]).toUpperCase();
        title = code;
      } else if (i === 2) {
        title = String(m[3]).trim();
        credits = parseFloat(m[4]);
        grade = '';
      }

      if (!title || title.length < 2) title = code;
      if (title.length > 80) title = title.slice(0, 80);
      if (credits <= 0 || credits > 12) continue;

      out.push({
        code,
        title,
        credits,
        grade,
        semester: currentSemester,
      });
      matched = true;
      break;
    }
  }

  return dedupCourses(out);
}

function dedupCourses(arr) {
  // Same code+semester duplicates are common in transcripts (repeats, in-progress vs final).
  // Keep the LAST occurrence (usually the most recent/complete).
  const seen = new Map();
  for (const c of arr) {
    const key = c.code + '|' + (c.semester || '');
    seen.set(key, c);
  }
  return Array.from(seen.values());
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

// ---------- Top-level dispatcher ----------
export function parseTranscriptByFilename(filename, content) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (ext === 'json') return parseTranscriptJSON(content);
  if (ext === 'csv')  return parseTranscriptTabular(content, ',');
  if (ext === 'tsv')  return parseTranscriptTabular(content, '\t');
  // PDF or TXT: try tabular first (some "transcripts" are CSV exports), then text
  const tabular = parseTranscriptTabular(content);
  if (tabular.length >= 2) return tabular;
  return parseTranscriptText(content);
}