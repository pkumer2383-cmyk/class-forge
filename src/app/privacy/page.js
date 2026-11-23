// src/app/privacy/page.js
import PageShell, { H2, H3, P, UL, LI, Strong } from '../../components/PageShell';
import { buildMetadata } from '../../lib/seo.js';
import { BRAND } from '../../lib/brand.js';

export const metadata = {
  ...buildMetadata({
    title: 'Privacy Policy',
    description:
      'ClassForge has no accounts and no database: your schedule data stays in your own browser. Read what that means for your privacy.',
    path: '/privacy',
    keywords: ['privacy policy', 'student data', 'ClassForge privacy'],
  }),
};

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" lastUpdated="November 22, 2026" attorneyReview>
      <H2>1. Who we are</H2>
      <P>
        ClassForge (&quot;we&quot;, &quot;us&quot;, &quot;the Service&quot;) is operated as an independent project based in Pennsylvania. You can reach us at <Strong>{BRAND.supportEmail}</Strong>.
      </P>
      <P style={{ color: '#94a3b8', fontSize: 14 }}>
        <em>Note: Upon formal entity formation (planned: ClassForge LLC, a Pennsylvania limited liability company), this section will be updated with the registered business name and state of formation. For now, this Service is operated by an individual sole proprietor.</em>
      </P>

      <H2>2. The short version</H2>
      <UL>
        <LI>ClassForge has no accounts and no sign-in. We do not collect your email or a password.</LI>
        <LI>Your course catalog, saved schedules, record and settings are saved in your own browser (its local storage). They are not sent to us and we have no database that holds them.</LI>
        <LI>We do not sell your data. Ever.</LI>
        <LI>You can delete your data at any time by clearing this site&apos;s data in your browser.</LI>
        <LI>We don&apos;t currently show ads. If that changes, this policy will be updated and you&apos;ll see a notice in the app.</LI>
      </UL>

      <H2>3. What is stored, and where</H2>
      <H3>3.1 Schedule data stays in your browser</H3>
      <P>When you use the app, your browser stores:</P>
      <UL>
        <LI>The course catalog you upload</LI>
        <LI>Your degree requirements and tracker</LI>
        <LI>Your completed courses, grades, and forecasted future courses</LI>
        <LI>Your saved schedules</LI>
        <LI>Your app preferences (theme, settings)</LI>
      </UL>
      <P>
        This data is kept in your browser&apos;s local storage on your device only. It is not uploaded to ClassForge, other users cannot see it, and it does not follow you to another browser or device. Clearing your browser&apos;s site data, or using a private window, removes it, so it cannot be recovered by us.
      </P>

      <H3>3.2 Features that are off</H3>
      <P>
        The open version of ClassForge has no accounts, so the features that needed them are switched off: sign-in, the AI Advisor, public reviews, and the contact form. If you email us, we receive what you choose to send.
      </P>

      <H3>3.3 Technical data</H3>
      <P>
        Our hosting provider (Vercel) automatically logs basic technical information about each request: IP address, browser type, page accessed, and timestamp. These logs are retained for a short period (typically 30 days) for debugging and security purposes. If analytics are enabled, ClassForge may also use Google Analytics to understand aggregate product usage, such as page views and device/browser categories.
      </P>

      <H2>4. How we use data</H2>
      <UL>
        <LI><Strong>To run the app.</Strong> Your browser uses the data it stores to display your schedules, calculate your GPA, generate forecasts, and remember your settings.</LI>
        <LI><Strong>To respond to you.</Strong> If you email us, we use your email address to reply.</LI>
        <LI><Strong>To debug and improve.</Strong> Server logs help us find bugs.</LI>
        <LI><Strong>For legal compliance.</Strong> If required by law, we may need to retain or disclose the limited data we hold.</LI>
      </UL>
      <P>
        We do <Strong>not</Strong> use your data to:
      </P>
      <UL>
        <LI>Sell to third parties</LI>
        <LI>Share with advertisers</LI>
        <LI>Build advertising profiles</LI>
        <LI>Train AI models</LI>
      </UL>

      <H2>5. Third-party services we use</H2>
      <H3>5.1 Vercel (web hosting)</H3>
      <P>
        Vercel Inc. hosts the website. See Vercel&apos;s privacy policy: <a href="https://vercel.com/legal/privacy-policy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">vercel.com/legal/privacy-policy</a>.
      </P>
      <H3>5.2 Google Analytics (site analytics - if enabled)</H3>
      <P>
        If analytics are enabled, Google Analytics helps us measure aggregate usage and improve the product. See Google&apos;s privacy policy: <a href="https://policies.google.com/privacy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">policies.google.com/privacy</a>.
      </P>

      <H2>6. Cookies and local storage</H2>
      <P>
        ClassForge does not use sign-in cookies. It uses your browser&apos;s local storage to keep your schedule data on your device. If analytics are enabled, Google Analytics may set measurement cookies. We do not use advertising or social-media tracking cookies.
      </P>
      <P>
        If we add advertising in the future, this section will be updated to disclose any third-party ad networks (e.g., Google AdSense) and the cookies they use. We will also add a cookie consent banner at that time.
      </P>

      <H2>7. Your rights</H2>
      <P>
        Because your schedule data is stored only in your browser, you control it directly: you can view and edit it in the app, and delete it by clearing this site&apos;s data. We hold no copy of it to send, correct or delete.
      </P>
      <P>
        California residents have rights under the CCPA, and EU/UK residents under GDPR. For any request about the limited data we do hold (server logs, emails you send us), email us.
      </P>

      <H2>8. Children&apos;s privacy</H2>
      <P>
        ClassForge is intended for college students, who are typically 18 or older. We do not knowingly collect data from children under 13. If you believe a child under 13 has provided us with information, contact us and we will delete it.
      </P>
      <P>
        If you are between 13 and 17 and using ClassForge (e.g., as a dual-enrollment high school student), please use the app with a parent or guardian&apos;s awareness.
      </P>

      <H2>9. FERPA</H2>
      <P>
        The Family Educational Rights and Privacy Act (FERPA) protects student educational records held by educational institutions that receive U.S. federal funding. ClassForge is <Strong>not</Strong> an educational institution and is not directly subject to FERPA.
      </P>
      <P>
        However, the data you upload (your degree audit, transcript, course catalog) may contain information that originated in a FERPA-protected context. By uploading this data, you confirm that you have the right to do so. We treat your data as confidential and only use it as described in this policy.
      </P>
      <P>
        If ClassForge ever enters into a contract with a college or university to receive student data directly, we will sign a FERPA-compliant Data Sharing Agreement and update this policy accordingly.
      </P>

      <H2>10. Data retention</H2>
      <UL>
        <LI><Strong>Schedule data</Strong> stays in your browser until you clear it. We never receive it.</LI>
        <LI><Strong>Emails you send us</Strong> are kept for up to 2 years for support history, then deleted.</LI>
        <LI><Strong>Server logs</Strong> are retained for ~30 days.</LI>
      </UL>

      <H2>11. Security</H2>
      <P>
        The site is served over encrypted connections (HTTPS). Your schedule data never leaves your device, so it is only as private as the browser and device you use: anyone with access to that browser profile can see it.
      </P>

      <H2>12. Changes to this policy</H2>
      <P>
        If we make material changes to this policy, we will update the &quot;Last updated&quot; date at the top and, for significant changes, post a notice in the app. Continued use after a change constitutes acceptance of the updated policy.
      </P>

      <H2>13. Contact for privacy questions</H2>
      <P>
        Email <Strong>{BRAND.supportEmail}</Strong> with subject &quot;Privacy Request&quot; for any of the rights listed above, or any questions about this policy.
      </P>
    </PageShell>
  );
}
