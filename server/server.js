import React, { useEffect, useMemo, useRef, useState } from "react";

// ==============================
// CONFIG
// ==============================
const API_URL = "http://localhost:8080"; // backend local (para dev). En GitHub Pages NO hay backend.
const LS_KEY = "chatgpt_clone_app_state_v3";
const LS_SESSION = "chatgpt_clone_session_v1";

// Credenciales DEMO (fijas)
const DEMO_USER = "demo@prueba.com";
const DEMO_PASS = "Demo123!";

// ==============================
// HELPERS
// ==============================
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no romper la app si localStorage falla
  }
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user" && typeof m.content === "string");
  if (!firstUser) return "Nuevo chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

// ==============================
// LOGIN (FAKE)
// ==============================
function LoginView({ onLogin }) {
  const [email, setEmail] = useState(DEMO_USER);
  const [pass, setPass] = useState(DEMO_PASS);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function submit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simular proceso de login
    setTimeout(() => {
      // Validación simple
      if (email.trim() === DEMO_USER && pass === DEMO_PASS) {
        // Guardamos sesión fake
        const session = {
          email: DEMO_USER,
          name: "Demo User",
          createdAt: Date.now()
        };
        localStorage.setItem(LS_SESSION, JSON.stringify(session));
        onLogin(session);
      } else {
        setError("Credenciales incorrectas. ");
        setIsLoading(false);
      }
    }, 500);
  }

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>💬</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 24, marginTop: 10 }}>ChatGPT Clon</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Inicia sesión para acceder a la zona protegida
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={styles.label}>
            Email
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label style={styles.label}>
            Contraseña
            <input
              style={styles.input}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1 }} disabled={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        <div style={styles.hintBox}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Credenciales de demo:</div>
          <div>Email: {DEMO_USER}</div>
          <div>Contraseña: {DEMO_PASS}</div>
        </div>
      </div>
    </div>
  );
}

// ==============================
// APP
// ==============================
export default function App() {
  // ---- sesión fake ----
  const [session, setSession] = useState(() => loadJSON(LS_SESSION));
  const [isInitialized, setIsInitialized] = useState(false);

  function logout() {
    localStorage.removeItem(LS_SESSION);
    setSession(null);
  }

  // Si NO hay sesión → mostrar login
  if (!session) {
    return <LoginView onLogin={setSession} />;
  }

  // ---- estado chat multi-chat ----
  const [chats, setChats] = useState(() => {
    const saved = loadJSON(LS_KEY);
    if (saved?.chats?.length) return saved.chats;
    return [
      {
        id: uid(),
        title: "Nuevo chat",
        createdAt: Date.now(),
        messages: [{ role: "assistant", content: "Hola 👋 Soy tu clon tipo ChatGPT. ¿En qué te ayudo?" }]
      }
    ];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadJSON(LS_KEY);
    return saved?.activeChatId || null;
  });

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const bottomRef = useRef(null);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || chats[0],
    [chats, activeChatId]
  );

  // Asegurar activeChatId y que la interfaz se inicialice correctamente
  useEffect(() => {
    if (!activeChatId && chats.length) {
      setActiveChatId(chats[0].id);
    }
    // Marcar como inicializado después de un pequeño retraso para asegurar renderizado
    setTimeout(() => setIsInitialized(true), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir chats
  useEffect(() => {
    if (isInitialized) {
      saveJSON(LS_KEY, { chats, activeChatId });
    }
  }, [chats, activeChatId, isInitialized]);

  // Autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages?.length]);

  function createNewChat() {
    if (isStreaming) return;
    const newChat = {
      id: uid(),
      title: "Nuevo chat",
      createdAt: Date.now(),
      messages: [{ role: "assistant", content: "Nuevo chat ✅ ¿Qué quieres preguntar?" }]
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
  }

  function deleteChat(chatId) {
    if (isStreaming) return;
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      const next = filtered[0]?.id || null;
      if (chatId === activeChatId) setActiveChatId(next);
      return filtered.length
        ? filtered
        : [
            {
              id: uid(),
              title: "Nuevo chat",
              createdAt: Date.now(),
              messages: [{ role: "assistant", content: "Hola 👋 ¿Qué quieres hacer hoy?" }]
            }
          ];
    });
  }

  function clearActiveChat() {
    if (isStreaming || !activeChat) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? {
              ...c,
              title: "Nuevo chat",
              messages: [{ role: "assistant", content: "Chat limpio ✅ ¿En qué te ayudo ahora?" }]
            }
          : c
      )
    );
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming || !activeChat) return;

    const userMsg = { role: "user", content: input.trim() };
    setInput("");
    setIsStreaming(true);

    // Insert user + placeholder assistant
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, userMsg, { role: "assistant", content: "" }] }
          : c
      )
    );

    // historial sin placeholder
    const outgoing = [...activeChat.messages, userMsg].filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );

    try {
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing })
      });

      // Si estás en GitHub Pages, esto puede fallar porque no hay backend.
      if (!res.ok || !res.body) {
        throw new Error(
          "No se pudo conectar al backend. Si estás en GitHub Pages, este demo requiere backend desplegado."
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const appendAssistant = (delta) => {
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== activeChat.id) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: last.content + delta };
            }
            return { ...c, messages: msgs };
          })
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const ev of events) {
          const lines = ev.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));

          const eventName = eventLine ? eventLine.replace("event:", "").trim() : "";
          const dataRaw = dataLine ? dataLine.replace("data:", "").trim() : "{}";

          let data = {};
          try {
            data = JSON.parse(dataRaw);
          } catch {
            data = {};
          }

          if (eventName === "delta") appendAssistant(data.delta || "");
          if (eventName === "error") appendAssistant(`\n\n⚠️ ${data.error || "Error desconocido"}`);
        }
      }

      // actualizar título si sigue "Nuevo chat"
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          if (c.title !== "Nuevo chat") return c;
          return { ...c, title: deriveTitle(c.messages) };
        })
      );
    } catch (err) {
      // mostrar error en el último assistant
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${err.message}` };
          }
          return { ...c, messages: msgs };
        })
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Si no está inicializado, mostrar una pantalla de carga
  if (!isInitialized) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}></div>
          <div style={{ marginTop: 16 }}>Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Mi clon de ChatGPT</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Zona protegida (demo)</div>
          </div>

          <button onClick={createNewChat} disabled={isStreaming} style={styles.primaryBtn}>
            + Nuevo chat
          </button>
        </div>

        <div style={styles.chatList}>
          {chats.map((c) => {
            const active = c.id === activeChatId;
            return (
              <div
                key={c.id}
                style={{ ...styles.chatItem, ...(active ? styles.chatItemActive : {}) }}
                onClick={() => !isStreaming && setActiveChatId(c.id)}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <div style={styles.bullet} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.chatTitle}>{c.title}</div>
                    <div style={styles.chatMeta}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  title="Eliminar"
                  style={styles.iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  disabled={isStreaming}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div style={styles.sidebarFooter}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Sesión: <b>{session.email}</b>
          </div>
          <button onClick={logout} style={styles.ghostBtn}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={{ fontWeight: 800 }}>{activeChat?.title || "Chat"}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Streaming SSE · UI tipo ChatGPT
            </div>
          </div>

          <button onClick={clearActiveChat} disabled={isStreaming} style={styles.ghostBtn}>
            Limpiar chat
          </button>
        </header>

        <section style={styles.chatArea}>
          {activeChat?.messages?.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} />
          ))}

          {isStreaming && (
            <div style={styles.typing}>
              <span style={styles.dot} />
              <span style={styles.dot} />
              <span style={styles.dot} />
              <span style={{ marginLeft: 8, opacity: 0.75 }}>Escribiendo…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <footer style={styles.inputWrap}>
          <textarea
            style={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje…"
            disabled={isStreaming}
          />
          <button
            type="button"
            style={{
              ...styles.sendBtn,
              opacity: isStreaming || !input.trim() ? 0.6 : 1
            }}
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
          >
            {isStreaming ? "..." : "Enviar"}
          </button>
        </footer>
      </main>
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        <div style={styles.roleLabel}>{isUser ? "Tú" : "Asistente"}</div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{content}</div>
      </div>
    </div>
  );
}

// ==============================
// STYLES (inline para no tocar CSS)
// ==============================
const styles = {
  // Login
  loginPage: {
    height: "100vh",
    background: "linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)",
    display: "grid",
    placeItems: "center",
    color: "white",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial"
  },
  loginCard: {
    width: "min(480px, 92vw)",
    padding: 32,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)"
  },
  logo: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 10
  },
  logoIcon: {
    fontSize: 48,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: 20,
    padding: 10,
    display: "inline-block"
  },
  label: { display: "flex", flexDirection: "column", gap: 8, fontWeight: 700 },
  input: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    transition: "all 0.2s",
    fontSize: 16
  },
  hintBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 13
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(239,68,68,0.12)",
    fontSize: 13
  },

  // Loading screen
  loadingScreen: {
    height: "100vh",
    background: "linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)",
    display: "grid",
    placeItems: "center",
    color: "white",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial"
  },
  loadingContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    border: "4px solid rgba(255,255,255,0.1)",
    borderTop: "4px solid #667eea",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  },

  // App layout
  page: {
    height: "100vh",
    background: "linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)",
    color: "white",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    display: "grid",
    gridTemplateColumns: "320px 1fr"
  },
  sidebar: {
    borderRight: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    flexDirection: "column",
    minWidth: 280
  },
  sidebarTop: { padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  brand: { display: "flex", flexDirection: "column", gap: 4 },
  primaryBtn: {
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.2)"
  },
  ghostBtn: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s"
  },
  chatList: {
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto",
    flex: 1
  },
  chatItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  chatItemActive: {
    border: "1px solid rgba(102, 126, 234, 0.5)",
    background: "rgba(102, 126, 234, 0.15)",
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.1)"
  },
  bullet: { 
    width: 10, 
    height: 10, 
    borderRadius: 999, 
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
  },
  chatTitle: {
    fontWeight: 800,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  chatMeta: { fontSize: 11, opacity: 0.7 },
  iconBtn: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    padding: "6px 9px",
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s"
  },
  sidebarFooter: { 
    padding: 20, 
    borderTop: "1px solid rgba(255,255,255,0.08)", 
    display: "flex", 
    flexDirection: "column", 
    gap: 12 
  },
  main: { display: "flex", flexDirection: "column", height: "100vh" },
  header: {
    padding: "20px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16
  },
  userBubble: {
    maxWidth: "76%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    border: "1px solid rgba(102, 126, 234, 0.3)",
    padding: "14px 18px",
    borderRadius: 18,
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
  },
  assistantBubble: {
    maxWidth: "76%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "14px 18px",
    borderRadius: 18,
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
  },
  roleLabel: { fontSize: 12, opacity: 0.7, marginBottom: 8, fontWeight: 700 },
  inputWrap: {
    display: "flex",
    gap: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "16px 24px",
    background: "rgba(255,255,255,0.03)"
  },
  textarea: {
    flex: 1,
    minHeight: 56,
    maxHeight: 170,
    resize: "vertical",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 14,
    color: "white",
    outline: "none",
    fontSize: 16,
    transition: "all 0.2s"
  },
  sendBtn: {
    width: 120,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    fontWeight: 900,
    boxShadow: "0 4px 15px rgba(102, 126, 234, 0.2)",
    transition: "all 0.2s"
  },
  typing: { display: "flex", alignItems: "center", opacity: 0.9, marginTop: 6 },
  dot: { 
    width: 6, 
    height: 6, 
    borderRadius: 999, 
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
    marginRight: 6 
  }
};

// Agregar animación para el spinner de carga
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleElement);