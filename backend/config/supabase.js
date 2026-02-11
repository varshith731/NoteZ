const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'notez-backend' },
  },
  // Add timeout settings to handle connection issues
  fetch: (url, options = {}) => {
    return fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(15000) // 15 second timeout
    });
  }
});

module.exports = supabase;
