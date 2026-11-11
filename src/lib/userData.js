// src/lib/userData.js
import { supabase } from './supabase';

const TABLE = 'user_data';

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

// Pull the actually-useful fields out of a Supabase error so console.error
// shows the real message instead of "{}"
function describeError(err) {
  if (!err) return '(no error)';
  return {
    message: err.message || '(no message)',
    code: err.code || '(no code)',
    details: err.details || '(no details)',
    hint: err.hint || '(no hint)',
    status: err.status || '(no status)',
  };
}

export async function loadUserData(userId) {
  if (!userId) return { ...DEFAULT };
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.error('[loadUserData] error', describeError(error));
  }
  if (!data) return { ...DEFAULT };
  return {
    catalog:           data.catalog           ?? DEFAULT.catalog,
    curriculum:        data.curriculum        ?? DEFAULT.curriculum,
    selected_courses:  data.selected_courses  ?? DEFAULT.selected_courses,
    enabled_sections:  data.enabled_sections  ?? DEFAULT.enabled_sections,
    blocked_times:     data.blocked_times     ?? DEFAULT.blocked_times,
    preferences:       { ...DEFAULT.preferences, ...(data.preferences || {}) },
    saved_schedules:   data.saved_schedules   ?? DEFAULT.saved_schedules,
    degree_tracker:    data.degree_tracker    ?? DEFAULT.degree_tracker,
    completed_courses: data.completed_courses ?? DEFAULT.completed_courses,
    course_tags:       data.course_tags       ?? DEFAULT.course_tags,
    course_colors:     data.course_colors     ?? DEFAULT.course_colors,
  };
}

export async function saveUserData(userId, payload) {
  if (!userId) return { error: new Error('no userId') };
  const row = {
    user_id: userId,
    catalog:           payload.catalog           ?? null,
    curriculum:        payload.curriculum        ?? null,
    selected_courses:  payload.selected_courses  ?? null,
    enabled_sections:  payload.enabled_sections  ?? null,
    blocked_times:     payload.blocked_times     ?? null,
    preferences:       payload.preferences       ?? null,
    saved_schedules:   payload.saved_schedules   ?? null,
    degree_tracker:    payload.degree_tracker    ?? null,
    completed_courses: payload.completed_courses ?? null,
    course_tags:       payload.course_tags       ?? null,
    course_colors:     payload.course_colors     ?? null,
    updated_at:        new Date().toISOString(),
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error('[saveUserData] error', describeError(error));
    console.error('[saveUserData] row keys sent:', Object.keys(row));
  }
  return { error };
}

export const DEFAULT_USER_DATA = DEFAULT;