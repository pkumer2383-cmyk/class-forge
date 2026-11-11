'use client';

import { useState } from 'react';
import PageShell, { H2, P } from '../../components/PageShell';
import { supabase } from '../../lib/supabase';
import { BRAND } from '../../lib/brand';

const CONTACT_EMAIL = BRAND.supportEmail;

export default function ContactClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('general');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setStatus(null);

    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name: name.trim().slice(0, 100) || null,
        email: email.trim().slice(0, 200) || null,
        topic,
        body: body.trim().slice(0, 5000),
      });

    setSubmitting(false);
    if (error) {
      setStatus({ kind: 'err', text: 'Could not send: ' + error.message + '. You can email directly at ' + CONTACT_EMAIL + ' instead.' });
      return;
    }
    setStatus({ kind: 'ok', text: "Message sent. Thanks - we'll reply at the email you provided." });
    setName('');
    setEmail('');
    setBody('');
  }

  return (
    <PageShell title="Contact" lastUpdated="August 23, 2026">
      <H2>Email</H2>
      <P>
        Direct email reaches us fastest:{' '}
        <a href={'mailto:' + CONTACT_EMAIL} style={{ color: '#a5b4fc' }}>{CONTACT_EMAIL}</a>
      </P>
      <P style={{ color: '#94a3b8', fontSize: 14 }}>
        Reply time: usually within 1-2 business days. ClassForge is a small operation, so please be patient.
      </P>

      <H2>Or send a message here</H2>
      <P>
        Use this form if you don&apos;t want to open your email client. Your message is stored in our private database and we&apos;ll see it.
      </P>

      <form onSubmit={submit} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Your name (optional)</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={100} style={inputStyle} placeholder="(optional)" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Your email (so we can reply)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} style={inputStyle} placeholder="you@school.edu" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Topic</label>
          <select value={topic} onChange={e => setTopic(e.target.value)} style={inputStyle}>
            <option value="general">General question</option>
            <option value="bug">Bug report</option>
            <option value="feature">Feature request</option>
            <option value="partnership">Partnership / institutional inquiry</option>
            <option value="privacy">Privacy / data request</option>
            <option value="legal">Legal / compliance</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={5000}
            rows={6}
            required
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="What&apos;s on your mind?"
          />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{body.length} / 5000 characters</div>
        </div>

        <button
          type="submit"
          disabled={submitting || !body.trim()}
          style={{
            background: submitting || !body.trim() ? '#475569' : '#6366f1',
            color: 'white', fontWeight: 600, fontSize: 14,
            padding: '10px 20px', borderRadius: 6, border: 'none',
            cursor: submitting || !body.trim() ? 'not-allowed' : 'pointer',
          }}
        >{submitting ? 'Sending...' : 'Send message'}</button>

        {status && (
          <div style={{
            marginTop: 14,
            padding: 12, borderRadius: 6, fontSize: 14,
            background: status.kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
            border: '1px solid ' + (status.kind === 'ok' ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'),
            color: status.kind === 'ok' ? '#6ee7b7' : '#fca5a5',
          }}>{status.text}</div>
        )}
      </form>

      <H2>Privacy &amp; data requests</H2>
      <P>
        If you want to request a copy of your data, delete your account, or opt out of any data processing, email{' '}
        <a href={'mailto:' + CONTACT_EMAIL + '?subject=Privacy%20Request'} style={{ color: '#a5b4fc' }}>{CONTACT_EMAIL}</a>{' '}
        with subject line &quot;Privacy Request&quot; and include the email address you signed up with.
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

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#cbd5e1',
  marginBottom: 6,
};
const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#e5e7eb',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
