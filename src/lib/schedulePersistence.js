// Pure schedule snapshot helpers used by the ClassForge save/retrieve journey.
// Keeping these transformations outside the React component makes them
// testable without a browser or private student data.

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createScheduleSnapshot({
  schedule,
  selectedCourseIds = [],
  enabledSections = {},
  blockedTimes = [],
  name = '',
  id,
  savedAt,
}) {
  if (!schedule?.sections?.length) return null;

  return Object.freeze({
    id,
    savedAt,
    name: String(name || '').trim(),
    selectedCourseIds: Object.freeze([...selectedCourseIds]),
    enabledSections: Object.freeze(clone(enabledSections)),
    blockedTimes: Object.freeze(clone(blockedTimes)),
    sections: Object.freeze(
      schedule.sections.map((section) =>
        Object.freeze({
          courseCode: section.courseCode,
          courseTitle: section.courseTitle,
          credits: section.credits,
          section: section.section,
          instructor: section.instructor,
          location: section.location,
          meetings: clone(section.meetings),
        }),
      ),
    ),
  });
}

export function restoreScheduleSelection(saved, catalog = []) {
  if (!saved) return { selectedCourseIds: [], enabledSections: {}, blockedTimes: [] };

  if (saved.selectedCourseIds) {
    const selectedCourseIds = [...saved.selectedCourseIds];
    const sectionsByCourseCode = {};
    for (const section of saved.sections || []) {
      if (!section.courseCode) continue;
      (sectionsByCourseCode[section.courseCode] ||= new Set()).add(section.section);
    }

    const enabledSections = {};
    for (const course of catalog) {
      if (!selectedCourseIds.includes(course.id)) continue;
      const wanted = sectionsByCourseCode[course.code] || new Set();
      const map = {};
      for (const section of course.sections || []) {
        map[section.id] = wanted.has(section.section);
      }
      enabledSections[course.id] = map;
    }

    return {
      selectedCourseIds,
      enabledSections,
      blockedTimes: clone(saved.blockedTimes || []),
    };
  }

  // Legacy saves (pre-v5) only carried course codes in their sections.
  const codes = new Set((saved.sections || []).map((section) => section.courseCode));
  return {
    selectedCourseIds: catalog.filter((course) => codes.has(course.code)).map((course) => course.id),
    enabledSections: {},
    blockedTimes: [],
  };
}

