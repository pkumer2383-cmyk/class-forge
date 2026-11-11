// src/lib/tracker.js
// =====================================================
// ClassForge — Degree tracker accounting (v2)
// =====================================================
// Supports:
//   - multi-tag courses (a course can fulfill multiple requirements)
//   - completed vs. forecast (planned future) courses
//   - per-semester grouping with chronological sort
//   - GPA on completed courses with missing-grade detection
// =====================================================

const UNALLOCATED_ID = '__unallocated__';

// ---------- Tag helpers (back-compat with old single-tag schema) ----------
export function getTags(course) {
  // accept legacy { requirementId } and new { requirementIds: [] }
  if (Array.isArray(course?.requirementIds)) return course.requirementIds.filter(Boolean);
  if (course?.requirementId) return [course.requirementId];
  return [];
}
export function getCatalogTags(courseTags, code) {
  const v = courseTags?.[code];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v) return [v];
  return [];
}
export function setCatalogTagsValue(arr) {
  // Storage: always an array, even if length 1, for forward-consistency.
  // Empty array → caller should remove the key entirely.
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

// ---------- Credit accounting ----------
// completedCourses can mix kinds:
//   { kind: 'completed' | 'forecast', code, title, credits, grade?, semester?, requirementIds: [] }
// Backward compat: missing `kind` is treated as 'completed'.
//
// selectedCourses is the *current schedule's* courses (this term, projected).
//
// courseTags maps course code -> array of requirement IDs (for catalog courses
// in the current schedule). If a code only exists as legacy single string, we
// coerce up.
export function computeProgress({
  tracker = [],
  completedCourses = [],
  selectedCourses = [],
  courseTags = {},
}) {
  const buckets = new Map();
  for (const cat of tracker) {
    buckets.set(cat.id, {
      completedCourses: [], forecastCourses: [], projectedCourses: [],
    });
  }
  buckets.set(UNALLOCATED_ID, {
    completedCourses: [], forecastCourses: [], projectedCourses: [],
  });

  // Place completed/forecast courses (from My Record)
  for (const c of completedCourses) {
    const kind = c.kind === 'forecast' ? 'forecast' : 'completed';
    const tags = getTags(c);
    const arr = kind === 'forecast' ? 'forecastCourses' : 'completedCourses';
    const slim = {
      id: c.id,
      code: c.code,
      title: c.title || c.code,
      credits: numberOr(c.credits, 3),
      grade: c.grade || '',
      semester: c.semester || '',
    };
    if (!tags.length) {
      buckets.get(UNALLOCATED_ID)[arr].push(slim);
    } else {
      // multi-tag: course shows up in *every* tagged requirement's bucket.
      // We deliberately allow this — the UI will note it counts in multiple.
      let placedAny = false;
      for (const tag of tags) {
        if (buckets.has(tag)) {
          buckets.get(tag)[arr].push(slim);
          placedAny = true;
        }
      }
      if (!placedAny) buckets.get(UNALLOCATED_ID)[arr].push(slim);
    }
  }

  // Place projected (currently-selected schedule courses)
  for (const c of selectedCourses) {
    const tags = getCatalogTags(courseTags, c.code);
    const slim = { code: c.code, title: c.title || c.code, credits: numberOr(c.credits, 3) };
    if (!tags.length) {
      buckets.get(UNALLOCATED_ID).projectedCourses.push(slim);
    } else {
      let placedAny = false;
      for (const tag of tags) {
        if (buckets.has(tag)) {
          buckets.get(tag).projectedCourses.push(slim);
          placedAny = true;
        }
      }
      if (!placedAny) buckets.get(UNALLOCATED_ID).projectedCourses.push(slim);
    }
  }

  const categories = tracker.map(cat => {
    const b = buckets.get(cat.id);
    const completed = sumCredits(b.completedCourses);
    const forecast = sumCredits(b.forecastCourses);
    const projected = sumCredits(b.projectedCourses);
    const total = completed + forecast + projected;
    const required = numberOr(cat.credits, 0);
    const percent = required > 0 ? Math.min(100, Math.round((total / required) * 100)) : 0;
    let status = 'untouched';
    if (total > 0) status = 'partial';
    if (total >= required && required > 0) status = 'complete';
    if (total > required && required > 0) status = 'over';
    return {
      id: cat.id, name: cat.name, description: cat.description || '',
      required, completed, forecast, projected, total, percent, status,
      completedCourses: b.completedCourses,
      forecastCourses: b.forecastCourses,
      projectedCourses: b.projectedCourses,
      // shortfall is what the user *still* needs after counting completed+forecast.
      // Used for forecast generation: how many credits to forecast for this req.
      shortfallAfterCompleted: Math.max(0, required - completed),
      shortfallAfterCompletedAndForecast: Math.max(0, required - completed - forecast),
    };
  });

  const un = buckets.get(UNALLOCATED_ID);
  const unallocated = {
    completed: sumCredits(un.completedCourses),
    forecast: sumCredits(un.forecastCourses),
    projected: sumCredits(un.projectedCourses),
    completedCourses: un.completedCourses,
    forecastCourses: un.forecastCourses,
    projectedCourses: un.projectedCourses,
  };

  // Totals — note: when a course is multi-tagged, it contributes once to total
  // credit sums (we want total *credits earned*, not credits-per-requirement-sum).
  // We compute totals from the source arrays directly to avoid double counting.
  const completedSum = uniqueCredits(completedCourses.filter(c => (c.kind || 'completed') === 'completed'));
  const forecastSum = uniqueCredits(completedCourses.filter(c => c.kind === 'forecast'));
  const projectedSum = uniqueCredits(selectedCourses);

  const totals = {
    required: tracker.reduce((a, c) => a + numberOr(c.credits, 0), 0),
    completed: completedSum,
    forecast: forecastSum,
    projected: projectedSum,
    total: completedSum + forecastSum + projectedSum,
  };

  return { categories, unallocated, totals };
}

function sumCredits(arr) {
  return arr.reduce((a, c) => a + numberOr(c.credits, 3), 0);
}
function uniqueCredits(arr) {
  // Sum credits without double counting (each entry is unique by id/code+semester).
  return arr.reduce((a, c) => a + numberOr(c.credits, 3), 0);
}
function numberOr(v, fb) { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; }

// ============================================================
// Semester ordering — converts "Fall 2024" / "Sp25" / "Summer 2025" etc.
// to a sortable key.
// ============================================================
const TERM_RANK = {
  winter: 0, win: 0, w: 0, j: 0, jterm: 0,
  spring: 1, spr: 1, sp: 1, s1: 1,
  summer: 2, sum: 2, su: 2, s: 2, // 'S' alone is ambiguous; treat as summer
  fall: 3, fal: 3, f: 3, autumn: 3, aut: 3, au: 3,
};

export function semesterSortKey(semester) {
  if (!semester) return Number.POSITIVE_INFINITY; // empty sorts last
  const s = String(semester).trim().toLowerCase();
  // Try to find a 2- or 4-digit year
  const yearMatch = s.match(/(20\d{2}|\d{2})(?!\d)/);
  if (!yearMatch) return Number.POSITIVE_INFINITY;
  let year = parseInt(yearMatch[1], 10);
  if (year < 100) year = 2000 + year;
  // Try to find a term keyword
  let term = 1; // default to spring if no term given (random middle)
  for (const [kw, rank] of Object.entries(TERM_RANK)) {
    // Use word boundary regex to avoid 'spring' matching 'sp'
    const re = new RegExp('\\b' + kw + '\\b');
    if (re.test(s)) { term = rank; break; }
  }
  return year * 10 + term;
}

export function groupCompletedBySemester(courses) {
  // Returns ordered array of { semester, courses }
  // Preserves "(no semester)" bucket at the end.
  const groups = new Map();
  for (const c of courses) {
    const key = (c.semester || '').trim() || '(no semester)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const arr = Array.from(groups.entries()).map(([semester, courses]) => ({ semester, courses }));
  arr.sort((a, b) => {
    const ka = a.semester === '(no semester)' ? Number.POSITIVE_INFINITY : semesterSortKey(a.semester);
    const kb = b.semester === '(no semester)' ? Number.POSITIVE_INFINITY : semesterSortKey(b.semester);
    if (ka !== kb) return ka - kb;
    return a.semester.localeCompare(b.semester);
  });
  return arr;
}

// ============================================================
// GPA calculation
// ============================================================
const GRADE_POINTS = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0,
};

export function gradeToPoints(grade) {
  if (grade === null || grade === undefined) return null;
  const g = String(grade).trim().toUpperCase();
  if (!g) return null;
  if (g in GRADE_POINTS) return GRADE_POINTS[g];
  // Numeric input (e.g., "85", "92.5") — treat as percentage on a typical scale
  const n = parseFloat(g);
  if (Number.isFinite(n)) {
    if (n >= 93) return 4.0;
    if (n >= 90) return 3.7;
    if (n >= 87) return 3.3;
    if (n >= 83) return 3.0;
    if (n >= 80) return 2.7;
    if (n >= 77) return 2.3;
    if (n >= 73) return 2.0;
    if (n >= 70) return 1.7;
    if (n >= 67) return 1.3;
    if (n >= 60) return 1.0;
    return 0.0;
  }
  // P, NP, W, I, etc. — not counted
  return null;
}

// Pass-fail-style markers we recognize and intentionally exclude from GPA.
const NON_GPA_GRADES = new Set(['P', 'NP', 'W', 'I', 'AU', 'CR', 'NC', 'PASS', 'FAIL']);

export function computeGPA(completedCourses) {
  // Returns { gpa, totalCredits, gradedCredits, missing: [course] }
  let totalGradedPoints = 0;
  let totalGradedCredits = 0;
  let totalCountedCredits = 0;
  const missing = [];
  for (const c of completedCourses) {
    if (c.kind === 'forecast') continue; // forecasts have no grade
    const credits = numberOr(c.credits, 0);
    if (!credits) continue;
    totalCountedCredits += credits;
    const gradeStr = String(c.grade || '').trim().toUpperCase();
    if (!gradeStr) {
      missing.push({ id: c.id, code: c.code, semester: c.semester || '' });
      continue;
    }
    if (NON_GPA_GRADES.has(gradeStr)) continue; // intentionally not counted
    const pts = gradeToPoints(gradeStr);
    if (pts === null) {
      missing.push({ id: c.id, code: c.code, semester: c.semester || '' });
      continue;
    }
    totalGradedPoints += pts * credits;
    totalGradedCredits += credits;
  }
  return {
    gpa: totalGradedCredits > 0 ? Math.round((totalGradedPoints / totalGradedCredits) * 1000) / 1000 : null,
    totalCredits: totalCountedCredits,
    gradedCredits: totalGradedCredits,
    missing,
  };
}

// ============================================================
// Forecast generation — for each requirement that isn't yet met by
// completed + forecast credits, generate ONE placeholder course
// representing the remaining credits. The placeholder uses the
// requirement name as its title (no fake course code).
// ============================================================
export function generateForecastPlaceholders(progressCategories) {
  const out = [];
  for (const cat of progressCategories) {
    const remaining = cat.shortfallAfterCompletedAndForecast;
    if (remaining > 0) {
      out.push({
        id: 'forecast_placeholder_' + cat.id,
        kind: 'placeholder',
        requirementId: cat.id,
        requirementName: cat.name,
        credits: remaining,
      });
    }
  }
  return out;
}
// ============================================================
// Smart forecast distribution
// ============================================================
// Given placeholders (one per unfulfilled requirement), distribute their
// credits across N future semesters with a per-semester credit threshold.
// Returns: [{ requirementId, requirementName, credits, semester }]
//
// Strategy:
//   1. Determine N = ceil(totalCredits / threshold).
//   2. Walk semester-by-semester, packing in:
//        - smallest-first that-fits-whole, OR
//        - if a placeholder is bigger than threshold, split it across
//          consecutive semesters
//   3. Result preserves requirement names; large reqs may appear in
//      multiple semesters labeled "(part 1 of 3)" etc.
//
// startSemester examples: "Spring 2026" → next is Summer 2026 → Fall 2026 ...
export function nextSemester(s) {
  const m = String(s).match(/^(Winter|Spring|Summer|Fall|Autumn)\s+(\d{4})$/i);
  if (!m) return null;
  const term = m[1].toLowerCase();
  const year = parseInt(m[2], 10);
  // Order: Winter → Spring → Summer → Fall → Winter (next year)
  const order = ['winter', 'spring', 'summer', 'fall'];
  const ix = order.indexOf(term === 'autumn' ? 'fall' : term);
  if (ix < 0) return null;
  const nextIx = (ix + 1) % 4;
  const nextYear = nextIx === 0 ? year + 1 : year;
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  return cap(order[nextIx]) + ' ' + nextYear;
}

// Optionally skip Winter and Summer if user prefers (default: skip both,
// most students take Fall/Spring only). Set includeAll=true to include.
export function nextAcademicSemester(s, includeAll = false) {
  if (includeAll) return nextSemester(s);
  const m = String(s).match(/^(Winter|Spring|Summer|Fall|Autumn)\s+(\d{4})$/i);
  if (!m) return null;
  const term = m[1].toLowerCase();
  const year = parseInt(m[2], 10);
  if (term === 'fall' || term === 'autumn') return 'Spring ' + (year + 1);
  if (term === 'spring') return 'Fall ' + year;
  if (term === 'summer') return 'Fall ' + year;
  if (term === 'winter') return 'Spring ' + year;
  return null;
}

export function distributeForecastAcrossSemesters({
  placeholders,
  startSemester,
  threshold = 18,
  includeAll = false,
}) {
  if (!placeholders.length) return [];
  if (!startSemester) return [];

  // Sort placeholders largest-first so we pack big ones first
  const remaining = placeholders
    .map(p => ({ ...p, _remaining: p.credits }))
    .filter(p => p._remaining > 0)
    .sort((a, b) => b._remaining - a._remaining);

  const out = [];
  let semester = startSemester;
  let safety = 100; // never loop forever

  while (remaining.some(p => p._remaining > 0) && safety-- > 0) {
    let semesterCredits = 0;
    // First pass: fit whole placeholders
    for (const p of remaining) {
      if (p._remaining <= 0) continue;
      if (p._remaining + semesterCredits <= threshold) {
        out.push({
          requirementId: p.requirementId,
          requirementName: p.requirementName,
          credits: p._remaining,
          semester,
        });
        semesterCredits += p._remaining;
        p._remaining = 0;
      }
    }
    // Second pass: if semester still has room and a placeholder is too big
    // to fit whole, split it
    if (semesterCredits < threshold) {
      for (const p of remaining) {
        if (p._remaining <= 0) continue;
        const room = threshold - semesterCredits;
        if (room <= 0) break;
        const take = Math.min(p._remaining, room);
        if (take > 0) {
          out.push({
            requirementId: p.requirementId,
            requirementName: p.requirementName,
            credits: take,
            semester,
          });
          semesterCredits += take;
          p._remaining -= take;
        }
        if (semesterCredits >= threshold) break;
      }
    }
    // Move to next semester
    const next = nextAcademicSemester(semester, includeAll);
    if (!next) break;
    semester = next;
  }
  return out;
}