import assert from 'node:assert/strict';
import test from 'node:test';

import { parseByFilename } from '../../src/lib/parsers.js';
import { generateSchedules } from '../../src/lib/scheduler.js';
import {
  createScheduleSnapshot,
  restoreScheduleSelection,
} from '../../src/lib/schedulePersistence.js';

const csv = [
  'code,title,credits,section,instructor,location,days,start,end',
  'CS 101,Programming,3,001,Ada,Room 1,MWF,09:00,09:50',
  'CS 101,Programming,3,002,Grace,Room 2,TR,10:00,11:15',
  'HIST 201,History,3,001,Lin,Room 3,MWF,09:30,10:20',
  'HIST 201,History,3,002,Lee,Room 4,TR,11:30,12:45',
].join('\n');

test('a new student can import representative course data and select courses', () => {
  const catalog = parseByFilename('catalog.csv', csv);

  assert.equal(catalog.length, 2);
  assert.deepEqual(catalog.map((course) => course.code), ['CS 101', 'HIST 201']);
  assert.equal(catalog[0].sections.length, 2);
  assert.deepEqual(catalog[0].sections[0].meetings[0].days, ['Mon', 'Wed', 'Fri']);
});

test('invalid catalog data fails safely without creating phantom courses', () => {
  assert.deepEqual(parseByFilename('catalog.csv', 'not,a,valid\n'), []);
  assert.deepEqual(parseByFilename('catalog.json', '{not json}'), []);
});

test('schedule generation returns valid combinations and excludes conflicts', () => {
  const catalog = parseByFilename('catalog.csv', csv);
  const result = generateSchedules(catalog, { maxResults: 10 });

  assert.equal(result.reason, 'ok');
  assert.equal(result.schedules.length, 3);
  for (const schedule of result.schedules) {
    assert.equal(schedule.sections.length, 2);
    const [first, second] = schedule.sections;
    const firstMeeting = first.meetings[0];
    const secondMeeting = second.meetings[0];
    assert.equal(
      firstMeeting.days.some((day) => secondMeeting.days.includes(day)) &&
        firstMeeting.start < secondMeeting.end &&
        secondMeeting.start < firstMeeting.end,
      false,
    );
  }

  const blocked = generateSchedules(catalog, {
    blockedTimes: [{ days: ['Fri'], start: 540, end: 560 }],
  });
  assert.equal(blocked.schedules.length, 2);
});

test('conflicting courses produce an understandable empty result', () => {
  const courses = [
    { id: 'c1', code: 'BIO 1', title: 'Biology', sections: [{ id: 's1', section: '001', meetings: [{ days: ['Mon'], start: 600, end: 660 }] }] },
    { id: 'c2', code: 'CHEM 1', title: 'Chemistry', sections: [{ id: 's2', section: '001', meetings: [{ days: ['Mon'], start: 630, end: 690 }] }] },
  ];

  const result = generateSchedules(courses);
  assert.equal(result.reason, 'no-valid-combination');
  assert.deepEqual(result.schedules, []);
});

test('a generated schedule can be saved and retrieved without mutating the source', () => {
  const catalog = parseByFilename('catalog.csv', csv);
  const generated = generateSchedules(catalog).schedules[0];
  const snapshot = createScheduleSnapshot({
    schedule: generated,
    selectedCourseIds: catalog.map((course) => course.id),
    enabledSections: { [catalog[0].id]: { [catalog[0].sections[0].id]: true } },
    blockedTimes: [{ days: ['Fri'], start: 900, end: 960 }],
    name: 'Fall Plan #1',
    id: 'saved_test',
    savedAt: '2026-10-09T00:00:00.000Z',
  });

  assert.equal(snapshot.name, 'Fall Plan #1');
  assert.equal(snapshot.sections.length, 2);
  assert.deepEqual(snapshot.selectedCourseIds, ['c_cs_101', 'c_hist_201']);

  const restored = restoreScheduleSelection(snapshot, catalog);
  assert.deepEqual(restored.selectedCourseIds, snapshot.selectedCourseIds);
  assert.equal(restored.enabledSections[catalog[0].id][catalog[0].sections[0].id], true);
  assert.deepEqual(restored.blockedTimes, snapshot.blockedTimes);
  assert.notEqual(restored.blockedTimes, snapshot.blockedTimes);
});

test('legacy saved schedules restore by course code', () => {
  const catalog = parseByFilename('catalog.csv', csv);
  const restored = restoreScheduleSelection({
    sections: [{ courseCode: 'HIST 201', section: '002' }],
  }, catalog);

  assert.deepEqual(restored.selectedCourseIds, ['c_hist_201']);
  assert.deepEqual(restored.enabledSections, {});
});
