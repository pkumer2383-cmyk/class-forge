// src/lib/moderation.js
// =====================================================
// Content moderation for user-generated reviews.
// =====================================================
// Philosophy: Patrick wants users to be able to vent honestly
// ("this app is shit") without blocking. We block content that crosses
// from "harsh criticism" into "abuse, slurs, threats, or harassment."
//
// Three categories of blocked content:
//   1. Slurs targeting protected groups
//   2. Direct threats of violence
//   3. Harassment of identifiable individuals
//
// What we DO NOT block:
//   - Profanity used as emphasis (shit, damn, fuck, ass, etc.)
//   - Negative opinions, even very harsh ones
//   - Sexual references that aren't directed at someone
//
// Returns: { ok: boolean, reason?: string }
// =====================================================

// Slurs — a small, deliberately-curated list of unambiguous slurs.
// We use word-boundary matching so substrings within normal words don't trigger.
// This list is intentionally short to minimize false positives. Real production
// systems (Perspective API, OpenAI moderation) handle this far better — but
// for an early-stage app this is a reasonable filter.
const SLUR_PATTERNS = [
  // Racial slurs
  /\bn[i1]gg[ae3]r?s?\b/i,
  /\bn[i1]gga?s?\b/i,
  /\bch[i1]nk[s]?\b/i,
  /\bg[o0]{2}ks?\b/i,
  /\bsp[i1]cs?\b/i,
  /\bk[i1]kes?\b/i,
  /\bw[e3]tbacks?\b/i,
  // Homophobic slurs
  /\bf[a4]gg?[o0]ts?\b/i,
  /\bf[a4]gs?\b/i,
  /\bd[y1]kes?\b/i,
  /\btr[a4]nn[i1]es?\b/i,
  /\btr[a4]nny\b/i,
  // Ableist slurs
  /\br[e3]t[a4]rds?\b/i,
  /\br[e3]t[a4]rd[e3]d\b/i,
  // Misogynistic slurs (the strongest ones; "bitch" alone is too common as emphasis to block)
  /\bcunts?\b/i,
];

// Threats — patterns that suggest direct threats of violence
const THREAT_PATTERNS = [
  // "I will kill/hurt/etc you" — direct threats with first-person subject
  /\bi('?m| am| will| 'll| ll)\b[\s\w]{0,40}\b(kill|murder|stab|shoot|behead|lynch|rape|attack|assault|beat\s+up|hurt|harm)\b[\s\w]{0,40}\b(you|him|her|them|developer|dev|admin)\b/i,
  /\b(kill|murder|shoot|stab|behead|lynch|hang)\s+(yourself|himself|herself|themselves|all of you)/i,
  /\bgo\s+(kill|hang|shoot)\s+(yourself|yourselves|himself|herself)/i,
];

// Harassment indicators — content that names identifiable people in hostile ways
const HARASSMENT_PATTERNS = [
  // "kys" abbreviation for "kill yourself"
  /\bkys\b/i,
  // dox-y patterns: "[name] lives at" / "[name]'s address is"
  /\b(lives at|home address|phone number)\s*(?:is\s*)?[\d\s,]+/i,
];

export function moderateReview(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'empty' };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }
  if (trimmed.length > 5000) {
    return { ok: false, reason: 'too_long' };
  }

  // Slur check
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: 'slur',
        message: 'Your review contains language that targets a protected group. Honest criticism of the app is welcome — even harsh language about the app itself is fine — but slurs and targeted hate are not.',
      };
    }
  }

  // Threat check
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: 'threat',
        message: 'Your review reads as a threat of violence. We can\'t accept that. If you\'re frustrated with the app, please tell us specifically what went wrong instead.',
      };
    }
  }

  // Harassment check
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: 'harassment',
        message: 'Your review contains language directed at a specific person in a way that violates our policy. Reviews should focus on the app, not target individuals.',
      };
    }
  }

  return { ok: true };
}

// Exposed for tests
export const _internal = { SLUR_PATTERNS, THREAT_PATTERNS, HARASSMENT_PATTERNS };