'use client';

import PageShell, { H2, P } from '../../components/PageShell';
import { BRAND } from '../../lib/brand';

const CONTACT_EMAIL = BRAND.supportEmail;

export default function ContactClient() {
  return (
    <PageShell title="Contact" lastUpdated="November 22, 2026">
      <H2>Email</H2>
      <P>
        Email is the way to reach us:{' '}
        <a href={'mailto:' + CONTACT_EMAIL} style={{ color: '#a5b4fc' }}>{CONTACT_EMAIL}</a>
      </P>
      <P style={{ color: '#94a3b8', fontSize: 14 }}>
        Reply time: usually within 1-2 business days. ClassForge is a small operation, so please be patient.
      </P>
      <P style={{ color: '#94a3b8', fontSize: 14 }}>
        The contact form is not available in the open version of ClassForge.
      </P>

      <H2>Privacy &amp; data requests</H2>
      <P>
        ClassForge has no accounts and keeps your schedule data in your own browser, so you can delete it yourself by clearing this site&apos;s data. For any other privacy question, email{' '}
        <a href={'mailto:' + CONTACT_EMAIL + '?subject=Privacy%20Request'} style={{ color: '#a5b4fc' }}>{CONTACT_EMAIL}</a>{' '}
        with subject line &quot;Privacy Request&quot;.
      </P>

      <H2>Mailing address</H2>
      <P>
        ClassForge<br />
        Pennsylvania, United States<br />
        <span style={{ color: '#64748b', fontSize: 13 }}>(For legal correspondence, please email first and a full mailing address will be provided.)</span>
      </P>
    </PageShell>
  );
}
