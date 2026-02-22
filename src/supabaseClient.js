// supabaseClient.js
const SUPABASE_URL = "https://mgfmdkjfhqriyvnrkgmx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MNNmP8Q9k7LEwqol4Fsz0A_DHUN9jpl";


// Uso: const sb = await window.getSupabaseClient();

(function () {
  window.getSupabaseClient = async function getSupabaseClient() {
    if (window.__sb) return window.__sb;
    if (typeof supabase === "undefined") throw new Error("supabase-js não carregou.");

    // Você pode escolher UMA destas opções:

    // OPÇÃO A (recomendada): pegar config do backend (Vercel env)
    const r = await fetch("/api/public-supabase-config");
    const cfg = await r.json().catch(() => null);
    if (!r.ok || !cfg?.ok) throw new Error("Falha ao obter config do Supabase.");

    window.__sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return window.__sb;

    // OPÇÃO B (alternativa): hardcode (descomente e remova a opção A)
    // const SUPABASE_URL = "https://mgfmdkjfhqriyvnrkgmx.supabase.co";
    // const SUPABASE_ANON_KEY = "sb_publishable_MNNmP8Q9k7LEwqol4Fsz0A_DHUN9jpl";
    // window.__sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // return window.__sb;
  };
})();