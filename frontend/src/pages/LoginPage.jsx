import { useState } from "react";

const DARK = {
  bg: "#010409", surface: "#0d1117", surface2: "#161b22",
  border: "#30363d", text: "#e6edf3", textMuted: "#8b949e",
  accent: "#58a6ff", accentBg: "#388bfd22", accentBorder: "#388bfd44",
  inputBg: "#0d1117", error: "#ff4d4d",
};

const LIGHT = {
  bg: "#f6f8fa", surface: "#ffffff", surface2: "#f0f3f7",
  border: "#d0d7de", text: "#1f2328", textMuted: "#656d76",
  accent: "#0969da", accentBg: "#ddf4ff", accentBorder: "#54aeff66",
  inputBg: "#ffffff", error: "#ff4d4d",
};

export default function LoginPage({ onLogin, dark, setDark }) {
  const t = dark ? DARK : LIGHT;

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");

    if (!email || !password || (isRegister && !name)) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister ? { name, email, password } : { email, password };

      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      // Save token and user to localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        avatar: data.avatar,
      }));

      onLogin(data);
    } catch (err) {
      setError("Could not connect to server.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      transition: "background 0.3s",
    }}>

      {/* Theme Toggle */}
      <button
        onClick={() => setDark(d => !d)}
        style={{
          position: "fixed", top: 16, right: 16,
          background: t.surface2, border: `1px solid ${t.border}`,
          borderRadius: 20, padding: "6px 14px", cursor: "pointer",
          color: t.text, fontSize: 13, fontWeight: 600,
        }}
      >
        {dark ? "☀️ Light" : "🌙 Dark"}
      </button>

      <div style={{
        width: "100%", maxWidth: 420, padding: "0 20px",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, margin: "0 0 6px",
            background: dark
              ? "linear-gradient(135deg, #e6edf3 0%, #58a6ff 100%)"
              : "linear-gradient(135deg, #1f2328 0%, #0969da 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            AI Code Reviewer
          </h1>
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>
            {isRegister ? "Create your account" : "Welcome back! Sign in to continue"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: 28,
          boxShadow: dark ? "0 8px 32px #00000044" : "0 8px 32px #00000011",
        }}>

          {/* Error */}
          {error && (
            <div style={{
              background: "#ff4d4d11", border: "1px solid #ff4d4d44",
              borderRadius: 8, padding: "10px 14px", color: "#ff4d4d",
              fontSize: 13, marginBottom: 16,
            }}>⚠ {error}</div>
          )}

          {/* Name field (register only) */}
          {isRegister && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
                Full Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: "10px 14px", color: t.text,
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: "10px 14px", color: t.text,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = t.accent}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={{
                width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: "10px 14px", color: t.text,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = t.accent}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "11px", borderRadius: 8, border: "none",
              background: loading ? t.surface2 : "linear-gradient(135deg, #388bfd, #58a6ff)",
              color: loading ? t.textMuted : "#fff",
              fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 16, transition: "all 0.2s",
            }}
          >
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span style={{ color: t.textMuted, fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>

          {/* Google Login Button */}
          <button
            onClick={() => setError("Google login coming soon! Use email for now.")}
            style={{
              width: "100%", padding: "11px", borderRadius: 8,
              border: `1px solid ${t.border}`, background: t.surface2,
              color: t.text, fontWeight: 600, fontSize: 14,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, transition: "all 0.2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Toggle Register/Login */}
        <p style={{ textAlign: "center", marginTop: 20, color: t.textMuted, fontSize: 14 }}>
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <button
            onClick={() => { setIsRegister(r => !r); setError(""); }}
            style={{
              background: "none", border: "none", color: t.accent,
              fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </p>

      </div>
    </div>
  );
}