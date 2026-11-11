import CourtroomValidationClient from './CourtroomValidationClient';
import { buildMetadata, SITE_NAME } from '../../lib/seo.js';

export const metadata = buildMetadata({
  title: 'Courtroom Validation System',
  description:
    'Validate ideas through the Warden, Grand Jury, Prosecution, Analysts, Defense Counsel, Tribunal, and Executioner.',
  path: '/cvs',
  noindex: true,
});

export default function Page() {
  return <CourtroomValidationClient />;
}
