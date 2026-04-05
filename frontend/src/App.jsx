import { useState, useEffect, useRef } from "react";
import LoginPage from "./pages/LoginPage.jsx";

const DARK = {
  bg: "#010409", surface: "#0d1117", surface2: "#161b22",
  sidebar: "#0d1117", sidebarHover: "#161b22", sidebarActive: "#1f2d3d",
  border: "#30363d", border2: "#21262d",
  text: "#e6edf3", textMuted: "#8b949e", textBody: "#c9d1d9",
  accent: "#58a6ff", accentBg: "#388bfd22", accentBorder: "#388bfd44",
  inputBg: "#0d1117", headerBg: "#0d1117",
  btnDisabled: "#21262d", btnDisabledText: "#8b949e",
};

const LIGHT = {
  bg: "#f6f8fa", surface: "#ffffff", surface2: "#f0f3f7",
  sidebar: "#ffffff", sidebarHover: "#f0f3f7", sidebarActive: "#ddf4ff",
  border: "#d0d7de", border2: "#d8dee4",
  text: "#1f2328", textMuted: "#656d76", textBody: "#36383b",
  accent: "#0969da", accentBg: "#ddf4ff", accentBorder: "#54aeff66",
  inputBg: "#ffffff", headerBg: "#ffffff",
  btnDisabled: "#e6eaef", btnDisabledText: "#8b949e",
};

function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?\s#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchRepoFiles(owner, repo, path = "") {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: { Accept: "application/vnd.github.v3+json" } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

async function fetchFileContent(downloadUrl) {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error("Could not fetch file content");
  return res.text();
}

const CODE_EXTENSIONS = new Set([
  "js","jsx","ts","tsx","py","java","go","rs","cpp","c","cs","rb","php",
  "swift","kt","vue","html","css","scss","json","yaml","yml","md","sh","env",
]);

function getExt(name) { return name.split(".").pop().toLowerCase(); }

async function collectFiles(owner, repo, path = "", collected = [], max = 25) {
  if (collected.length >= max) return collected;
  const items = await fetchRepoFiles(owner, repo, path);
  for (const item of items) {
    if (collected.length >= max) break;
    if (item.type === "file" && CODE_EXTENSIONS.has(getExt(item.name))) {
      collected.push(item);
    } else if (item.type === "dir" && !["node_modules", ".git", "dist", "build", ".next"].includes(item.name)) {
      await collectFiles(owner, repo, item.path, collected, max);
    }
  }
  return collected;
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const SEVERITY = { critical: "#ff4d4d", warning: "#ffa940", info: "#40a9ff", ok: "#52c41a" };

function SeverityBadge({ level }) {
  const color = SEVERITY[level] || SEVERITY.info;
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px",
      textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace",
    }}>{level}</span>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({ issue, index, t, filePath, repoUrl }) {
  const [open, setOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixedCode, setFixedCode] = useState(null);
  const [fixError, setFixError] = useState("");

  async function handleAutoFix() {
    setFixing(true);
    setFixError("");
    setFixedCode(null);
    try {
      const res = await fetch("${import.meta.env.VITE_API_URL}/fix", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ filePath, issue, repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fix failed");
      setFixedCode(data.fixedCode);
    } catch (e) {
      setFixError(e.message);
    }
    setFixing(false);
  }

  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
      marginBottom: 10, overflow: "hidden",
      boxShadow: open ? `0 0 0 1px ${t.accent}44` : "none", transition: "box-shadow 0.2s",
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", background: "none", border: "none",
        cursor: "pointer", textAlign: "left", color: t.text,
      }}>
        <span style={{ color: t.textMuted, fontSize: 12, minWidth: 24 }}>#{index + 1}</span>
        <SeverityBadge level={issue.severity || "info"} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{issue.title}</span>
        {issue.line && <span style={{ color: t.textMuted, fontSize: 12, fontFamily: "monospace" }}>Line {issue.line}</span>}
        <span style={{ color: t.textMuted, fontSize: 16, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border2}`, padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, color: t.textBody, fontSize: 13, lineHeight: 1.6 }}>{issue.description}</p>
          {issue.suggestion && (
            <div style={{ background: t.surface2, borderRadius: 6, padding: 12, borderLeft: `3px solid ${t.accent}` }}>
              <div style={{ color: t.accent, fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>SUGGESTION</div>
              <p style={{ margin: 0, color: t.textBody, fontSize: 13, lineHeight: 1.6 }}>{issue.suggestion}</p>
            </div>
          )}
          {issue.code && (
            <pre style={{
              margin: 0, background: t.surface2, borderRadius: 6, padding: 12,
              fontSize: 12, color: t.text, overflowX: "auto", lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace", border: `1px solid ${t.border}`,
            }}>{issue.code}</pre>
          )}
          <button onClick={handleAutoFix} disabled={fixing} style={{
            alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8,
            border: "none", cursor: fixing ? "not-allowed" : "pointer",
            background: fixing ? t.surface2 : "linear-gradient(135deg, #52c41a, #389e0d)",
            color: fixing ? t.textMuted : "#fff",
            fontWeight: 700, fontSize: 13, transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {fixing ? "⏳ Fixing..." : "🔧 Auto Fix"}
          </button>
          {fixError && (
            <div style={{ background: "#ff4d4d11", border: "1px solid #ff4d4d44", borderRadius: 6, padding: "8px 12px", color: "#ff4d4d", fontSize: 12 }}>
              ⚠ {fixError}
            </div>
          )}
          {fixedCode && (
            <div>
              <div style={{ color: "#52c41a", fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>✅ FIXED CODE</div>
              <pre style={{
                margin: 0, background: "#0d1117", borderRadius: 6, padding: 12,
                fontSize: 12, color: "#52c41a", overflowX: "auto", lineHeight: 1.6,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace", border: "1px solid #52c41a44",
              }}>{fixedCode}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Result ──────────────────────────────────────────────────────────────

function FileResult({ file, t, repoUrl }) {
  const [open, setOpen] = useState(true);
  const issueCount = file.issues?.length || 0;
  const criticals = file.issues?.filter(i => i.severity === "critical").length || 0;

  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: t.surface2,
        border: `1px solid ${t.border}`, borderRadius: open ? "8px 8px 0 0" : 8,
        cursor: "pointer", textAlign: "left", color: t.text,
      }}>
        <span style={{ fontSize: 16 }}>📄</span>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: 13, color: t.accent }}>{file.path}</span>
        <span style={{
          background: criticals > 0 ? "#ff4d4d22" : t.surface,
          color: criticals > 0 ? "#ff4d4d" : t.textMuted,
          borderRadius: 12, fontSize: 12, padding: "2px 10px", fontWeight: 600,
          border: `1px solid ${criticals > 0 ? "#ff4d4d44" : t.border}`,
        }}>
          {issueCount} issue{issueCount !== 1 ? "s" : ""}
        </span>
        <span style={{ color: t.textMuted, fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ border: `1px solid ${t.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 12px 4px", background: t.surface }}>
          {issueCount === 0 ? (
            <p style={{ color: "#52c41a", fontSize: 13, padding: "8px 4px", margin: 0 }}>✓ No issues found in this file.</p>
          ) : (
            file.issues.map((issue, i) => (
              <IssueCard key={i} issue={issue} index={i} t={t} filePath={file.path} repoUrl={repoUrl} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Progress Log ─────────────────────────────────────────────────────────────

function ProgressLog({ logs, t }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
      padding: "12px 16px", height: 180, overflowY: "auto",
      fontFamily: "monospace", fontSize: 12, color: t.textMuted, lineHeight: 1.8,
    }}>
      {logs.map((l, i) => (
        <div key={i} style={{ color: l.type === "error" ? "#ff4d4d" : l.type === "success" ? "#52c41a" : l.type === "info" ? t.accent : t.textMuted }}>
          <span style={{ opacity: 0.5 }}>[{l.time}] </span>{l.msg}
        </div>
      ))}
      {logs.length === 0 && <span style={{ opacity: 0.4 }}>Waiting for analysis to start...</span>}
    </div>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

function SummaryBar({ results, t }) {
  const allIssues = results.flatMap(r => r.issues || []);
  const counts = { critical: 0, warning: 0, info: 0, ok: 0 };
  allIssues.forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
      {Object.entries(counts).map(([k, v]) => (
        <div key={k} style={{ background: t.surface, border: `1px solid ${SEVERITY[k]}44`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: SEVERITY[k], fontFamily: "monospace" }}>{v}</div>
          <div style={{ fontSize: 11, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{k}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ t, history, activeId, onSelect, onNewReview, sidebarOpen, user, onLogout }) {
  return (
    <div style={{
      width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0,
      overflow: "hidden", background: t.sidebar,
      borderRight: `1px solid ${t.border}`, display: "flex",
      flexDirection: "column", transition: "width 0.3s, min-width 0.3s",
      height: "100vh", position: "sticky", top: 0,
    }}>
      <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Code Reviewer</span>
        </div>
        <button onClick={onNewReview} style={{
          width: "100%", padding: "8px 12px", borderRadius: 8,
          background: t.accentBg, border: `1px solid ${t.accentBorder}`,
          color: t.accent, fontWeight: 600, fontSize: 13,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>✏️</span> New Review
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {history.length === 0 ? (
          <div style={{ padding: "20px 16px", color: t.textMuted, fontSize: 12, textAlign: "center" }}>
            No reviews yet.<br />Analyze a repo to get started!
          </div>
        ) : (
          <>
            <div style={{ padding: "6px 16px 4px", fontSize: 11, color: t.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Recent Reviews</div>
            {history.map(h => (
              <button key={h._id} onClick={() => onSelect(h._id)} style={{
                width: "100%", textAlign: "left", padding: "10px 16px",
                background: activeId === h._id ? t.sidebarActive : "none",
                border: "none", borderLeft: activeId === h._id ? `3px solid ${t.accent}` : "3px solid transparent",
                cursor: "pointer", transition: "background 0.15s",
              }}
                onMouseEnter={e => { if (activeId !== h._id) e.currentTarget.style.background = t.sidebarHover; }}
                onMouseLeave={e => { if (activeId !== h._id) e.currentTarget.style.background = "none"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.owner}/{h.repo}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: h.criticalCount > 0 ? "#ff4d4d" : t.textMuted }}>
                    {h.criticalCount > 0 ? `⚠ ${h.criticalCount} critical` : `${h.totalIssues} issues`}
                  </span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>·</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{timeAgo(h.createdAt)}</span>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${t.border}`, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: t.accentBg,
            border: `1px solid ${t.accentBorder}`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, fontWeight: 700, color: t.accent, flexShrink: 0, overflow: "hidden",
          }}>
            {user?.avatar ? <img src={user.avatar} style={{ width: 32, height: 32, borderRadius: "50%" }} /> : user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          width: "100%", padding: "7px", borderRadius: 8, background: "none",
          border: `1px solid ${t.border}`, color: t.textMuted, fontSize: 13, cursor: "pointer", fontWeight: 600,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff4d4d"; e.currentTarget.style.color = "#ff4d4d"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
        >🚪 Sign Out</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const t = dark ? DARK : LIGHT;

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => { if (user) fetchHistory(); }, [user]);

  async function fetchHistory() {
    try {
      const res = await fetch("${import.meta.env.VITE_API_URL}/history", { headers: authHeaders() });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setHistory(data);
    } catch (e) { console.error("Could not fetch history", e); }
  }

  async function loadReview(id) {
    setActiveId(id);
    setLoadingHistory(true);
    setLogs([]);
    setErrorMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/history/${id}`, { headers: authHeaders() });
      const data = await res.json();
      setResults(data.results);
      setUrl(data.repoUrl);
      setStatus("done");
    } catch (e) { setErrorMsg("Could not load review."); }
    setLoadingHistory(false);
  }

  function newReview() {
    setActiveId(null); setUrl(""); setResults([]);
    setLogs([]); setErrorMsg(""); setStatus("idle");
  }

  function handleLogin(data) {
    setUser({ _id: data._id, name: data.name, email: data.email, avatar: data.avatar });
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null); setHistory([]); setResults([]);
    setLogs([]); setUrl(""); setStatus("idle");
  }

  function addLog(msg, type = "default") {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs(l => [...l, { msg, type, time }]);
  }

  async function analyzeFile(owner, repo, file) {
    const content = await fetchFileContent(file.download_url);
    const res = await fetch("${import.meta.env.VITE_API_URL}/review", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ path: file.path, content, language: getExt(file.name) }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Backend review failed"); }
    return await res.json();
  }

  async function handleAnalyze() {
    setLogs([]); setResults([]); setErrorMsg(""); setActiveId(null);
    const parsed = parseGithubUrl(url);
    if (!parsed) { setErrorMsg("Invalid GitHub URL. Example: https://github.com/owner/repo"); return; }
    setStatus("loading");
    const { owner, repo } = parsed;
    addLog(`Connecting to ${owner}/${repo}`, "info");
    try {
      addLog("Fetching repository structure...", "default");
      const files = await collectFiles(owner, repo, "", [], 25);
      addLog(`Found ${files.length} code files to review`, "success");
      const allResults = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        addLog(`[${i + 1}/${files.length}] Reviewing ${f.path}...`, "default");
        try {
          const result = await analyzeFile(owner, repo, f);
          allResults.push(result);
          setResults([...allResults]);
          const c = result.issues?.filter(x => x.severity === "critical").length || 0;
          addLog(`  → ${result.issues?.length || 0} issues found${c ? ` (${c} critical)` : ""}`, c > 0 ? "error" : "success");
        } catch (e) {
          addLog(`  → Failed to analyze: ${e.message}`, "error");
          allResults.push({ path: f.path, issues: [] });
        }
      }
      addLog("✓ Review complete!", "success");
      try {
        const saveRes = await fetch("${import.meta.env.VITE_API_URL}/save-review", {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ repoUrl: url, owner, repo, results: allResults }),
        });
        const saved = await saveRes.json();
        addLog("💾 Review saved to database!", "success");
        await fetchHistory();
        setActiveId(saved.id);
      } catch (e) { addLog("⚠ Could not save to database", "error"); }
      setStatus("done");
    } catch (e) {
      addLog(`Error: ${e.message}`, "error");
      setErrorMsg(e.message);
      setStatus("error");
    }
  }

  const totalIssues = results.flatMap(r => r.issues || []).length;

  if (!user) return <LoginPage onLogin={handleLogin} dark={dark} setDark={setDark} />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: t.bg, color: t.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <Sidebar t={t} history={history} activeId={activeId} onSelect={loadReview}
        onNewReview={newReview} sidebarOpen={sidebarOpen} user={user} onLogout={handleLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ borderBottom: `1px solid ${t.border2}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, background: t.headerBg, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: t.textMuted, fontSize: 16 }}>☰</button>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.5 }}>AI Code Reviewer</span>
          <span style={{ background: t.accentBg, color: t.accent, fontSize: 11, padding: "2px 8px", borderRadius: 10, border: `1px solid ${t.accentBorder}`, fontWeight: 600 }}>BETA</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: t.textMuted, fontSize: 12 }}>Powered by AI</span>
            <button onClick={() => setDark(d => !d)} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: t.text, fontSize: 13, fontWeight: 600 }}>
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px" }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {status === "idle" && results.length === 0 && (
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <h1 style={{
                  fontSize: 36, fontWeight: 800, margin: "0 0 12px",
                  background: dark ? "linear-gradient(135deg, #e6edf3 0%, #58a6ff 100%)" : "linear-gradient(135deg, #1f2328 0%, #0969da 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1,
                }}>Review Any GitHub Repo</h1>
                <p style={{ color: t.textMuted, fontSize: 16, margin: 0 }}>
                  Welcome back, {user.name}! Paste a GitHub URL to start reviewing.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && status !== "loading" && handleAnalyze()}
                placeholder="https://github.com/owner/repository"
                style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "12px 16px", color: t.text, fontSize: 14, outline: "none", fontFamily: "monospace" }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              <button onClick={handleAnalyze} disabled={status === "loading" || !url.trim()} style={{
                padding: "12px 24px", borderRadius: 8, border: "none",
                background: status === "loading" ? t.btnDisabled : "linear-gradient(135deg, #388bfd, #58a6ff)",
                color: status === "loading" ? t.btnDisabledText : "#fff",
                fontWeight: 700, fontSize: 14, cursor: status === "loading" ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}>
                {status === "loading" ? "⏳ Analyzing..." : "🚀 Analyze Repo"}
              </button>
            </div>

            {errorMsg && <div style={{ background: "#ff4d4d11", border: "1px solid #ff4d4d44", borderRadius: 8, padding: "10px 14px", color: "#ff4d4d", fontSize: 13, marginBottom: 16 }}>⚠ {errorMsg}</div>}
            <p style={{ color: t.textMuted, fontSize: 12, marginBottom: 32 }}>Analyzes up to 25 code files. Large repos may take a minute.</p>

            {loadingHistory && <div style={{ textAlign: "center", padding: 40, color: t.textMuted }}><div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Loading review...</div>}

            {(status === "loading" || logs.length > 0) && !loadingHistory && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ color: t.textMuted, fontSize: 12, marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Activity Log</div>
                <ProgressLog logs={logs} t={t} />
              </div>
            )}

            {results.length > 0 && !loadingHistory && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>Review Results</h2>
                  <span style={{ background: totalIssues > 0 ? "#ffa94011" : "#52c41a11", color: totalIssues > 0 ? "#ffa940" : "#52c41a", border: `1px solid ${totalIssues > 0 ? "#ffa94044" : "#52c41a44"}`, borderRadius: 12, fontSize: 12, padding: "2px 10px", fontWeight: 600 }}>
                    {totalIssues} total issues · {results.length} files
                  </span>
                </div>
                <SummaryBar results={results} t={t} />
                {results.map((r, i) => <FileResult key={i} file={r} t={t} repoUrl={url} />)}
              </div>
            )}

            {status === "done" && results.length === 0 && !loadingHistory && (
              <div style={{ textAlign: "center", padding: 48, color: t.textMuted, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>No files found to review</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>The repository may be empty or use unsupported file types.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}