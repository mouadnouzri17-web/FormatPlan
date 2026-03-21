import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AUTH_BASE = (typeof import_meta_env !== "undefined" && import_meta_env?.VITE_API_URL)
  ? `${import_meta_env.VITE_API_URL}/auth`
  : "https://sparkling-empathy-production-05b3.up.railway.app/api/auth";
const TOKEN_KEY = "gantt_auth_token";
const USER_KEY  = "gantt_auth_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);

  // ── Vérifier le token au démarrage ──────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetch(`${AUTH_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Token invalide");
        return r.json();
      })
      .then((user) => {
        setCurrentUser(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setCurrentUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur de connexion");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data.user;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────────
  const registerAcc = useCallback(async (username, password, displayName) => {
    const res = await fetch(`${AUTH_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de la création du compte");
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setCurrentUser(data.user);
    return data.user;
  }, []);

  // ── Update Profile ───────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (displayName, password) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const bodyPayload = {};
    if (displayName !== undefined) bodyPayload.displayName = displayName;
    if (password) bodyPayload.password = password;

    const res = await fetch(`${AUTH_BASE}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(bodyPayload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour");
    
    // Si l'API renvoie un nouveau token et user
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setCurrentUser(data.user);
    }
    return data.user;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${AUTH_BASE}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore — on supprime quand même le token local
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setCurrentUser(null);
  }, []);

  // ── Changer mot de passe ─────────────────────────────────────────────────────
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${AUTH_BASE}/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur");
    return data;
  }, []);

  // ── Token getter (pour apiFetch) ─────────────────────────────────────────────
  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);

  return (
    <AuthContext.Provider value={{ currentUser, authLoading, login, register: registerAcc, updateProfile, logout, changePassword, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
