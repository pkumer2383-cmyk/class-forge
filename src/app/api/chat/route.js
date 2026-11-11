// src/app/api/chat/route.js
//
// Server-side proxy to Google Gemini API (free tier).
// The API key is read from the GEMINI_API_KEY environment variable
// and NEVER sent to the browser. This file runs only on the Next.js server.

export const runtime = 'nodejs';

import { requireAuthenticatedUser } from '@/lib/supabase/api-auth';

const MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = 'You are an academic advising assistant inside the ClassForge schedule builder app. ' +
  'Your role is to help college students plan their semesters, choose courses, and think through their degree requirements.\n\n' +
  'Be friendly, specific, and concrete. When a student shares their data (catalog, requirements, completed courses, current schedule), reference it directly in your advice. ' +
  'If they upload a file or paste their transcript, parse it carefully and discuss specific courses by name. ' +
  'When suggesting course combinations, explain WHY: prerequisite chains, balance of workload, time-of-day distribution, days-off optimization. ' +
  'You CAN access the student\'s ClassForge data when they share it with you in the conversation. ' +
  'Give complete, thorough answers — students rely on this advice for real decisions. ' +
  'Format longer responses with markdown lists or numbered steps so they\'re easy to scan. ' +
  'If asked about something outside academic planning, briefly acknowledge it then redirect to academics.';

function jsonError(message, status) {
  return new Response(
    JSON.stringify({ error: message }),
    { status: status, headers: { 'content-type': 'application/json' } }
  );
}

export async function POST(request) {
  try {
    const { response } = await requireAuthenticatedUser();
    if (response) return response;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonError(
        'Server is missing the GEMINI_API_KEY environment variable. Get a free key at https://aistudio.google.com/app/apikey and add it to .env.local (then restart the dev server).',
        503
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonError('Could not parse request body as JSON.', 400);
    }

    const messages = Array.isArray(body && body.messages) ? body.messages : [];
    if (!messages.length) {
      return jsonError('No messages provided.', 400);
    }

    // Sanitize: only accept user/assistant roles. Each message contributes one
    // text part (its `content`) plus zero or more binary parts (from
    // `parts: [{inline_data: {...}}]`, used for image/PDF attachments).
    // Gemini uses "user" and "model" instead of "user" and "assistant".
    // Cap to last 20 messages and 20000 chars/each to bound token usage
    // (20k chars allows pasting a full transcript or syllabus).
    const cleaned = [];
    for (const m of messages) {
      if (!m) continue;
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      const parts = [];
      if (typeof m.content === 'string' && m.content.length) {
        parts.push({ text: m.content.slice(0, 20000) });
      }
      // Accept inline binary parts (image/PDF) from the client
      if (Array.isArray(m.parts)) {
        for (const p of m.parts) {
          if (p && p.inline_data && typeof p.inline_data.data === 'string' && typeof p.inline_data.mime_type === 'string') {
            // Safety: only accept image/* and application/pdf
            const mt = p.inline_data.mime_type;
            if (mt.startsWith('image/') || mt === 'application/pdf') {
              parts.push({ inline_data: { mime_type: mt, data: p.inline_data.data } });
            }
          }
        }
      }
      if (!parts.length) continue;
      cleaned.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts,
      });
    }
    const trimmed = cleaned.slice(-20);

    if (!trimmed.length) {
      return jsonError('No valid messages after sanitization.', 400);
    }

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

    let upstream;
    try {
      upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: trimmed,
          generationConfig: {
            // 8192 is the maximum for gemini-2.5-flash. Use the full window so
            // responses aren't cut off mid-sentence.
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        }),
      });
    } catch (fetchErr) {
      console.error('[chat API] fetch failed', fetchErr);
      return jsonError('Could not reach the Gemini API. Check your internet connection and try again.', 502);
    }

    if (!upstream.ok) {
      let upstreamText = '';
      try { upstreamText = await upstream.text(); } catch (e) {}
      console.error('[chat API] Gemini error', upstream.status, upstreamText.slice(0, 500));

      let userMessage = 'Chat service returned an error: HTTP ' + upstream.status;
      let retryAfterSeconds = null;

      if (upstream.status === 401 || upstream.status === 403) {
        userMessage = 'Invalid Gemini API key. Check the GEMINI_API_KEY environment variable in .env.local (no quotes around the value), then restart the dev server.';
      } else if (upstream.status === 429) {
        const retryHeader = upstream.headers.get('retry-after');
        if (retryHeader) {
          const parsed = parseInt(retryHeader, 10);
          if (Number.isFinite(parsed) && parsed > 0 && parsed < 3600) {
            retryAfterSeconds = parsed;
          }
        }
        if (retryAfterSeconds === null) retryAfterSeconds = 60;
        userMessage = 'Rate limit hit (free tier is 10 messages/minute, 250/day). Come back in ' + retryAfterSeconds + ' seconds and try again.';
      } else if (upstream.status === 400) {
        userMessage = 'Gemini rejected the request. The conversation or attached file may be too large — try clearing the chat or attaching a smaller file.';
      } else if (upstream.status >= 500) {
        userMessage = 'Gemini service is having issues. Try again in a moment.';
      }
      const errBody = { error: userMessage };
      if (retryAfterSeconds !== null) errBody.retryAfterSeconds = retryAfterSeconds;
      return new Response(
        JSON.stringify(errBody),
        { status: 502, headers: { 'content-type': 'application/json' } }
      );
    }

    let data;
    try {
      data = await upstream.json();
    } catch (e) {
      console.error('[chat API] could not parse Gemini response', e);
      return jsonError('Gemini returned an unparseable response.', 502);
    }

    const candidate = (data && data.candidates && data.candidates[0]) || null;
    if (!candidate) {
      console.error('[chat API] no candidate in response', JSON.stringify(data).slice(0, 500));
      return jsonError('Gemini returned an empty response. Try rephrasing your question.', 502);
    }

    if (!candidate.content || !Array.isArray(candidate.content.parts)) {
      const reason = candidate.finishReason || 'unknown';
      console.error('[chat API] no content', reason);
      return jsonError(
        'The response was filtered or empty (reason: ' + reason + '). Try rephrasing your question — the safety filter may have triggered on a sensitive word.',
        502
      );
    }

    const reply = candidate.content.parts
      .filter(function (p) { return typeof p.text === 'string'; })
      .map(function (p) { return p.text; })
      .join('\n')
      .trim();

    if (!reply) {
      return jsonError('Empty response from the model.', 502);
    }

    // Report whether the response was truncated so the client can warn the user
    const responseBody = { reply: reply };
    if (candidate.finishReason === 'MAX_TOKENS') {
      responseBody.truncated = true;
    }

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('[chat API] unexpected error', err);
    return jsonError('Internal error: ' + (err && err.message ? err.message : String(err)), 500);
  }
}
