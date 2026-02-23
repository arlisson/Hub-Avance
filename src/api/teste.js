(async () => {
  const sb = await window.getSupabaseClient();
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;

  const r = await fetch("/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ chatInput: "teste", sessionId: "sess_teste" }),
  });

  console.log(r.status, await r.text());
})();