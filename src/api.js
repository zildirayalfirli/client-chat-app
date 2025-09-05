const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (window?.location ? `${window.location.origin}` : "http://localhost:4000");

async function readEnvelope(res) {
  const json = await res.json().catch(() => ({}));
  const status = Number(json?.status ?? res.status ?? 500);
  const message = json?.message || `HTTP ${status}`;
  const data = Array.isArray(json?.data) ? json.data : [];

  if (status >= 400) {
    const err = new Error(message);
    err.status = status;
    err.payload = json;
    throw err;
  }
  return data;
}

async function request(path, { method = "GET", token, body } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body != null) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    // credentials: "include",
  });

  return readEnvelope(res);
}

const first = (arr) => (Array.isArray(arr) ? arr[0] : undefined);

export const api = {
  register: async (username, password) =>
    first(await request("/api/auth/register", { method: "POST", body: { username, password } })),

  login: async (username, password) =>
    first(await request("/api/auth/login", { method: "POST", body: { username, password } })),

  me: async (token) =>
    first(await request("/api/users/me", { token })),

  rooms: async () =>
    await request("/api/rooms"),

  createRoom: async (name, token) =>
    first(await request("/api/rooms", { method: "POST", token, body: { name } })),

  joinRoom: async (roomId, token) =>
    first(await request(`/api/rooms/${roomId}/join`, { method: "POST", token })),

  getMessages: async (roomId, token) =>
    await request(`/api/rooms/${roomId}/messages`, { token }),

  sendMessageHTTP: async (roomId, token, content) =>
    first(await request(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      token,
      body: { content },
    })),
};
