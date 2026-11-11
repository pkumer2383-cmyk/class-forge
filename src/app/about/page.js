// src/app/about/page.js
import PageShell, { H2, P, UL, LI } from '../../components/PageShell';
import { buildMetadata } from '../../lib/seo.js';

export const metadata = {
  ...buildMetadata({
    title: 'About',
    description:
      'Learn what ClassForge is, who builds it, and how the schedule planner fits into the ClassForge product.',
    path: '/about',
    keywords: ['about ClassForge', 'college schedule builder', 'student planning'],
  }),
};

export default function AboutPage() {
  return (
    <PageShell title="About ClassForge" lastUpdated="August 23, 2026">
      <H2>What this is</H2>
      <P>
        ClassForge is a college schedule builder. You upload your school&apos;s course catalog and your degree requirements, and the app finds non-conflicting schedules that fit. It tracks the courses you&apos;ve already completed, lets you forecast future semesters, calculates your GPA, and includes an AI advisor for course-planning questions.
      </P>
      <P>
        It exists because most college scheduling tools are clunky, locked inside university portals, or limited to a single term. Students deserve something faster and more flexible - something that lets them think across years, not just weeks.
      </P>

      <H2>Who builds it</H2>
      <P>
        ClassForge is built and maintained by an independent developer based in Pennsylvania. It is a one-person operation, not a venture-backed company.
      </P>

      <H2>How it makes money (or doesn&apos;t, yet)</H2>
      <P>
        The schedule builder, data manager, degree tracker, and feedback features are free. The AI Advisor will eventually require a small subscription (planned at $4.99 per semester) to cover the cost of running the AI service.
      </P>
      <P>
        ClassForge does not currently show ads. If that ever changes, this page will be updated and the privacy policy will fully disclose what trackers are used.
      </P>
      <P>
        ClassForge does not sell user data. Period. See the <a href="/privacy" style={{ color: '#a5b4fc' }}>privacy policy</a> for full details.
      </P>

      <H2>What&apos;s next</H2>
      <UL>
        <LI>A help center with how-to articles for students and academic advisors</LI>
        <LI>Direct partnerships with college advising offices in Pennsylvania</LI>
        <LI>Improved AI Advisor that can suggest specific courses based on your degree audit</LI>
        <LI>Mobile-friendly improvements</LI>
      </UL>

      <H2>Get in touch</H2>
      <P>
        Found a bug, have a feature request, or want to chat about partnership opportunities? <a href="/contact" style={{ color: '#a5b4fc' }}>The contact page</a> has a working contact form and an email address.
      </P>
    </PageShell>
  );
}
