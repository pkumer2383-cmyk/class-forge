// src/app/privacy/page.js
import PageShell, { H2, H3, P, UL, LI, Strong } from '../../components/PageShell';
import { buildMetadata } from '../../lib/seo.js';
import { BRAND } from '../../lib/brand.js';

export const metadata = {
  ...buildMetadata({
    title: 'Privacy Policy',
    description:
      'Read how ClassForge collects, stores, and protects your schedule data, account details, and AI Advisor activity.',
    path: '/privacy',
    keywords: ['privacy policy', 'student data', 'ClassForge privacy'],
  }),
};

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" lastUpdated="August 23, 2026" attorneyReview>
      <H2>1. Who we are</H2>
      <P>
        ClassForge (&quot;we&quot;, &quot;us&quot;, &quot;the Service&quot;) is operated as an independent project based in Pennsylvania. You can reach us at <Strong>{BRAND.supportEmail}</Strong>.
      </P>
      <P style={{ color: '#94a3b8', fontSize: 14 }}>
        <em>Note: Upon formal entity formation (planned: ClassForge LLC, a Pennsylvania limited liability company), this section will be updated with the registered business name and state of formation. For now, this Service is operated by an individual sole proprietor.</em>
      </P>

      <H2>2. The short version</H2>
      <UL>
        <LI>We collect the minimum data needed to make the app work: your email (for sign-in), your course catalog, and your saved schedules.</LI>
        <LI>We do not sell your data. Ever.</LI>
        <LI>We use Supabase to store your data and Google Gemini to power the AI Advisor. Both are described in detail below.</LI>
        <LI>You can delete your data at any time by emailing us.</LI>
        <LI>We don&apos;t currently show ads. If that changes, this policy will be updated and you&apos;ll see a notice in the app.</LI>
      </UL>

      <H2>3. What we collect</H2>
      <H3>3.1 Account information</H3>
      <P>When you sign up, we collect:</P>
      <UL>
        <LI>Your email address (required, used for sign-in and account recovery)</LI>
        <LI>If you sign in with Google: your Google ID and the name on your Google account</LI>
        <LI>A hashed password (only if you sign up with email/password instead of Google)</LI>
      </UL>

      <H3>3.2 Schedule data</H3>
      <P>When you use the app, we store:</P>
      <UL>
        <LI>The course catalog you upload</LI>
        <LI>Your degree requirements and tracker</LI>
        <LI>Your completed courses, grades, and forecasted future courses</LI>
        <LI>Your saved schedules</LI>
        <LI>Your app preferences (theme, settings)</LI>
      </UL>
      <P>
        This data is stored in our Supabase database under your user account and is only accessible to you when you sign in. Other users cannot see your data.
      </P>

      <H3>3.3 AI Advisor conversations</H3>
      <P>
        When you use the AI Advisor, your messages are sent to <Strong>Google&apos;s Gemini API</Strong> to generate a response. The conversation is held in your browser and clears when you refresh the page - we do not store chat history on our servers.
      </P>
      <P>
        <Strong>Important:</Strong> ClassForge currently uses Google&apos;s Gemini free tier. Per Google&apos;s terms, prompts and responses on the free tier <Strong>may be used by Google to improve their AI models</Strong>. Do not paste sensitive personal information (student ID numbers, full legal names, social security numbers, medical or financial details) into the AI Advisor.
      </P>
      <P>
        If we move to Google&apos;s paid tier in the future, that data-use clause goes away. We will update this policy if and when that change happens.
      </P>

      <H3>3.4 Reviews you submit</H3>
      <P>
        If you submit a review on the Feedback tab, the text of your review and the display name you choose are stored and made publicly visible to other ClassForge users. We do not display your email address.
      </P>

      <H3>3.5 Contact form submissions</H3>
      <P>
        If you use the contact form, we store the name, email, topic, and message you submitted in our database so we can read and reply.
      </P>

      <H3>3.6 Technical data</H3>
      <P>
        Our hosting provider (Vercel) automatically logs basic technical information about each request: IP address, browser type, page accessed, and timestamp. These logs are retained for a short period (typically 30 days) for debugging and security purposes. If analytics are enabled, ClassForge may also use Google Analytics to understand aggregate product usage, such as page views and device/browser categories.
      </P>

      <H2>4. How we use your data</H2>
      <UL>
        <LI><Strong>To run the app.</Strong> We use your data to display your schedules, calculate your GPA, generate forecasts, and remember your settings.</LI>
        <LI><Strong>To respond to you.</Strong> If you contact us, we use your email to reply.</LI>
        <LI><Strong>To debug and improve.</Strong> Server logs help us find bugs.</LI>
        <LI><Strong>For legal compliance.</Strong> If required by law, we may need to retain or disclose data.</LI>
      </UL>
      <P>
        We do <Strong>not</Strong> use your data to:
      </P>
      <UL>
        <LI>Sell to third parties</LI>
        <LI>Share with advertisers</LI>
        <LI>Build advertising profiles</LI>
        <LI>Train our own AI models (we don&apos;t have any)</LI>
      </UL>

      <H2>5. Third-party services we use</H2>
      <H3>5.1 Supabase (database and authentication)</H3>
      <P>
        Supabase Inc. hosts our database and handles authentication. They are bound by their own privacy policy: <a href="https://supabase.com/privacy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">supabase.com/privacy</a>.
      </P>
      <H3>5.2 Google (Gemini API and OAuth sign-in)</H3>
      <P>
        Google LLC provides the AI Advisor&apos;s underlying language model and (optionally) Google Sign-In. See Google&apos;s privacy policy: <a href="https://policies.google.com/privacy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">policies.google.com/privacy</a>.
      </P>
      <H3>5.3 Vercel (web hosting)</H3>
      <P>
        Vercel Inc. hosts the website. See Vercel&apos;s privacy policy: <a href="https://vercel.com/legal/privacy-policy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">vercel.com/legal/privacy-policy</a>.
      </P>
      <H3>5.4 Google Analytics (site analytics - if enabled)</H3>
      <P>
        If analytics are enabled, Google Analytics helps us measure aggregate usage and improve the product. See Google&apos;s privacy policy: <a href="https://policies.google.com/privacy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">policies.google.com/privacy</a>.
      </P>
      <H3>5.5 Stripe (payment processing - when paywall launches)</H3>
      <P>
        When the paid AI Advisor launches, Stripe Inc. will process payments. We never see your full credit card number - Stripe handles all of it. See Stripe&apos;s privacy policy: <a href="https://stripe.com/privacy" style={{ color: '#a5b4fc' }} target="_blank" rel="noopener">stripe.com/privacy</a>.
      </P>

      <H2>6. Cookies and tracking</H2>
      <P>
        ClassForge uses a small number of cookies that are strictly necessary to keep you signed in. If analytics are enabled, Google Analytics may set measurement cookies. We do not use advertising or social-media tracking cookies.
      </P>
      <P>
        If we add advertising in the future, this section will be updated to disclose any third-party ad networks (e.g., Google AdSense) and the cookies they use. We will also add a cookie consent banner at that time.
      </P>

      <H2>7. Your rights</H2>
      <P>You have the right to:</P>
      <UL>
        <LI><Strong>Access your data.</Strong> Email us and we&apos;ll send you a copy of everything stored under your account.</LI>
        <LI><Strong>Correct your data.</Strong> Most data is editable directly in the app. For anything else, email us.</LI>
        <LI><Strong>Delete your data.</Strong> Email us with subject &quot;Delete my account&quot; and we&apos;ll delete your account and all associated data within 30 days.</LI>
        <LI><Strong>Export your data.</Strong> Same process - email us and we&apos;ll send a JSON export.</LI>
        <LI><Strong>Opt out of AI Advisor data sharing.</Strong> The Advisor tab has a toggle labeled &quot;Share my data with the AI&quot;. Turning it off prevents your schedule data from being included in API calls to Google.</LI>
      </UL>
      <P>
        California residents have additional rights under the CCPA (right to know, right to delete, right to opt out of sale - though we don&apos;t sell data). Email us to exercise these rights.
      </P>
      <P>
        EU/UK residents have rights under GDPR (data portability, right to erasure, right to object, etc.). Email us. Note that the AI Advisor free tier is regionally restricted by Google and may not be available in the EU/UK.
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
        <LI><Strong>Account data</Strong> is retained as long as your account is active.</LI>
        <LI><Strong>Reviews</Strong> remain visible until you delete them or close your account.</LI>
        <LI><Strong>Contact form submissions</Strong> are retained for up to 2 years for support history, then deleted.</LI>
        <LI><Strong>Server logs</Strong> are retained for ~30 days.</LI>
        <LI><Strong>AI Advisor chats</Strong> are not retained on our servers at all (see Section 3.3).</LI>
      </UL>

      <H2>11. Security</H2>
      <P>
        We use industry-standard security measures: encrypted connections (HTTPS), encrypted storage at rest, password hashing, and database row-level security policies that prevent users from accessing each other&apos;s data.
      </P>
      <P>
        That said, no system is perfectly secure. If a breach occurs that affects your data, we will notify you via the email address on your account within 72 hours of becoming aware of it.
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
