import React, { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "http://localhost:8080";

// ===== Helpers de persistencia =====
const LS_KEY = "chatgpt_clone_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Si localStorage falla (raro), no rompemos la app
  }
}

// ===== Generador simple de IDs =====
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// ===== Título sugerido por el primer mensaje del usuario =====
function deriveTitleFromMessages(msgs) {
  const firstUser = msgs.find((m) => m.role === "user" && typeof m.content === "string");
  if (!firstUser) return "Nuevo chat";
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  return t.length > 28 ? t.slice(0, 28) + "…" : t;
}

export default function App() {
  // ===== Estado principal (multi-chat) =====
  const [chats, setChats] = useState(() => {
    const saved = loadState();
    if (saved?.chats?.length) return saved.chats;
    // chat inicial
    return [
      {
        id: uid(),
        title: "Nuevo chat",
        createdAt: Date.now(),
        messages: [
          {
            role: "assistant",
            content: "Hola 👋 Soy tu clon tipo ChatGPT. ¿Qué quieres hacer hoy?"
          }
        ]
      }
    ];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadState();
    if (saved?.activeChatId) return saved.activeChatId;
    return null;
  });

  // Si no hay activeChatId (primera vez), usamos el primero
  useEffect(() => {
    if (!activeChatId && chats.length) setActiveChatId(chats[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir en localStorage cada vez que cambie
  useEffect(() => {
    saveState({ chats, activeChatId });
  }, [chats, activeChatId]);

  // ===== UI state =====
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Auto-scroll
  const bottomRef = useRef(null);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId), [chats, activeChatId]);
  const activeMessages = activeChat?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, activeMessages.length]);

  // ===== Acciones multi-chat =====
  function createNewChat() {
    if (isStreaming) return;
    const newChat = {
      id: uid(),
      title: "Nuevo chat",
      createdAt: Date.now(),
      messages: [
        { role: "assistant", content: "Nuevo chat ✅ ¿En qué te ayudo?" }
      ]
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
  }

  function deleteChat(chatId) {
    if (isStreaming) return;
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      // si borras el activo, mover al primero
      if (chatId === activeChatId) {
        const next = filtered[0]?.id || null;
        setActiveChatId(next);
      }
      return filtered.length ? filtered : [
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

  // ===== Enviar mensaje (streaming) =====
  async function sendMessage() {
    if (!input.trim() || isStreaming || !activeChat) return;

    const userMsg = { role: "user", content: input.trim() };

    setInput("");
    setIsStreaming(true);

    // 1) Insertar user + placeholder assistant (1 sola vez)
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? { ...c, messages: [...c.messages, userMsg, { role: "assistant", content: "" }] }
          : c
      )
    );

    // 2) Construir el historial a enviar (sin el placeholder)
    const outgoing = [...activeChat.messages, userMsg].filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );

    try {
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing })
      });

      if (!res.ok || !res.body) {
        throw new Error("No se pudo abrir el stream (backend no respondió correctamente).");
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

      // 3) Actualizar título del chat si aún dice "Nuevo chat"
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChat.id) return c;
          if (c.title !== "Nuevo chat") return c;
          const title = deriveTitleFromMessages(c.messages);
          return { ...c, title };
        })
      );
    } catch (err) {
      // Escribir error en el último mensaje assistant
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

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>
            <div style={{ fontWeight: 900 }}>My ChatGPT Clone</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Streaming + Ollama</div>
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
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                  title="Eliminar chat"
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
            Tip: Enter envía · Shift+Enter nueva línea
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={{ fontWeight: 800 }}>{activeChat?.title || "Chat"}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Backend SSE · IA local Ollama
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={clearActiveChat} disabled={isStreaming} style={styles.ghostBtn}>
              Limpiar chat
            </button>
          </div>
        </header>

        <section style={styles.chatArea}>
          {activeMessages.map((m, idx) => (
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
            disabled={isStreaming || !activeChat}
          />

          <button
            type="button"
            style={{
              ...styles.sendBtn,
              opacity: isStreaming || !input.trim() ? 0.6 : 1,
              cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer"
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

const styles = {
  page: {
    height: "100vh",
    background: "#0b0f14",
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
  sidebarTop: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  brand: {
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  primaryBtn: {
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.18)",
    color: "white",
    padding: "10px 12px",
    fontWeight: 800
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
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer"
  },
  chatItemActive: {
    border: "1px solid rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.12)"
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.55)"
  },
  chatTitle: {
    fontWeight: 800,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  chatMeta: {
    fontSize: 11,
    opacity: 0.7
  },
  iconBtn: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "6px 9px",
    fontWeight: 900
  },
  sidebarFooter: {
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)"
  },
  main: {
    display: "flex",
    flexDirection: "column",
    height: "100vh"
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  ghostBtn: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    padding: "10px 12px",
    fontWeight: 800
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  userBubble: {
    maxWidth: "76%",
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(59,130,246,0.30)",
    padding: "12px 12px",
    borderRadius: 16
  },
  assistantBubble: {
    maxWidth: "76%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    padding: "12px 12px",
    borderRadius: 16
  },
  roleLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6
  },
  inputWrap: {
    display: "flex",
    gap: 10,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 18px",
    background: "rgba(255,255,255,0.02)"
  },
  textarea: {
    flex: 1,
    minHeight: 56,
    maxHeight: 170,
    resize: "vertical",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 14,
    padding: 12,
    color: "white",
    outline: "none"
  },
  sendBtn: {
    width: 120,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 900
  },
  typing: {
    display: "flex",
    alignItems: "center",
    opacity: 0.9,
    marginTop: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    marginRight: 6
  }
};
