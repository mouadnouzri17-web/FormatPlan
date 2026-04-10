import { AuthProvider, useAuth } from "./contexts/AuthContext";
import GanttChart from "@/components/GanttChart";
import LoginPage from "./pages/LoginPage";
import { GoogleOAuthProvider } from '@react-oauth/google';

function AppContent() {
  const { currentUser, authLoading } = useAuth();

  // Écran de chargement pendant la vérification du token
  if (authLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.15)",
            borderTopColor: "#0f7ddb",
            animation: "spin 0.7s linear infinite",
          }} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Chargement…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) return <LoginPage />;
  return <GanttChart />;
}

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
