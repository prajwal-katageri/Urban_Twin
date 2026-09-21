/**
 * UrbanTwin API Client
 * Routes all simulation requests through the Flask backend (port 5000)
 */

const FLASK_BACKEND_URL = 'http://localhost:5000/api';

const authHeaders = () => {
  const token = localStorage.getItem('urbantwin_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const login = async (email, password) => {
  const response = await fetch(`${FLASK_BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Login failed');
  localStorage.setItem('urbantwin_auth_token', data.token);
  return data.user;
};

export const register = async (name, email, password) => {
  const response = await fetch(`${FLASK_BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Registration failed');
  localStorage.setItem('urbantwin_auth_token', data.token);
  return data.user;
};

export const getCurrentUser = async () => {
  try {
    const response = await fetch(`${FLASK_BACKEND_URL}/auth/me`, { headers: authHeaders() });
    if (!response.ok) return null;
    return (await response.json()).user;
  } catch {
    return null;
  }
};

export const logout = async () => {
  const response = await fetch(`${FLASK_BACKEND_URL}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok && response.status !== 401) throw new Error('Logout failed');
  localStorage.removeItem('urbantwin_auth_token');
};

export const getBackendConfig = () => {
  const savedUrl = localStorage.getItem('urbantwin_backend_url');
  const isEnabled = localStorage.getItem('urbantwin_backend_enabled');
  const configuredUrl = savedUrl && !savedUrl.includes(':8082') ? savedUrl : FLASK_BACKEND_URL;
  return {
    baseUrl: configuredUrl,
    isEnabled: isEnabled !== null ? isEnabled === 'true' : true, // default ON now
  };
};

export const saveBackendConfig = (baseUrl, isEnabled) => {
  localStorage.setItem('urbantwin_backend_url', baseUrl);
  localStorage.setItem('urbantwin_backend_enabled', isEnabled ? 'true' : 'false');
};

// --- Health Check ---
export const checkBackendHealth = async (baseUrl) => {
  const url = baseUrl || FLASK_BACKEND_URL;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json().catch(() => ({ status: 'online' }));
      return { online: true, details: data };
    }
    return { online: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err) {
    return {
      online: false,
      error: err.name === 'AbortError' ? 'Timeout (4s)' : 'Network Error / Unreachable',
    };
  }
};

// --- Fetch all zones from DB ---
export const fetchZones = async () => {
  const config = getBackendConfig();
  try {
    const response = await fetch(`${config.baseUrl}/zones`);
    if (response.ok) {
      const json = await response.json();
      return { success: true, data: json.data || [] };
    }
    return { success: false, data: [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

// --- Fetch zone by zoneId slug ---
export const fetchZone = async (zoneId) => {
  const config = getBackendConfig();
  try {
    const response = await fetch(`${config.baseUrl}/zones/${zoneId}`);
    if (response.ok) {
      const json = await response.json();
      return { success: true, data: json.data };
    }
    return { success: false, data: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

// --- Run a full simulation through Flask ---
export const runRemoteSimulation = async (payload) => {
  const config = getBackendConfig();
  if (!config.isEnabled) {
    return { success: false, fallbackToLocal: true, reason: 'Remote backend disabled' };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(`${config.baseUrl}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const json = await response.json();
      return { success: true, isRemote: true, data: json.data || json };
    }
    const errJson = await response.json().catch(() => ({}));
    return { success: false, fallbackToLocal: true, reason: errJson.message || `HTTP ${response.status}` };
  } catch (err) {
    return {
      success: false,
      fallbackToLocal: true,
      reason: err.name === 'AbortError' ? 'Simulation timeout (12s)' : err.message,
    };
  }
};

// --- Fetch past simulations for a zone ---
export const fetchSimulationHistory = async (zoneId) => {
  const config = getBackendConfig();
  try {
    const url = zoneId
      ? `${config.baseUrl}/simulations/zone/${zoneId}`
      : `${config.baseUrl}/simulations`;
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      return { success: true, data: json.data || [] };
    }
    return { success: false, data: [] };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};
