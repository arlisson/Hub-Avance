export default function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) return res.status(500).json({ ok: false, error: "missing_env" });

  res.status(200).json({ ok: true, supabaseUrl: url, supabaseAnonKey: anon });
}