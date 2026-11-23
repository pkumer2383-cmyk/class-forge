import { notAvailableResponse } from '../../../../lib/openVersion.js';

export const runtime = 'nodejs';

// POS runs were owner-only and needed sign-in; they are off in the open version.
export async function POST() {
  return notAvailableResponse();
}

export async function GET() {
  return notAvailableResponse();
}
