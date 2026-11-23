// src/lib/sampleCatalog.js
// =====================================================
// Sample catalog for the first-visit "Try it with sample courses" flow.
//
// Everything here is fictional (department "DEMO", invented course names and
// times). It exists only so a first-time visitor can watch ClassForge find
// conflict-free schedules without having to upload anything.
//
// Isolation rule: sample data is for guest mode only. Every course carries
// `sample: true` and ids prefixed `c_sample_` / `s_sample_`, and
// `stripSampleData` removes all of it from a user-data snapshot. The app runs
// that on every save to a signed-in account and on every guest-draft hand-off
// at sign-in, so sample data never reaches a saved record.
// =====================================================

export const SAMPLE_COURSE_PREFIX = 'c_sample_';
export const SAMPLE_SECTION_PREFIX = 's_sample_';

const t = (h, m = 0) => h * 60 + m;
const MWF = ['Mon', 'Wed', 'Fri'];
const TR = ['Tue', 'Thu'];

function sec(slug, label, days, start, end, location) {
  return {
    id: `${SAMPLE_SECTION_PREFIX}${slug}_${label}`,
    section: label,
    instructor: 'Staff (sample)',
    location,
    meetings: [{ days, start, end }],
  };
}

function course(slug, code, title, credits, color, sections) {
  return {
    id: `${SAMPLE_COURSE_PREFIX}${slug}`,
    code,
    title,
    credits,
    sample: true,
    color,
    sections: sections.map((s) => sec(slug, ...s)),
  };
}

export const SAMPLE_COURSES = Object.freeze([
  course('writing', 'DEMO 110', 'Sample Writing Workshop', 3, '#4F46E5', [
    ['001', MWF, t(9), t(9, 50), 'Sample Hall 101'],
    ['002', TR, t(9, 30), t(10, 45), 'Sample Hall 101'],
    ['003', MWF, t(13), t(13, 50), 'Sample Hall 102'],
  ]),
  course('stats', 'DEMO 120', 'Example Statistics', 3, '#0EA5E9', [
    ['001', MWF, t(10), t(10, 50), 'Sample Hall 201'],
    ['002', TR, t(11), t(12, 15), 'Sample Hall 201'],
  ]),
  course('history', 'DEMO 130', 'Imaginary History of Science', 3, '#F59E0B', [
    ['001', TR, t(8), t(9, 15), 'Sample Hall 301'],
    ['002', MWF, t(11), t(11, 50), 'Sample Hall 301'],
  ]),
  course('biology', 'DEMO 140', 'Pretend Biology', 4, '#10B981', [
    ['001', TR, t(13), t(14, 50), 'Example Lab 1'],
    ['002', MWF, t(14), t(15, 50), 'Example Lab 1'],
  ]),
  course('psych', 'DEMO 150', 'Mock Psychology', 3, '#EC4899', [
    ['001', TR, t(10, 30), t(11, 45), 'Sample Hall 401'],
    ['002', MWF, t(12), t(12, 50), 'Sample Hall 401'],
  ]),
  // One section only, and it overlaps DEMO 110 section 002, DEMO 150 section
  // 001 and DEMO 120 section 002. This is the built-in conflict to resolve:
  // choosing it rules those sections out and the scheduler routes around them.
  course('computing', 'DEMO 220', 'Practice Computing', 3, '#8B5CF6', [
    ['001', TR, t(10), t(11, 15), 'Example Lab 2'],
  ]),
  course('economics', 'DEMO 230', 'Make-Believe Economics', 3, '#EF4444', [
    ['001', MWF, t(12), t(12, 50), 'Sample Hall 501'],
    ['002', TR, t(15), t(16, 15), 'Sample Hall 501'],
  ]),
  course('art', 'DEMO 240', 'Fictional Art Studio', 2, '#14B8A6', [
    ['001', ['Fri'], t(13), t(15, 30), 'Example Studio'],
    ['002', ['Thu'], t(16), t(18, 30), 'Example Studio'],
  ]),
  course('speaking', 'DEMO 250', 'Sample Public Speaking', 3, '#F97316', [
    ['001', MWF, t(16), t(16, 50), 'Sample Hall 601'],
    ['002', TR, t(16), t(17, 15), 'Sample Hall 601'],
  ]),
]);

// Courses selected when the sample is first loaded. The rest are in the list
// for the visitor to switch on.
export const SAMPLE_DEFAULT_SELECTED_CODES = Object.freeze([
  'DEMO 110',
  'DEMO 120',
  'DEMO 130',
  'DEMO 150',
  'DEMO 220',
]);

export function isSampleCourse(c) {
  return Boolean(c && (c.sample === true || String(c.id || '').startsWith(SAMPLE_COURSE_PREFIX)));
}

export function isSampleCourseId(id) {
  return String(id || '').startsWith(SAMPLE_COURSE_PREFIX);
}

export function hasSampleData(catalog) {
  return Array.isArray(catalog) && catalog.some(isSampleCourse);
}

const SAMPLE_CODES = new Set(SAMPLE_COURSES.map((c) => c.code));

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// Fresh copies of the sample courses without the display-only colour field.
export function getSampleCatalog() {
  return clone(SAMPLE_COURSES).map(({ color, ...rest }) => rest);
}

export function getSampleColors() {
  return Object.fromEntries(SAMPLE_COURSES.map((c) => [c.code, c.color]));
}

export function getSampleSelectedIds() {
  return SAMPLE_COURSES.filter((c) => SAMPLE_DEFAULT_SELECTED_CODES.includes(c.code)).map((c) => c.id);
}

// Returns a new user-data snapshot with the sample catalog loaded for a guest.
// Courses the visitor already has are kept (a sample course never replaces a
// course with the same code). Never call this for a signed-in user.
export function applySampleData(snapshot) {
  const existing = Array.isArray(snapshot.catalog) ? snapshot.catalog : [];
  const existingCodes = new Set(existing.map((c) => c.code));
  const toAdd = getSampleCatalog().filter((c) => !existingCodes.has(c.code));
  const sampleIds = new Set(getSampleSelectedIds());
  const selected = new Set(snapshot.selected_courses || []);
  for (const c of toAdd) if (sampleIds.has(c.id)) selected.add(c.id);
  return {
    ...snapshot,
    catalog: [...existing, ...toAdd],
    selected_courses: [...selected],
    course_colors: { ...getSampleColors(), ...(snapshot.course_colors || {}) },
  };
}

function referencesSample(saved) {
  if ((saved?.selectedCourseIds || []).some(isSampleCourseId)) return true;
  return (saved?.sections || []).some((s) => SAMPLE_CODES.has(s.courseCode));
}

// Returns a copy of a user-data snapshot with all sample data removed:
// sample courses, their selections, section toggles, colours, tags, and any
// saved schedule built from them. Safe on snapshots that hold no sample data.
export function stripSampleData(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const catalog = (snapshot.catalog || []).filter((c) => !isSampleCourse(c));
  const enabled = {};
  for (const [id, map] of Object.entries(snapshot.enabled_sections || {})) {
    if (!isSampleCourseId(id)) enabled[id] = map;
  }
  const keepCode = (code) => !SAMPLE_CODES.has(code) || catalog.some((c) => c.code === code);
  const colors = {};
  for (const [code, v] of Object.entries(snapshot.course_colors || {})) {
    if (keepCode(code)) colors[code] = v;
  }
  const tags = {};
  for (const [code, v] of Object.entries(snapshot.course_tags || {})) {
    if (keepCode(code)) tags[code] = v;
  }
  return {
    ...snapshot,
    catalog,
    selected_courses: (snapshot.selected_courses || []).filter((id) => !isSampleCourseId(id)),
    enabled_sections: enabled,
    saved_schedules: (snapshot.saved_schedules || []).filter((s) => !referencesSample(s)),
    course_colors: colors,
    course_tags: tags,
  };
}

// True when a snapshot holds anything the visitor actually entered.
export function hasUserContent(snapshot) {
  if (!snapshot) return false;
  return [
    'catalog',
    'selected_courses',
    'blocked_times',
    'saved_schedules',
    'degree_tracker',
    'completed_courses',
  ].some((k) => Array.isArray(snapshot[k]) && snapshot[k].length > 0);
}
