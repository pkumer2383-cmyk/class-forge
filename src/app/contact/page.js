import ContactClient from './ContactClient';
import { buildMetadata } from '../../lib/seo.js';

export const metadata = buildMetadata({
  title: 'Contact',
  description:
    'Reach ClassForge for support, feature requests, partnership questions, privacy requests, or bug reports.',
  path: '/contact',
  keywords: ['contact ClassForge', 'support', 'feature request', 'partnership'],
});

export default function ContactPage() {
  return <ContactClient />;
}
