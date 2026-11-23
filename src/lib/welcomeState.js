// src/lib/welcomeState.js
// First-visit welcome: shown once per browser to guests with no courses.
// Storage is injectable so the logic can be tested without a browser, and
// every access is wrapped because storage can be blocked (private windows).

export const WELCOME_DISMISSED_KEY = 'class-forge.welcome-dismissed.v1';

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readWelcomeDismissed(storage = defaultStorage()) {
  try {
    return storage?.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeWelcomeDismissed(storage = defaultStorage()) {
  try {
    storage?.setItem(WELCOME_DISMISSED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

// The welcome opens by itself only for a guest with an empty catalog who has
// not dismissed it, and only once auth and saved data have finished loading
// (so a signed-in returning user never sees a flash of it).
export function shouldShowWelcome({ authChecked, loaded, signedIn, catalogLength, dismissed }) {
  return Boolean(authChecked && loaded && !signedIn && catalogLength === 0 && !dismissed);
}
