const API_URL = import.meta.env.VITE_API_URL;

export async function apiGet(url) {
  const r = await fetch(`${API_URL}${url}`, {
    credentials: 'include'
  });

  if (!r.ok) throw new Error('GET failed');

  return r.json();
}

export async function apiPost(url, data, method = 'POST') {
  const r = await fetch(`${API_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(data)
  });

  if (!r.ok) throw new Error('POST failed');

  return r.json();
}
