// Same-origin /api: Nginx (production) or the Vite proxy (development) forwards it to the backend.
// The login token is kept in this browser's localStorage and sent with every request.
const KEY = 'farm_token';

export function getToken() {
  try {
    return window.localStorage.getItem(KEY);
  } catch (_) {
    return null; // private mode or blocked storage: the person has to log in again next time
  }
}

export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch (_) {
    /* ignore */
  }
}

// Used when the token is accepted but storage is blocked, so login still works for this visit.
let memoryToken = null;
export function rememberToken(token) {
  memoryToken = token;
  setToken(token);
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = memoryToken || getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    // The token expired or is no longer valid: send the person back to the login page.
    memoryToken = null;
    setToken(null);
    window.dispatchEvent(new Event('farm-logout'));
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function logout() {
  memoryToken = null;
  setToken(null);
  window.dispatchEvent(new Event('farm-logout'));
}
