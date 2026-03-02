export async function apiGet(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('GET failed');
  return r.json();
}

export async function apiPost(url, data, method = 'POST') {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('POST failed');
  return r.json();
}
