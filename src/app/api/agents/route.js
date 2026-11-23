import { notAvailableResponse } from '../../../lib/openVersion.js';

export const runtime = 'nodejs';

// Agent Lab was owner-only and needed sign-in; it is off in the open version.
export async function POST() {
  return notAvailableResponse();
}
