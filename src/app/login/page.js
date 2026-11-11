import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }) {
  const nextPath = typeof searchParams?.next === 'string' ? searchParams.next : '/';
  const initialError = typeof searchParams?.error === 'string' ? searchParams.error : null;

  return <LoginClient nextPath={nextPath} initialError={initialError} />;
}
