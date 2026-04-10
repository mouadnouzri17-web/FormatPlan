import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import logo from '../assets/logoM2S.png'
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      setError(err.message || "Erreur lors de la connexion Google");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || (isRegister && !displayName.trim())) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await register(username.trim(), password, displayName.trim());
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      setError(err.message || (isRegister ? "Erreur lors de l'inscription." : "Identifiants incorrects. Veuillez réessayer."));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px",
    background: "#fff",
    border: `1px solid ${focusedField === field ? "#0f7ddb" : "#e3e3e2"}`,
    borderRadius: 6,
    fontSize: 14,
    color: "#37352f",
    outline: "none",
    fontFamily: "'ui-sans-serif', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxShadow: focusedField === field ? "0 0 0 2px rgba(15,125,219,0.14)" : "none",
  });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f7f5",
      fontFamily: "'ui-sans-serif', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: "min(380px, 92vw)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}>
        {/* Logo / Titre */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 0 }}>
            <img
  src={logo}
  alt="PlanAdmin logo"
  style={{
    width: 80,
    height: 'auto',
    objectFit: "contain",
    borderRadius: "50%",
    display: "block",
    margin: "0 auto",
  }}
/>
          </div>
          <h1 style={{
            fontSize: 25,
            fontWeight: 700,
            color: "#37352f",
            margin: 0,
            letterSpacing: "-0.02em",
          }}>
            M2S Consulting
          </h1>
          <p style={{
            fontSize: 13,
            color: "#9b9a97",
            margin: "4px 0 0",
          }}>
            Plateforme de gestion des formations
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          border: "1px solid #e3e3e2",
          borderRadius: 8,
          padding: "28px 28px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#37352f",
            margin: "0 0 4px",
            letterSpacing: "-0.01em",
          }}>
            {isRegister ? "Créer un compte" : "Connexion"}
          </h2>
          <p style={{
            fontSize: 13,
            color: "#9b9a97",
            margin: "0 0 22px",
          }}>
            {isRegister ? "Rejoignez votre espace de travail" : "Accédez à votre espace de travail"}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Nom d'affichage (si inscription) */}
            {isRegister && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <label style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#6b6b6b",
                  marginBottom: 5,
                }}>
                  Nom d'affichage
                </label>
                <input
                  id="register-displayname"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setError(""); }}
                  placeholder="Votre nom complet…"
                  disabled={loading}
                  style={inputStyle("displayName")}
                  onFocus={() => setFocusedField("displayName")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            )}

            {/* Identifiant */}
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "#6b6b6b",
                marginBottom: 5,
              }}>
                Identifiant
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="Votre identifiant…"
                disabled={loading}
                style={inputStyle("username")}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 500,
                color: "#6b6b6b",
                marginBottom: 5,
              }}>
                Mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{ ...inputStyle("password"), paddingRight: 38 }}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#b7b6b2", padding: 4, display: "flex",
                    borderRadius: 4,
                  }}
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 12px", borderRadius: 6,
                background: "#fff2f2",
                border: "1px solid #ffd5d4",
                animation: "fadeIn 0.15s ease",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d44c47" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 13, color: "#c0392b" }}>{error}</span>
              </div>
            )}

            {/* Bouton */}
            <button
  id="login-submit-btn"
  type="submit"
  disabled={loading || !username || !password}
  style={{
    width: "100%",
    padding: "9px 14px",
    background: loading || !username || !password
      ? "#e9e9e7"
      : "#000", // ✅ noir
    border: "1px solid",
    borderColor: loading || !username || !password ? "#d3d3d1" : "#000",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: loading || !username || !password ? "#9b9a97" : "#fff",
    cursor: loading || !username || !password ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 2,
    boxShadow: loading || !username || !password
      ? "none"
      : "0 1px 3px rgba(0,0,0,0.3)", // ombre noire
  }}
  onMouseEnter={(e) => {
    if (!loading && username && password) {
      e.currentTarget.style.background = "#222"; // hover un peu plus clair
    }
  }}
  onMouseLeave={(e) => {
    if (!loading && username && password) {
      e.currentTarget.style.background = "#000";
    }
  }}
>
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(55,53,47,0.2)",
                    borderTopColor: "#9b9a97",
                    animation: "spin 0.6s linear infinite",
                  }} />
                  {isRegister ? "Création en cours…" : "Connexion…"}
                </>
              ) : (
                <>
                  
                  {isRegister ? "S'inscrire" : "Se connecter"}
                </>
              )}
            </button>
          </form>

          {/* Séparateur */}
          <div style={{
            display: "flex",
            alignItems: "center",
            margin: "24px 0",
            gap: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: "#e3e3e2" }} />
            <span style={{ fontSize: 12, color: "#9b9a97", fontWeight: 500 }}>OU</span>
            <div style={{ flex: 1, height: 1, background: "#e3e3e2" }} />
          </div>

          {/* Google Login */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Erreur lors de l'authentification Google.")}
              useOneTap
              theme="outline"
              size="large"
              width="100%"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          {/* Toggle Register / Login */}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "#6b6b6b",
                cursor: loading ? "not-allowed" : "pointer",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {isRegister ? "Vous avez déjà un compte ? Connectez-vous" : "Pas de compte ? Inscrivez-vous"}
            </button>
          </div>
        </div>

        {/* Footer */}
        
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
        input::placeholder { color: #b7b6b2; }
      `}</style>
    </div>
  );
}