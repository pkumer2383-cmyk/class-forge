// src/lib/supabase.js
// Backwards-compatible browser client used by the existing client components.
import { createClient } from './supabase/client';

export const supabase = createClient();
