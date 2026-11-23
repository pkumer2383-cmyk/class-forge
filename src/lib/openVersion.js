// src/lib/openVersion.js
// Features that needed accounts or a server database are switched off in the
// open version of ClassForge. Everything else runs in the browser.

export const NOT_AVAILABLE_MESSAGE = 'This feature is not available in the open version of ClassForge.';

export function notAvailableResponse(message = NOT_AVAILABLE_MESSAGE) {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}
