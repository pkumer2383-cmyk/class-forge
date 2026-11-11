import AuthCallbackClient from './AuthCallbackClient';
import { buildMetadata, SITE_NAME } from '../../../lib/seo.js';

export const metadata = buildMetadata({
  title: 'Authenticating',
  path: '/auth/callback',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage({ searchParams }) {
  const nextPath = typeof searchParams?.next === 'string' ? searchParams.next : '/';
  return <AuthCallbackClient nextPath={nextPath} />;
}
