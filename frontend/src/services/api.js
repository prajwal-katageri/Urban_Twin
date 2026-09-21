const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'API request failed');
  return data;
}

export const api = {
  health: () => request('/health'),
  zones: () => request('/zones'),
  zone: (id) => request(`/zones/${id}`),
  weather: (id) => request(`/weather/${id}`),
  previewArea: (payload) => request('/preview-area', { method: 'POST', body: JSON.stringify(payload) }),
  simulate: (payload) => request('/simulate', { method: 'POST', body: JSON.stringify(payload) }),
  route: (payload) => request('/route', { method: 'POST', body: JSON.stringify(payload) }),
  compare: (payload) => request('/compare', { method: 'POST', body: JSON.stringify(payload) }),
};
