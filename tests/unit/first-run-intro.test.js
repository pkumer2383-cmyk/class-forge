import assert from 'node:assert/strict';
import test from 'node:test';

import { generateSchedules } from '../../src/lib/scheduler.js';
import { parseByFilename } from '../../src/lib/parsers.js';
import {
  SAMPLE_COURSES,
  applySampleData,
  getSampleCatalog,
  getSampleSelectedIds,
  hasSampleData,
  hasUserContent,
  isSampleCourse,
  stripSampleData,
} from '../../src/lib/sampleCatalog.js';
import {
  WELCOME_DISMISSED_KEY,
  readWelcomeDismissed,
  shouldShowWelcome,
  writeWelcomeDismissed,
} from '../../src/lib/welcomeState.js';
import { SITE_DESCRIPTION } from '../../src/lib/seo.js';
import { BRAND } from '../../src/lib/brand.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

function emptySnapshot() {
  return {
    catalog: [],
    selected_courses: [],
    enabled_sections: {},
    blocked_times: [],
    preferences: { theme: 'dark' },
    saved_schedules: [],
    degree_tracker: [],
    completed_courses: [],
    course_tags: {},
    course_colors: {},
  };
}

function meetingsOverlap(a, b) {
  return a.days.some((d) => b.days.includes(d)) && a.start < b.end && b.start < a.end;
}

// ---------- sample catalog validity ----------

test('sample catalog is a small, clearly fictional set with multiple sections', () => {
  assert.ok(SAMPLE_COURSES.length >= 8 && SAMPLE_COURSES.length <= 10);
  for (const c of SAMPLE_COURSES) {
    assert.ok(isSampleCourse(c));
    assert.match(c.code, /^DEMO \d{3}$/);
    assert.ok(c.sections.length >= 1);
    for (const s of c.sections) {
      assert.match(s.id, /^s_sample_/);
      assert.ok(s.meetings.length && s.meetings.every((m) => m.start < m.end));
    }
  }
  assert.ok(SAMPLE_COURSES.filter((c) => c.sections.length >= 2).length >= 6);
  const ids = SAMPLE_COURSES.flatMap((c) => [c.id, ...c.sections.map((s) => s.id)]);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
});

test('sample catalog contains a real conflict between sections of different courses', () => {
  const sections = SAMPLE_COURSES.flatMap((c) => c.sections.map((s) => ({ c, s })));
  const conflicts = [];
  for (const a of sections) {
    for (const b of sections) {
      if (a.c.id >= b.c.id) continue;
      if (a.s.meetings.some((m1) => b.s.meetings.some((m2) => meetingsOverlap(m1, m2)))) {
        conflicts.push([a.s.id, b.s.id]);
      }
    }
  }
  assert.ok(conflicts.length >= 1);
});

test('the default sample selection produces several conflict-free schedules via the real scheduler', () => {
  const selected = new Set(getSampleSelectedIds());
  const courses = getSampleCatalog().filter((c) => selected.has(c.id));
  const { schedules, reason } = generateSchedules(courses, { maxResults: 200 });
  assert.equal(reason, 'ok');
  assert.ok(schedules.length >= 2, `expected at least 2 schedules, got ${schedules.length}`);
  for (const sch of schedules) {
    assert.equal(sch.sections.length, courses.length);
    const meetings = sch.sections.flatMap((s) => s.meetings);
    for (let i = 0; i < meetings.length; i++) {
      for (let j = i + 1; j < meetings.length; j++) {
        assert.equal(meetingsOverlap(meetings[i], meetings[j]), false);
      }
    }
  }
});

test('selecting every sample course still yields at least two schedules', () => {
  const { schedules } = generateSchedules(getSampleCatalog(), { maxResults: 200 });
  assert.ok(schedules.length >= 2);
});

test('the single-section conflict rules sections out instead of failing', () => {
  const cat = getSampleCatalog();
  const only = (code) => cat.find((c) => c.code === code);
  const { schedules } = generateSchedules([only('DEMO 220'), only('DEMO 150')]);
  assert.ok(schedules.length >= 1);
  // DEMO 150 section 001 overlaps the only DEMO 220 section, so every schedule uses 002.
  assert.ok(schedules.every((s) => s.sections.find((x) => x.courseCode === 'DEMO 150').section === '002'));
});

test('sample courses parse like uploaded ones (same shape the parser produces)', () => {
  const csv = ['code,title,credits,section,days,start,end', 'X 1,T,3,001,MWF,09:00,09:50'].join('\n');
  const parsed = parseByFilename('c.csv', csv)[0];
  const sample = getSampleCatalog()[0];
  for (const key of ['id', 'code', 'title', 'credits', 'sections']) assert.ok(key in sample && key in parsed);
  for (const key of ['id', 'section', 'meetings']) assert.ok(key in sample.sections[0]);
});

// ---------- welcome state ----------

test('welcome dismissal is remembered per browser and survives a reload', () => {
  const storage = memoryStorage();
  assert.equal(readWelcomeDismissed(storage), false);
  assert.equal(writeWelcomeDismissed(storage), true);
  assert.equal(storage.data[WELCOME_DISMISSED_KEY], '1');
  assert.equal(readWelcomeDismissed(storage), true);
  // a different browser (fresh storage) still sees the welcome
  assert.equal(readWelcomeDismissed(memoryStorage()), false);
});

test('blocked or throwing storage never breaks the welcome logic', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(readWelcomeDismissed(broken), false);
  assert.equal(writeWelcomeDismissed(broken), false);
  assert.equal(readWelcomeDismissed(null), false);
});

test('welcome opens only for a loaded guest with no courses who has not dismissed it', () => {
  const base = { authChecked: true, loaded: true, signedIn: false, catalogLength: 0, dismissed: false };
  assert.equal(shouldShowWelcome(base), true);
  assert.equal(shouldShowWelcome({ ...base, dismissed: true }), false);
  assert.equal(shouldShowWelcome({ ...base, signedIn: true }), false);
  assert.equal(shouldShowWelcome({ ...base, catalogLength: 3 }), false);
  assert.equal(shouldShowWelcome({ ...base, authChecked: false }), false);
  assert.equal(shouldShowWelcome({ ...base, loaded: false }), false);
});

// ---------- sample data isolation ----------

test('loading sample data adds courses and a default selection to a guest snapshot', () => {
  const next = applySampleData(emptySnapshot());
  assert.ok(hasSampleData(next.catalog));
  assert.equal(next.catalog.length, SAMPLE_COURSES.length);
  assert.deepEqual(next.selected_courses.sort(), getSampleSelectedIds().sort());
  assert.ok(next.course_colors['DEMO 110']);
});

test('sample data never replaces a course the visitor already added', () => {
  const snap = emptySnapshot();
  snap.catalog = [{ id: 'c_demo_110', code: 'DEMO 110', title: 'Mine', credits: 3, sections: [] }];
  const next = applySampleData(snap);
  assert.equal(next.catalog.filter((c) => c.code === 'DEMO 110').length, 1);
  assert.equal(next.catalog.find((c) => c.code === 'DEMO 110').title, 'Mine');
});

test('stripSampleData removes every trace of sample data and keeps the visitor own data', () => {
  const own = { id: 'c_cs_101', code: 'CS 101', title: 'Mine', credits: 3, sections: [] };
  const snap = applySampleData({ ...emptySnapshot(), catalog: [own], selected_courses: [own.id] });
  snap.enabled_sections = { [snap.catalog[1].id]: { x: false }, [own.id]: { y: true } };
  snap.course_colors['CS 101'] = '#123456';
  snap.saved_schedules = [
    { id: 's1', selectedCourseIds: [snap.catalog[1].id], sections: [{ courseCode: 'DEMO 110' }] },
    { id: 's2', selectedCourseIds: [own.id], sections: [{ courseCode: 'CS 101' }] },
  ];
  const clean = stripSampleData(snap);
  assert.deepEqual(clean.catalog, [own]);
  assert.deepEqual(clean.selected_courses, [own.id]);
  assert.deepEqual(Object.keys(clean.enabled_sections), [own.id]);
  assert.deepEqual(clean.course_colors, { 'CS 101': '#123456' });
  assert.deepEqual(clean.saved_schedules.map((s) => s.id), ['s2']);
  assert.equal(JSON.stringify(clean).includes('sample'), false, 'no sample ids or flags remain');
  assert.ok(snap.catalog.length > 1, 'input snapshot is not mutated');
});

test('a snapshot with only sample data strips down to nothing worth saving', () => {
  const clean = stripSampleData(applySampleData(emptySnapshot()));
  assert.equal(hasUserContent(clean), false);
  assert.equal(hasUserContent(applySampleData(emptySnapshot())), true);
});

test('clearing sample data removes every sample course, selection and saved schedule', () => {
  const payload = stripSampleData(applySampleData(emptySnapshot()));
  assert.equal(payload.catalog.length, 0);
  assert.equal(payload.selected_courses.length, 0);
  assert.equal(payload.saved_schedules.length, 0);
  assert.equal(hasSampleData(payload.catalog), false);
});

// ---------- copy alignment ----------

test('page title source, meta description and tagline carry the README purpose', () => {
  assert.match(BRAND.tagline, /college class schedule in minutes/i);
  assert.match(SITE_DESCRIPTION, /college class schedule in minutes/i);
  assert.ok(SITE_DESCRIPTION.length <= 175);
});
