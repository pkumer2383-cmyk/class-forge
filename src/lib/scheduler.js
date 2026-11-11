// src/lib/scheduler.js
// =====================================================
// ClassForge — Schedule generator
// =====================================================
// Given a set of selected courses (each with multiple sections)
// and a set of "blocked times" the student is unavailable,
// returns every valid combination of one section per course
// such that no two sections overlap and no section overlaps
// a blocked time.
//
// Uses backtracking with most-constrained-first ordering for speed.
// =====================================================

// Returns true if two meeting blocks share at least one day AND overlap in time.
function meetingsOverlap(a, b) {
  const aDays = new Set(a.days);
  for (const d of b.days) {
    if (aDays.has(d)) {
      // Same day — check time overlap (treat as half-open [start,end))
      if (a.start < b.end && b.start < a.end) return true;
    }
  }
  return false;
}

// Does this section conflict with any meeting in `existing` (an array of meetings)?
function sectionConflicts(section, existingMeetings) {
  for (const m1 of section.meetings) {
    for (const m2 of existingMeetings) {
      if (meetingsOverlap(m1, m2)) return true;
    }
  }
  return false;
}

// Does this section conflict with any of the blocked times?
// blockedTimes: array of { days: [], start: number, end: number }
function sectionConflictsBlocks(section, blockedTimes) {
  if (!blockedTimes || !blockedTimes.length) return false;
  for (const m of section.meetings) {
    for (const b of blockedTimes) {
      if (meetingsOverlap(m, b)) return true;
    }
  }
  return false;
}

// Filter out sections that are individually invalid (overlap with blocked times,
// or are missing meeting info). Disabled sections are also dropped.
function filterValidSections(course, blockedTimes, disabledSet) {
  return (course.sections || []).filter(s => {
    if (!s.meetings || !s.meetings.length) return false;
    if (disabledSet && disabledSet.has(s.id)) return false;
    if (sectionConflictsBlocks(s, blockedTimes)) return false;
    return true;
  });
}

// Main entry. Returns up to `maxResults` schedules, each shaped as:
//   { id, sections: [{ courseId, courseCode, courseTitle, credits, ...section }] }
export function generateSchedules(courses, options = {}) {
  const {
    blockedTimes = [],
    disabledSectionIds = [],
    maxResults = 200,
  } = options;

  const disabledSet = new Set(disabledSectionIds);
  if (!Array.isArray(courses) || !courses.length) return { schedules: [], reason: 'no-courses' };

  // Prune each course's section list and bail early with a useful reason.
  const trimmed = courses.map(c => ({
    course: c,
    sections: filterValidSections(c, blockedTimes, disabledSet),
  }));

  for (const t of trimmed) {
    if (!t.sections.length) {
      return { schedules: [], reason: 'no-sections', course: t.course };
    }
  }

  // Most-constrained-first: courses with fewer remaining sections go first.
  trimmed.sort((a, b) => a.sections.length - b.sections.length);

  const results = [];
  const chosen = [];      // array of section objects
  const chosenMeetings = []; // flat list of meetings for fast conflict check

  function backtrack(idx) {
    if (results.length >= maxResults) return;
    if (idx === trimmed.length) {
      // Snapshot
      const snap = chosen.map((s, i) => {
        const c = trimmed.find(t => t.sections.some(sec => sec.id === s.id))?.course;
        return {
          courseId: c?.id,
          courseCode: c?.code,
          courseTitle: c?.title,
          credits: c?.credits ?? 3,
          ...s,
        };
      });
      results.push({
        id: 'sched_' + results.length,
        sections: snap,
      });
      return;
    }
    const { sections } = trimmed[idx];
    for (const sec of sections) {
      if (sectionConflicts(sec, chosenMeetings)) continue;
      chosen.push(sec);
      const before = chosenMeetings.length;
      for (const m of sec.meetings) chosenMeetings.push(m);
      backtrack(idx + 1);
      chosenMeetings.length = before;
      chosen.pop();
      if (results.length >= maxResults) return;
    }
  }

  backtrack(0);
  return { schedules: results, reason: results.length ? 'ok' : 'no-valid-combination' };
}

// Score a schedule against user preferences. Lower score is preferred unless inverted.
// Pref shape:
//   { preferMornings, preferAfternoons, preferDaysOff, compactDays, ... }
export function scoreSchedule(schedule, prefs = {}) {
  let score = 0;
  const meetings = schedule.sections.flatMap(s => s.meetings);
  const meetingsByDay = {};
  for (const m of meetings) {
    for (const d of m.days) {
      (meetingsByDay[d] ||= []).push(m);
    }
  }

  // Mornings/afternoons preference (lower score = better fit for what user wants)
  if (prefs.preferMornings) {
    score += meetings.reduce((a, m) => a + Math.max(0, m.start - 9 * 60), 0);
  }
  if (prefs.preferAfternoons) {
    score += meetings.reduce((a, m) => a + Math.max(0, 14 * 60 - m.start), 0);
  }
  // Days off — fewer active days = better
  if (prefs.preferDaysOff) {
    score += Object.keys(meetingsByDay).length * 60; // each active day is "expensive"
  }
  // Compact days — smaller daily span is better
  if (prefs.compactDays) {
    for (const d of Object.keys(meetingsByDay)) {
      const ms = meetingsByDay[d];
      const earliest = Math.min(...ms.map(m => m.start));
      const latest = Math.max(...ms.map(m => m.end));
      score += (latest - earliest);
    }
  }
  return score;
}

export function rankSchedules(schedules, prefs = {}) {
  return [...schedules]
    .map(s => ({ ...s, _score: scoreSchedule(s, prefs) }))
    .sort((a, b) => a._score - b._score);
}