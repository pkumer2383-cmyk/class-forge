export const ANALYTICS_EVENTS = Object.freeze({
  appOpened: 'app_opened',
  scheduleBuilderStarted: 'schedule_builder_started',
  scheduleGenerated: 'schedule_generated',
  scheduleSaved: 'schedule_saved',
  savedSchedulePreviewed: 'saved_schedule_previewed',
  savedScheduleLoaded: 'saved_schedule_loaded',
});

export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', name, {
    app: 'ClassForge',
    ...params,
  });
}

export function getUtmParams() {
  if (typeof window === 'undefined') return {};
  const search = new URLSearchParams(window.location.search);
  const out = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}

