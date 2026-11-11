// No built-in owner: set POS_OWNER_EMAILS (comma-separated) to grant Agent Lab access.
const DEFAULT_POS_OWNER_EMAILS = [];

function configuredOwnerEmails() {
  const raw = process.env.POS_OWNER_EMAILS || '';
  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return emails.length ? emails : DEFAULT_POS_OWNER_EMAILS;
}

export function isPosOwner(user) {
  const email = typeof user?.email === 'string' ? user.email.toLowerCase() : '';
  return Boolean(email && configuredOwnerEmails().includes(email));
}

export function posOwnerEmails() {
  return configuredOwnerEmails();
}
