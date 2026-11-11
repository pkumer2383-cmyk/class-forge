import AgentLab from './AgentLab';
import { isPosOwner } from '@/lib/pos/access';
import { getAuthenticatedUser } from '@/lib/supabase/api-auth';
import { redirect } from 'next/navigation';
import { buildMetadata, SITE_NAME } from '../../lib/seo.js';

export const metadata = buildMetadata({
  title: 'Agent Lab',
  description:
    'Multi-agent operating system prototype for autonomous company workflows.',
  path: '/agents',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/login?next=%2Fagents');
  }

  if (!isPosOwner(user)) {
    redirect('/');
  }

  return <AgentLab />;
}
