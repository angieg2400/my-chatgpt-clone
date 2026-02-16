import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ============================================================
 *  CHATGPT CLONE (DEMO) - CON LOGIN FAKE + MULTI-CHAT + SSE
 *  ✅ UI mejorada (más llamativa)
 *  ✅ Tipografía más legible (usa "Inter" si está disponible)
 *  ✅ Código comentado y explicado en todo el archivo
 * ============================================================
 */

/* ============================================================
   CONFIGURACIÓN GENERAL
============================================================ */

// URL del backend (solo funciona en local si tienes backend corriendo)
const API_URL = "http://localhost:8080";

// Claves de localStorage:
// - LS_KEY: guarda chats + chat activo
// - LS_SESSION: guarda sesión demo
const LS_KEY = "chatgpt_clone_app_state_v3";
const LS_SESSION = "chatgpt_clone_session_v1";

// Credenciales DEMO fijas (front-only)
const DEMO_USER = "demo@prueba.com";
const DEMO_PASS = "Demo123!";

/* ============================================================
   HELPERS (UTILIDADES)
============================================================ */

/**
 * Genera un id "suficientemente único" para chats.
 * (No es UUID real, pero sirve para un demo).
 */
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/**
 * Lee JSON de localStorage de forma segura (evita que la app se rompa).
 */
function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda JSON en localStorage de forma segura.
 */
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Si falla (modo incógnito, storage lleno, etc.), no rompemos la app.
  }
}

/**
 * Genera un título de chat basado en el primer mensaje del usuario.
 */
function deriveTitle(messages) {
  const firstUser = messages.find(
    (m) => m.role === "user" && typeof m.content === "string"
  );
  if (!firstUser) return "Nuevo chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

/* ============================================================
   LOGIN VIEW (FAKE)
============================================================ */

/**
 * Vista del Login fake (front-only).
 * - Si credenciales coinciden -> guarda sesión en localStorage y notifica a App.
 */
function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    setError("");

    // Validación simple con credenciales fijas
    if (email.trim() === DEMO_USER && pass === DEMO_PASS) {
      const session = {
        email: DEMO_USER,
        name: "Demo User",
        createdAt: Date.now()
      };

      // Guardamos sesión para persistencia
      localStorage.setItem(LS_SESSION, JSON.stringify(session));

      // Avisamos al componente padre (App) que ya hay sesión
      onLogin(session);
    } else {
      setError("Credenciales incorrectas.");
    }
  }

  return (
    <div style={ui.loginPage}>
      {/* Fondo decorativo */}
      <div style={ui.bgGlowA} />
      <div style={ui.bgGlowB} />

      <div style={ui.loginCard}>
        <div style={ui.loginHeader}>
          <div style={ui.logoBadge}>🤖</div>
          <div>
            <div style={ui.h1}>ChatGPT Clone</div>
            <div style={ui.subtle}>
              Login demo (zona protegida).  
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={ui.formCol}>
          <label style={ui.label}>
            Email
            <input
              style={ui.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="demo@prueba.com"
              required
            />
          </label>

          <label style={ui.label}>
            Contraseña
            <input
              style={ui.input}
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div style={ui.errorBox}>⚠️ {error}</div>}

          <button type="submit" style={ui.primaryBtn}>
            Iniciar sesión
          </button>

        </form>


      </div>
    </div>
  );
}

/* ============================================================
   APP ROOT
============================================================ */

/**
 * App:
 * - Solo decide: ¿hay sesión? => mostrar login o chat.
 * - Importante: NO meter hooks condicionales (evita la pantalla negra).
 */
export default function App() {
  // Estado de sesión (persistido en localStorage)
  const [session, setSession] = useState(() => loadJSON(LS_SESSION));

  // Cerrar sesión: borra LS y resetea estado
  function logout() {
    localStorage.removeItem(LS_SESSION);
    setSession(null);
  }

  // Si no hay sesión: mostramos login
  if (!session) return <LoginView onLogin={setSession} />;

  // Si hay sesión: mostramos la app del chat
  return <ChatApp session={session} onLogout={logout} />;
}

/* ============================================================
   CHAT APP (TODO LO DEL CHAT AQUÍ)
============================================================ */

function ChatApp({ session, onLogout }) {
  /**
   * chats: lista de chats
   * activeChatId: id del chat seleccionado
   */
  const [chats, setChats] = useState(() => {
    const saved = loadJSON(LS_KEY);
    if (saved?.chats?.length) return saved.chats;

    // Chat inicial por defecto
    return [
      {
        id: uid(),
        title: "Nuevo chat",
        createdAt: Date.now(),
        messages: [
          {
            role: "assistant",
            content:
              "Hola 👋 Soy tu clon tipo ChatGPT.\nPuedes crear chats, borrarlos, y chatear por streaming (SSE) en local."
          }
        ]
      }
    ];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadJSON(LS_KEY);
    return saved?.activeChatId || null;
  });

  // Input del textarea
  const [input, setInput] = useState("");

  // Flag para bloquear UI mientras llega streaming
  const [isStreaming, setIsStreaming] = useState(false);

  // Referencia al fondo del chat para auto-scroll
  const bottomRef = useRef(null);

  /**
   * activeChat: chat actual.
   * - Si activeChatId no existe, usamos el primero.
   */
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || chats[0],
    [chats, activeChatId]
  );

  /**
   * Al entrar por primera vez al ChatApp:
   * - Garantizamos que activeChatId tenga un valor válido.
   */
  useEffect(() => {
    if (!activeChatId && chats.length) setActiveChatId(chats[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Persistimos chats + chat activo cada vez que cambien.
   */
  useEffect(() => {
    saveJSON(LS_KEY, { chats, activeChatId });
  }, [chats, activeChatId]);

  /**
   * Auto-scroll al final cuando cambia el número de mensajes.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages?.length]);

  /* ============================
     ACCIONES DE CHAT
  ============================ */

  // Crear un chat nuevo
  function createNewChat() {
    if (isStreaming) return; // no permitir si está generando
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

  // Eliminar chat
  function deleteChat(chatId) {
    if (isStreaming) return;

    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);

      // Si borramos el activo, elegimos el siguiente
      const nextActive = filtered[0]?.id || null;
      if (chatId === activeChatId) setActiveChatId(nextActive);

      // Si ya no queda ninguno, creamos un chat base
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

  // Limpiar chat activo
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

  /* ============================
     ENVÍO DE MENSAJES (SSE)
  ============================ */

  /**
   * sendMessage:
   * 1) agrega mensaje del usuario al estado
   * 2) agrega placeholder del asistente (content: "")
   * 3) llama al backend /api/chat/stream
   * 4) recibe "delta" en streaming y lo concatena al último mensaje assistant
   */
  async function sendMessage() {
    if (!input.trim() || isStreaming || !activeChat) return;

    // Mensaje del usuario
    const userMsg = { role: "user", content: input.trim() };

    // Limpiamos input y bloqueamos streaming
    setInput("");
    setIsStreaming(true);

    // Insertamos: user + assistant placeholder vacío
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, userMsg, { role: "assistant", content: "" }] }
          : c
      )
    );

    // Historial que mandamos al backend (sin placeholder)
    const outgoing = [...activeChat.messages, userMsg].filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );

    try {
      // Llamada al backend
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing })
      });

      // En GitHub Pages esto fallará si no existe backend
      if (!res.ok || !res.body) {
        throw new Error(
          "No se pudo conectar al backend. En GitHub Pages necesitas desplegar backend o cambiar a modo demo sin backend."
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      /**
       * appendAssistant:
       * concatena texto (delta) al último mensaje del assistant.
       */
      const appendAssistant = (delta) => {
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== activeChat.id) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];

            if (last?.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: (last.content || "") + delta };
            }
            return { ...c, messages: msgs };
          })
        );
      };

      // Loop de lectura del streaming SSE
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Acumulamos chunks
        buffer += decoder.decode(value, { stream: true });

        // SSE suele separar eventos con doble salto de línea
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

          // Eventos esperados:
          // - delta: trae texto parcial
          // - error: trae mensaje de error
          if (eventName === "delta") appendAssistant(data.delta || "");
          if (eventName === "error")
            appendAssistant(`\n\n⚠️ ${data.error || "Error desconocido"}`);
        }
      }

      // Si el chat aún se llama "Nuevo chat", actualizamos título
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          if (c.title !== "Nuevo chat") return c;
          return { ...c, title: deriveTitle(c.messages) };
        })
      );
    } catch (err) {
      // Si algo falla, lo mostramos en el último assistant
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];

          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...last,
              content: (last.content || "") + `\n\n⚠️ ${err?.message || "Error"}`
            };
          }
          return { ...c, messages: msgs };
        })
      );
    } finally {
      // Liberamos UI
      setIsStreaming(false);
    }
  }

  /**
   * Enviar con Enter (sin Shift).
   * Shift+Enter: salto de línea.
   */
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /* ============================
     RENDER
  ============================ */

  return (
    <div style={ui.page}>
      {/* Fondo decorativo */}
      <div style={ui.bgGlowA} />
      <div style={ui.bgGlowB} />

      {/* Sidebar */}
      <aside style={ui.sidebar}>
        <div style={ui.sidebarTop}>
          <div style={ui.brandRow}>
            <div style={ui.logoBadgeSmall}>✨</div>
            <div>
              <div style={ui.brandTitle}>Mi clon de ChatGPT</div>
              <div style={ui.subtleSmall}>Zona protegida (demo) · UI moderna</div>
            </div>
          </div>

          <button onClick={createNewChat} disabled={isStreaming} style={ui.primaryBtn}>
            + Nuevo chat
          </button>
        </div>

        {/* Lista de chats */}
        <div style={ui.chatList}>
          {chats.map((c) => {
            const active = c.id === activeChatId;

            return (
              <div
                key={c.id}
                style={{ ...ui.chatItem, ...(active ? ui.chatItemActive : {}) }}
                onClick={() => !isStreaming && setActiveChatId(c.id)}
                title={c.title}
              >
                <div style={ui.chatLeft}>
                  <div style={{ ...ui.bullet, ...(active ? ui.bulletActive : {}) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={ui.chatTitle}>{c.title}</div>
                    <div style={ui.chatMeta}>{new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <button
                  type="button"
                  title="Eliminar"
                  style={ui.iconBtn}
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

        {/* Footer de sidebar */}
        <div style={ui.sidebarFooter}>
          <div style={ui.sessionLine}>
            <span style={ui.sessionDot} />
            <div style={{ minWidth: 0 }}>
              <div style={ui.subtleSmall}>Sesión activa</div>
              <div style={ui.sessionEmail}>{session.email}</div>
            </div>
          </div>

          <button onClick={onLogout} style={ui.ghostBtn}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={ui.main}>
        <header style={ui.header}>
          <div style={{ minWidth: 0 }}>
            <div style={ui.headerTitle}>{activeChat?.title || "Chat"}</div>
            <div style={ui.subtleSmall}>
              Streaming SSE · Enter para enviar · Shift+Enter para salto de línea
            </div>
          </div>

          <button onClick={clearActiveChat} disabled={isStreaming} style={ui.ghostBtn}>
            Limpiar chat
          </button>
        </header>

        <section style={ui.chatArea}>
          {activeChat?.messages?.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} />
          ))}

          {/* Indicador de "escribiendo" */}
          {isStreaming && (
            <div style={ui.typing}>
              <span style={ui.dot} />
              <span style={ui.dot} />
              <span style={ui.dot} />
              <span style={{ marginLeft: 8, opacity: 0.75 }}>Escribiendo…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <footer style={ui.inputWrap}>
          <textarea
            style={ui.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje…"
            disabled={isStreaming}
          />

          <button
            type="button"
            style={{
              ...ui.sendBtn,
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

/* ============================================================
   COMPONENTE DE BURBUJA DE MENSAJE
============================================================ */

/**
 * MessageBubble:
 * - Renderiza mensajes del usuario y del asistente con estilos distintos.
 */
function MessageBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={isUser ? ui.userBubble : ui.assistantBubble}>
        <div style={ui.roleLabelRow}>
          <span style={ui.rolePill}>{isUser ? "Tú" : "Asistente"}</span>
        </div>

        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{content}</div>
      </div>
    </div>
  );
}

/* ============================================================
   UI / ESTILOS (INLINE)
   - Sin CSS externo
   - Tipografía: "Inter" (si está) + system
   - Fondo con glows y degradados suaves
============================================================ */

const ui = {
  // Tipografía más legible
  font: `"Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`,

  // Glows decorativos (se usan tanto en login como en app)
  bgGlowA: {
    position: "fixed",
    inset: "-40% auto auto -30%",
    width: 700,
    height: 700,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(59,130,246,0.28), rgba(0,0,0,0) 60%)",
    filter: "blur(6px)",
    pointerEvents: "none",
    zIndex: 0
  },
  bgGlowB: {
    position: "fixed",
    inset: "auto -30% -40% auto",
    width: 800,
    height: 800,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(168,85,247,0.22), rgba(0,0,0,0) 60%)",
    filter: "blur(8px)",
    pointerEvents: "none",
    zIndex: 0
  },

  // -------------------
  // LOGIN
  // -------------------
  loginPage: {
    height: "100vh",
    background: "linear-gradient(180deg, #070A10 0%, #0B0F14 60%, #070A10 100%)",
    display: "grid",
    placeItems: "center",
    color: "white",
    fontFamily: `"Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    position: "relative",
    overflow: "hidden"
  },
  loginCard: {
    width: "min(520px, 92vw)",
    padding: 20,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)",
    boxShadow: "0 24px 90px rgba(0,0,0,0.50)",
    position: "relative",
    zIndex: 1
  },
  loginHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(59,130,246,0.35)",
    boxShadow: "0 10px 30px rgba(59,130,246,0.10)"
  },
  h1: {
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: -0.2
  },
  subtle: { opacity: 0.78, marginTop: 3, fontSize: 13, lineHeight: 1.35 },
  subtleSmall: { opacity: 0.78, fontSize: 12, lineHeight: 1.35 },

  formCol: { display: "flex", flexDirection: "column", gap: 12 },

  label: { display: "flex", flexDirection: "column", gap: 7, fontWeight: 800, fontSize: 13 },

  input: {
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    fontFamily: `"Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    fontSize: 14
  },

  primaryBtn: {
    borderRadius: 14,
    border: "1px solid rgba(59,130,246,0.40)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.34) 0%, rgba(59,130,246,0.18) 100%)",
    color: "white",
    padding: "11px 12px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(59,130,246,0.14)",
    transition: "transform 120ms ease, filter 120ms ease"
  },

  ghostBtn: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer"
  },

  hintBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 13
  },

  monoLine: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
    fontFamily: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
    fontSize: 12
  },

  kbd: {
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 800
  },

  errorBox: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(239,68,68,0.12)",
    fontSize: 13
  },

  footerNote: {
    marginTop: 14,
    opacity: 0.65,
    fontSize: 12,
    lineHeight: 1.35
  },

  // -------------------
  // APP LAYOUT
  // -------------------
  page: {
    height: "100vh",
    background: "linear-gradient(180deg, #070A10 0%, #0B0F14 60%, #070A10 100%)",
    color: "white",
    fontFamily: `"Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    position: "relative",
    overflow: "hidden"
  },

  sidebar: {
    borderRight: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
    display: "flex",
    flexDirection: "column",
    minWidth: 280,
    position: "relative",
    zIndex: 1
  },

  sidebarTop: { padding: 14, display: "flex", flexDirection: "column", gap: 12 },

  brandRow: { display: "flex", alignItems: "center", gap: 10 },

  logoBadgeSmall: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(168,85,247,0.14)",
    border: "1px solid rgba(168,85,247,0.28)"
  },

  brandTitle: { fontWeight: 900, letterSpacing: -0.2 },

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
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.04) 100%)",
    cursor: "pointer",
    transition: "transform 120ms ease, border-color 120ms ease"
  },

  chatItemActive: {
    border: "1px solid rgba(59,130,246,0.40)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.10) 100%)",
    boxShadow: "0 10px 24px rgba(59,130,246,0.10)"
  },

  chatLeft: { display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 },

  bullet: { width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.45)" },
  bulletActive: { background: "rgba(59,130,246,0.85)" },

  chatTitle: {
    fontWeight: 900,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  chatMeta: { fontSize: 11, opacity: 0.75 },

  iconBtn: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "6px 10px",
    fontWeight: 900,
    cursor: "pointer"
  },

  sidebarFooter: {
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  sessionLine: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },

  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(34,197,94,0.85)",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.10)"
  },

  sessionEmail: {
    fontWeight: 900,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  main: { display: "flex", flexDirection: "column", height: "100vh", position: "relative", zIndex: 1 },

  header: {
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "rgba(0,0,0,0.10)",
    backdropFilter: "blur(6px)"
  },

  headerTitle: {
    fontWeight: 950,
    letterSpacing: -0.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12
  },

  // Mensajes
  userBubble: {
    maxWidth: "78%",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.26) 0%, rgba(59,130,246,0.14) 100%)",
    border: "1px solid rgba(59,130,246,0.36)",
    padding: "12px 12px",
    borderRadius: 18,
    boxShadow: "0 14px 30px rgba(59,130,246,0.08)"
  },

  assistantBubble: {
    maxWidth: "78%",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.05) 100%)",
    border: "1px solid rgba(255,255,255,0.12)",
    padding: "12px 12px",
    borderRadius: 18
  },

  roleLabelRow: { marginBottom: 8, display: "flex", alignItems: "center" },

  rolePill: {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    opacity: 0.9
  },

  // Input
  inputWrap: {
    display: "flex",
    gap: 10,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 18px",
    background: "rgba(0,0,0,0.14)",
    backdropFilter: "blur(6px)"
  },

  textarea: {
    flex: 1,
    minHeight: 58,
    maxHeight: 190,
    resize: "vertical",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 12,
    color: "white",
    outline: "none",
    fontFamily: `"Inter", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    fontSize: 14,
    lineHeight: 1.45
  },

  sendBtn: {
    width: 130,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.08) 100%)",
    color: "white",
    fontWeight: 950,
    cursor: "pointer"
  },

  // Typing indicator
  typing: { display: "flex", alignItems: "center", opacity: 0.9, marginTop: 6 },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    marginRight: 6
  }
};
