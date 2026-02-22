// supabaseClient.js
const SUPABASE_URL = "https://mgfmdkjfhqriyvnrkgmx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MNNmP8Q9k7LEwqol4Fsz0A_DHUN9jpl";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);