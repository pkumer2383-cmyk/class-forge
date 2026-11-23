import { notAvailableResponse } from '../../../../lib/openVersion.js';

export const runtime = 'nodejs';

// POS status was owner-only and needed sign-in; it is off in the open version.
export async function GET() {
  return notAvailableResponse();
}
