// src/lib/userData.js
// ClassForge keeps every bit of a student's data in this browser's
// localStorage. There are no accounts and no server-side database.

// Same key the guest draft used before the open version, so anything a guest
// already built carries over.
export const LOCAL_DATA_KEY = 'class-forge.guest-draft.v1';

const DEFAULT = {
  catalog: [],
  curriculum: [],
  selected_courses: [],
  enabled_sections: {},
  blocked_times: [],
  preferences: {
    theme: 'dark',
    preferMornings: false,
    preferAfternoons: false,
    preferDaysOff: false,
    compactDays: false,
    showRequirementsOnBuilder: true,
    forecastOverloadCredits: 18,
    tutorialDismissed: { builder: false, data: false, record: false },
  },
  saved_schedules: [],
  degree_tracker: [],
  completed_courses: [],
  course_tags: {},
  course_colors: {},
};

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Returns the stored snapshot, or null when nothing (or nothing readable) is stored.
export function loadLocalUserData(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(LOCAL_DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed?.data;
    if (!data || typeof data !== 'object') return null;
    return {
      ...DEFAULT,
      ...data,
      preferences: { ...DEFAULT.preferences, ...(data.preferences || {}) },
    };
  } catch {
    return null;
  }
}

// Returns true when the write succeeded (storage can be full or blocked).
export function saveLocalUserData(data, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(
      LOCAL_DATA_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), data }),
    );
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_USER_DATA = DEFAULT;
