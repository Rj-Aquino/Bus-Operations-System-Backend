import { createClient } from '@supabase/supabase-js';

// Your Supabase URL and Anon API Key
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
