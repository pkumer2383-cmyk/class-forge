function tableMissing(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('does not exist') || message.includes('schema cache');
}

function permissionDenied(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return code === '42501' || message.includes('permission denied');
}

export function posPersistenceFallbackReason(error, table) {
  if (tableMissing(error)) {
    return `Supabase table ${table} is missing or not exposed. Apply the POS migration.`;
  }

  if (permissionDenied(error)) {
    return 'Sign in to persist POS audit records.';
  }

  return error?.message || String(error);
}
