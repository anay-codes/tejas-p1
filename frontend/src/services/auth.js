// TEJAS Authentication & RBAC Service

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const TOKEN_KEY = 'tejas_auth_token';
const USER_KEY = 'tejas_auth_user';

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  },

  getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    const token = this.getToken();
    return Boolean(token);
  },

  getRole() {
    const user = this.getUser();
    return (user?.role || 'VIEWER').toUpperCase();
  },

  hasRole(...allowedRoles) {
    const userRole = this.getRole();
    const upperAllowed = allowedRoles.map(r => r.toUpperCase());
    return upperAllowed.includes(userRole);
  },

  async login(username, password) {
    const res = await fetch(`${BASE_URL}/auth/login-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      let msg = 'Authentication failed';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    const data = await res.json();
    const token = data.access_token;
    localStorage.setItem(TOKEN_KEY, token);

    let userProfile = {
      username: data.username || username,
      role: data.role || 'OPERATOR',
      full_name: data.username || username
    };

    // Attempt profile retrieval
    try {
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (meRes.ok) {
        const me = await meRes.json();
        userProfile = { ...userProfile, ...me };
      }
    } catch (e) {
      console.warn("Could not fetch user profile details:", e);
    }

    localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
    window.dispatchEvent(new Event('tejas_auth_changed'));
    return userProfile;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('tejas_auth_changed'));
  }
};
