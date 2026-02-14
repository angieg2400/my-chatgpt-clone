/**
 * App.jsx (UI mejorada estilo ChatGPT) - FIX DUPLICADOS + STREAMING SSE
 *
 * Incluye:
 * - Tema oscuro
 * - Burbujas modernas (usuario derecha / asistente izquierda)
 * - Auto-scroll al final
 * - Enter envía / Shift+Enter nueva línea
 * - Indicador "Escribiendo..."
 * - Streaming SSE robusto (parsea eventos completos)
 *
 * NOTA:
 * - Tu backend debe emitir SSE con eventos:
 *   event: delta  data: {"delta":"..."}
 *   event: done   data: {"ok":true}
 *   event: error  data: {"error":"..."}
 */

import React, { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "http://localhost:8080";

export default function App() {
  // ====== Estado del chat ======
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hola 👋 Soy tu Clon ChatGPT mejorado. ¿En qué te ayudo?" }
  ]);

  // ====== Input (multilínea) ======
  const [input, setInput] = useState("");

  // ====== Estado de streaming ======
  const [isStreaming, setIsStreaming] = useState(false);

  // Auto-scroll
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Historial base (solo user/assistant).
   * Esto es lo que enviamos al backend como contexto.
   */
  const chatHistory = useMemo(() => {
    return messages.filter((m) => m.role === "user" || m.role === "assistant");
  }, [messages]);

  /**
   * Enviar mensaje al backend.
   * FIX importante: NO duplicar el mensaje del usuario.
   */
  async function sendMessage() {
    if (!input.trim() || isStreaming) return;

    const userMsg = { role: "user", content: input.trim() };

    // 1) Limpiar input y activar streaming
    setInput("");
    setIsStreaming(true);

    // 2) Agregar UNA sola vez: mensaje usuario + placeholder del assistant
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);

    try {
      // Construimos el historial a enviar (incluye el nuevo userMsg)
      const outgoing = [...chatHistory, userMsg];

      // Llamada al backend SSE
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

      // Buffer para manejar eventos SSE que llegan partidos
      let buffer = "";

      /**
       * Agrega texto al último mensaje del asistente
       */
      const appendAssistant = (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      };

      // Leemos el stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Un evento SSE termina con doble salto de línea
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

          if (eventName === "delta") {
            appendAssistant(data.delta || "");
          }

          if (eventName === "error") {
            appendAssistant(`\n\n⚠️ ${data.error || "Error desconocido"}`);
          }

          // event: done -> no hacemos nada especial aquí;
          // el stream cerrará cuando el backend haga res.end()
        }
      }
    } catch (err) {
      // Si falla, mostramos el error en el último mensaje del asistente
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${err.message}` };
        }
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  /**
   * Enter envía / Shift+Enter hace salto de línea
   */
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /**
   * (Opcional) Limpiar chat
   */
  function clearChat() {
    if (isStreaming) return;
    setMessages([{ role: "assistant", content: "Chat limpio ✅ ¿En qué te ayudo ahora?" }]);
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>My ChatGPT Clone</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            IA local con Ollama + streaming (gratis)
          </div>
        </div>

        <button onClick={clearChat} disabled={isStreaming} style={styles.ghostBtn}>
          Limpiar
        </button>
      </div>

      {/* Contenedor centrado */}
      <div style={styles.container}>
        {/* Zona de chat con scroll interno */}
        <div style={styles.chat}>
          {messages.map((m, idx) => (
            <MessageBubble key={idx} role={m.role} content={m.content} />
          ))}

          {/* Indicador "escribiendo..." */}
          {isStreaming && (
            <div style={styles.typing}>
              <span style={styles.dot} />
              <span style={styles.dot} />
              <span style={styles.dot} />
              <span style={{ marginLeft: 8, opacity: 0.75 }}>Escribiendo…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Barra inferior fija dentro del contenedor */}
        <div style={styles.inputWrap}>
          <textarea
            style={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje… (Enter envía, Shift+Enter nueva línea)"
            disabled={isStreaming}
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
        </div>

        <div style={styles.footerNote}>
          Consejo: prueba “Explícame React con un ejemplo simple”.
        </div>
      </div>
    </div>
  );
}

/**
 * Burbuja del chat
 */
function MessageBubble({ role, content }) {
  const isUser = role === "user";

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        <div style={styles.roleLabel}>{isUser ? "Tú" : "Asistente"}</div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{content}</div>
      </div>
    </div>
  );
}

/**
 * Estilos inline
 * (Luego lo pasamos a Tailwind si quieres)
 */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#0b0f14",
    color: "white",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    display: "flex",
    flexDirection: "column"
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
    padding: "8px 12px",
    fontWeight: 700
  },
  container: {
    width: "min(980px, 92vw)",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    padding: "18px 0"
  },
  // IMPORTANTE: chat con scroll interno para que no se "corte"
  chat: {
    flex: 1,
    overflowY: "auto",
    padding: "10px 6px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    // para que el input no tape los últimos mensajes
    paddingBottom: 10
  },
  userBubble: {
    maxWidth: "75%",
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(59,130,246,0.30)",
    padding: "12px 12px",
    borderRadius: 16
  },
  assistantBubble: {
    maxWidth: "75%",
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
    paddingTop: 12
  },
  textarea: {
    flex: 1,
    minHeight: 56,
    maxHeight: 160,
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
    fontWeight: 800
  },
  footerNote: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 10
  },
  typing: {
    display: "flex",
    alignItems: "center",
    opacity: 0.9,
    marginTop: 8
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    marginRight: 6
  }
};
