import PageShell, { P } from '../../components/PageShell';
import { buildMetadata } from '../../lib/seo.js';
import { NOT_AVAILABLE_MESSAGE } from '../../lib/openVersion.js';

export const metadata = buildMetadata({
  title: 'Agent Lab',
  description: 'Agent Lab is not available in the open version of ClassForge.',
  path: '/agents',
  noindex: true,
});

export default function Page() {
  return (
    <PageShell title="Agent Lab">
      <P>{NOT_AVAILABLE_MESSAGE}</P>
      <P>The schedule builder, saved schedules and My Record all work in your browser.</P>
    </PageShell>
  );
}
