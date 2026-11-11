// src/lib/reviews.js
// =====================================================
// ClassForge — Reviews
// =====================================================
// Reviews are simple text submissions. Anyone can read; only
// authenticated users can submit, and they own (can delete) their own.
// Content is moderated for slurs, threats, and harassment — but NOT for
// general profanity or harsh criticism.
// =====================================================

import { supabase } from './supabase';
import { moderateReview } from './moderation';

const TABLE = 'reviews';

function describeError(err) {
  if (!err) return '(no error)';
  return {
    message: err.message || '(no message)',
    code: err.code || '(no code)',
    details: err.details || '(no details)',
    hint: err.hint || '(no hint)',
  };
}

// Returns latest 50 reviews
export async function loadReviews() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, body, created_at, author_label, user_id')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[loadReviews] error', describeError(error));
    return [];
  }
  return data || [];
}

// userId required; throws if not signed in
// authorLabel: optional display name (e.g., "Patrick K." or "anonymous")
export async function submitReview({ userId, body, authorLabel }) {
  if (!userId) return { error: new Error('Not signed in') };
  const trimmed = String(body || '').trim();
  if (!trimmed) return { error: new Error('Review cannot be empty') };
  if (trimmed.length > 5000) return { error: new Error('Review is too long (max 5000 chars)') };

  // Content moderation — block slurs, threats, harassment.
  // General profanity (shit, fuck, etc.) is allowed.
  const mod = moderateReview(trimmed);
  if (!mod.ok) {
    return {
      error: new Error(mod.message || 'Your review violates our content policy.'),
      moderation: mod,
    };
  }

  const row = {
    user_id: userId,
    body: trimmed,
    author_label: (authorLabel || '').trim().slice(0, 60) || 'anonymous',
  };
  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error('[submitReview] error', describeError(error));
  }
  return { data, error };
}

export async function deleteReview(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) console.error('[deleteReview] error', describeError(error));
  return { error };
}