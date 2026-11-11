// src/lib/parsers.js
// =====================================================
// ClassForge — File parsing utilities
// =====================================================
// Parses course catalog files in CSV, TSV, TXT, JSON, and PDF.
// Output is a normalized array of course objects:
// {
//   id: string,            // unique row id
//   code: string,          // e.g. "CS 101"
//   title: string,         // course title
//   credits: number,       // 0..6
//   sections: [{
//     id: string,          // unique section id (CRN-like)
//     section: string,     // section identifier ("001", "A1", etc.)
//     instructor: string,
//     location: string,
//     meetings: [{
//       days: string[],    // ["Mon","Wed","Fri"]
//       start: number,     // minutes from midnight
//       end: number,       // minutes from midnight
//     }],
//   }],
// }
// =====================================================

// ---------- Time helpers ----------

const DAY_ALIASES = {
  m: 'Mon', mo: 'Mon', mon: 'Mon', monday: 'Mon',
  t: 'Tue', tu: 'Tue', tue: 'Tue', tues: 'Tue', tuesday: 'Tue',
  w: 'Wed', we: 'Wed', wed: 'Wed', wednesday: 'Wed',
  r: 'Thu', th: 'Thu', thu: 'Thu', thur: 'Thu', thurs: 'Thu', thursday: 'Thu',
  f: 'Fri', fr: 'Fri', fri: 'Fri', friday: 'Fri',
  s: 'Sat', sa: 'Sat', sat: 'Sat', saturday: 'Sat',
  u: 'Sun', su: 'Sun', sun: 'Sun', sunday: 'Sun',
};

export const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Parse a days string into normalized day names.
// Handles: "MWF", "TR", "M W F", "Mon/Wed/Fri", "Mon, Wed, Fri", "Tu Th"
export function parseDays(input) {
  if (!input) return [];
  const s = String(input).trim();
  if (!s) return [];

  // First try splitting on common delimiters.
  const delimSplit = s.split(/[,\/;|]+|\s+/).map(p => p.trim()).filter(Boolean);
  const out = [];

  for (const tok of delimSplit) {
    const lc = tok.toLowerCase();
    if (DAY_ALIASES[lc]) {
      out.push(DAY_ALIASES[lc]);
      continue;
    }

    // Otherwise treat as a tightly-packed letter sequence like "MWF" or "TR".
    // We use a longest-match-first walker so "Th" wins over "T".
    let i = 0;
    while (i < lc.length) {
      // try 5,4,3,2,1 char prefixes
      let matched = null;
      for (const len of [5, 4, 3, 2, 1]) {
        const slice = lc.slice(i, i + len);
        if (DAY_ALIASES[slice]) { matched = { d: DAY_ALIASES[slice], len }; break; }
      }
      if (matched) {
        out.push(matched.d);
        i += matched.len;
      } else {
        // skip junk chars
        i += 1;
      }
    }
  }

  // Dedupe but keep order.
  const seen = new Set();
  return out.filter(d => (seen.has(d) ? false : (seen.add(d), true)));
}

// Convert a time string into minutes-from-midnight.
// Accepts "9:00 AM", "9 AM", "0900", "09:00", "13:30", "1:30PM".
export function parseTime(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;

  // Match optional am/pm at the end.
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(AM|PM)?$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  let mm = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3];

  if (ap === 'AM') {
    if (hh === 12) hh = 0;
  } else if (ap === 'PM') {
    if (hh !== 12) hh += 12;
  } else {
    // No am/pm — treat as 24-hour. If 4-digit packed like "0900", we already split.
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

// Parse a time range like "9:00 AM - 10:15 AM" or "0900-1015" into [start,end].
export function parseTimeRange(input) {
  if (!input) return null;
  const s = String(input).replace(/–|—/g, '-').trim();
  const parts = s.split(/\s*-\s*/);
  if (parts.length !== 2) return null;

  // If only one part has AM/PM and the other is bare, copy it onto the bare side
  // BEFORE parsing. This handles "1:00-1:50 PM" → "1:00 PM-1:50 PM".
  const APRE = /(AM|PM)/i;
  const aHas = APRE.test(parts[0]);
  const bHas = APRE.test(parts[1]);
  if (aHas && !bHas) parts[1] = parts[1] + ' ' + parts[0].match(APRE)[0].toUpperCase();
  if (!aHas && bHas) parts[0] = parts[0] + ' ' + parts[1].match(APRE)[0].toUpperCase();

  let start = parseTime(parts[0]);
  let end = parseTime(parts[1]);
  if (start === null || end === null) return null;

  // If start ends up later than end (e.g. someone wrote "11:00 AM - 1:15"),
  // bump end by 12 hours.
  if (end < start) end += 12 * 60;
  return [start, end];
}

export function minutesToHHMM(min) {
  if (min === null || min === undefined) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

// ---------- CSV / TSV parsing ----------

// Robust CSV/TSV parser: handles quoted fields, escaped quotes, and embedded newlines.
export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/\r\n?/g, '\n');

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      } else {
        field += c; i += 1; continue;
      }
    } else {
      if (c === '"') { inQuotes = true; i += 1; continue; }
      if (c === delimiter) { row.push(field); field = ''; i += 1; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
      field += c; i += 1;
    }
  }
  // flush
  row.push(field);
  rows.push(row);
  // drop trailing empty row from final newline
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

// Detect delimiter automatically by sampling the first non-empty line.
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const pipes = (firstLine.match(/\|/g) || []).length;
  const counts = [['\t', tabs], [',', commas], [';', semis], ['|', pipes]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

// Map a header-name guess to a canonical key.
const HEADER_MAP = [
  [['code','course','course code','coursecode','catalog','catalog number','crse','subject + number','subj+num'], 'code'],
  [['title','course title','name','course name','description'], 'title'],
  [['credits','credit','units','hours','credit hours','cr'], 'credits'],
  [['section','sec','section number','sec #','sec num'], 'section'],
  [['crn','section id','sectionid','id'], 'crn'],
  [['instructor','professor','prof','teacher','instructors'], 'instructor'],
  [['location','room','building','where','place'], 'location'],
  [['days','day','meeting days','meets'], 'days'],
  [['time','times','meeting time','meeting times','class time','schedule'], 'time'],
  [['start','start time','from'], 'start'],
  [['end','end time','to','until'], 'end'],
];

function canonicalize(header) {
  const h = String(header || '').trim().toLowerCase();
  for (const [aliases, key] of HEADER_MAP) {
    if (aliases.includes(h)) return key;
  }
  return h.replace(/\s+/g, '_');
}

// Parse generic delimited (csv/tsv) into normalized course list.
// Each row in the file represents ONE section; we group by course code.
export function parseTabular(text, delimiter) {
  const rows = parseDelimited(text, delimiter || detectDelimiter(text));
  if (rows.length < 2) return [];
  const headers = rows[0].map(canonicalize);

  const rowsAsObj = rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });

  return groupRowsToCourses(rowsAsObj);
}

function groupRowsToCourses(rows) {
  const byCode = new Map();
  for (const r of rows) {
    if (!r.code && !r.title) continue;
    const code = (r.code || r.title || '').trim();
    if (!code) continue;
    if (!byCode.has(code)) {
      byCode.set(code, {
        id: 'c_' + slug(code),
        code,
        title: r.title || code,
        credits: numberOr(r.credits, 3),
        sections: [],
      });
    }
    const course = byCode.get(code);

    // Determine meeting times.
    const meetings = [];
    let start = null, end = null;
    if (r.start || r.end) {
      start = parseTime(r.start);
      end = parseTime(r.end);
    } else if (r.time) {
      const range = parseTimeRange(r.time);
      if (range) [start, end] = range;
    }
    const days = parseDays(r.days);
    if (days.length && start !== null && end !== null) {
      meetings.push({ days, start, end });
    }

    const sectionLabel = r.section || r.crn || (course.sections.length + 1).toString().padStart(3, '0');
    course.sections.push({
      id: 's_' + slug(code) + '_' + slug(String(sectionLabel)) + '_' + (course.sections.length + 1),
      section: String(sectionLabel),
      instructor: r.instructor || '',
      location: r.location || '',
      meetings,
    });
  }
  return Array.from(byCode.values());
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function numberOr(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- JSON parsing ----------

// Accepts either an array of courses (already shaped) or a flat array of section rows.
export function parseJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(data)) {
    // Possibly { courses: [...] }
    if (data && Array.isArray(data.courses)) data = data.courses;
    else return [];
  }
  if (!data.length) return [];

  // Detect shape: course objects have a "sections" array.
  if (data[0] && Array.isArray(data[0].sections)) {
    return data.map(normalizeCourseObject).filter(Boolean);
  }
  // Otherwise treat as flat rows.
  const rows = data.map(o => {
    const out = {};
    for (const k of Object.keys(o)) out[canonicalize(k)] = o[k];
    return out;
  });
  return groupRowsToCourses(rows);
}

function normalizeCourseObject(c) {
  if (!c || !c.code) return null;
  return {
    id: c.id || 'c_' + slug(c.code),
    code: c.code,
    title: c.title || c.code,
    credits: numberOr(c.credits, 3),
    sections: (c.sections || []).map((s, i) => ({
      id: s.id || 's_' + slug(c.code) + '_' + i,
      section: s.section || (i + 1).toString().padStart(3, '0'),
      instructor: s.instructor || '',
      location: s.location || '',
      meetings: (s.meetings || []).map(m => ({
        days: parseDays(m.days),
        start: typeof m.start === 'number' ? m.start : parseTime(m.start),
        end: typeof m.end === 'number' ? m.end : parseTime(m.end),
      })).filter(m => m.start !== null && m.end !== null && m.days.length),
    })),
  };
}

// ---------- Plain text "best effort" parsing ----------

// For TXT files we look line-by-line for patterns like:
//   CS 101 - Intro to Programming - 3 credits
//     001  MWF 9:00-9:50 AM  Smith  Room 100
//     002  TR  10:00-11:15 AM  Jones  Room 101
// Or a single line per section: "CS 101 001 MWF 9:00-9:50 AM Smith Room 100"
export function parseTXT(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const courses = new Map();
  let current = null;

  // Heuristics
  const courseHeader = /^([A-Z]{2,5}\s?-?\s?\d{2,4}[A-Z]?)\s*[-:|]?\s*(.+?)(?:\s*[-:|]\s*(\d+(?:\.\d+)?)\s*(?:credits?|cr|units?|hours?))?$/i;
  const sectionLine = /^([A-Z0-9]{1,5})\s+([A-Z]{1,7})\s+([\d:apm\s-]+(?:AM|PM)?)\s*(.*)$/i;

  for (const line of lines) {
    // Try to detect a section line first when we have a current course.
    if (current) {
      const sm = line.match(sectionLine);
      if (sm) {
        const [_, sec, daysRaw, timeRaw, rest] = sm;
        const days = parseDays(daysRaw);
        const range = parseTimeRange(timeRaw);
        if (days.length && range) {
          current.sections.push({
            id: 's_' + slug(current.code) + '_' + slug(sec) + '_' + (current.sections.length + 1),
            section: sec,
            instructor: (rest || '').trim(),
            location: '',
            meetings: [{ days, start: range[0], end: range[1] }],
          });
          continue;
        }
      }
    }
    // Otherwise check for course header.
    const cm = line.match(courseHeader);
    if (cm) {
      const code = cm[1].toUpperCase().replace(/\s+/g, ' ').replace(/-/g, '').trim();
      const title = (cm[2] || code).trim();
      const credits = cm[3] ? parseFloat(cm[3]) : 3;
      const id = 'c_' + slug(code);
      if (!courses.has(id)) {
        courses.set(id, { id, code, title, credits, sections: [] });
      }
      current = courses.get(id);
      continue;
    }

    // Single-line "CODE SEC DAYS TIME INSTRUCTOR" pattern as a fallback.
    const allInOne = line.match(/^([A-Z]{2,5}\s?\d{2,4}[A-Z]?)\s+([A-Z0-9]{1,5})\s+([A-Z]{1,7})\s+([\d:apm\s-]+(?:AM|PM)?)\s*(.*)$/i);
    if (allInOne) {
      const code = allInOne[1].toUpperCase().replace(/\s+/g, ' ').trim();
      const id = 'c_' + slug(code);
      if (!courses.has(id)) courses.set(id, { id, code, title: code, credits: 3, sections: [] });
      const c = courses.get(id);
      const days = parseDays(allInOne[3]);
      const range = parseTimeRange(allInOne[4]);
      if (days.length && range) {
        c.sections.push({
          id: 's_' + slug(code) + '_' + slug(allInOne[2]) + '_' + (c.sections.length + 1),
          section: allInOne[2],
          instructor: (allInOne[5] || '').trim(),
          location: '',
          meetings: [{ days, start: range[0], end: range[1] }],
        });
      }
    }
  }
  return Array.from(courses.values()).filter(c => c.sections.length > 0);
}

// ---------- Top-level dispatcher ----------

export function parseByFilename(name, content) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  if (ext === 'json')        return parseJSON(content);
  if (ext === 'tsv')         return parseTabular(content, '\t');
  if (ext === 'csv')         return parseTabular(content, ',');
  if (ext === 'txt')         return parseTXT(content);
  // Default: try delimited first, then text.
  const guessed = parseTabular(content);
  if (guessed.length) return guessed;
  return parseTXT(content);
}