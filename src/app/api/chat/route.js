// src/app/api/chat/route.js
// The AI Advisor needed signed-in accounts to keep the Gemini key from being
// used anonymously. The open version has no accounts, so the route is off.

import { notAvailableResponse } from '../../../lib/openVersion.js';

export const runtime = 'nodejs';

export async function POST() {
  return notAvailableResponse('The AI Advisor is not available in the open version of ClassForge.');
}
