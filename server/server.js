/**
 * server.js
 * Backend BASE para ChatGPT Clone (IA local GRATIS con Ollama)
 *
 * Este servidor:
 * - Usa Express
 * - Permite CORS para que el frontend se conecte
 * - Expone /health para probar si está vivo
 * - Expone /api/chat/stream con SSE (streaming) para respuestas en tiempo real
 *
 * IMPORTANTE:
 * - Ollama debe estar corriendo en http://localhost:11434
 * - Debes tener un modelo instalado, por ejemplo:
 *   ollama pull llama3.2:3b
 */

import "dotenv/config";        // Carga variables de entorno desde .env
import express from "express"; // Framework HTTP
import cors from "cors";       // Permite conexiones desde el frontend (React)

// ========== CONFIGURACIÓN ==========
const app = express();
const PORT = process.env.PORT || 8080;

// CORS: permitir que el frontend (Vite) consuma este backend
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173"
}));

// Permite JSON en body
app.use(express.json({ limit: "2mb" }));

// ========== ENDPOINT DE PRUEBA ==========
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando 🚀 (Ollama mode)" });
});

// ========== STREAMING CHAT (SSE) ==========
/**
 * POST /api/chat/stream
 * body: { messages: [{role:'user'|'assistant', content:'...'}] }
 *
 * Devuelve eventos SSE:
 * - event: delta  (trozos de texto)
 * - event: done   (cuando termina)
 * - event: error  (cuando ocurre un error)
 */
app.post("/api/chat/stream", async (req, res) => {
  // Headers necesarios para streaming SSE
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const { messages } = req.body;

    // Validación básica
    if (!messages || !Array.isArray(messages)) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: "Formato inválido: 'messages' debe ser un array" })}\n\n`);
      return res.end();
    }

    // Filtramos mensajes para evitar errores (solo user/assistant y contenido string)
    const safeMessages = messages.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );

    // Mensaje "system" para dar estilo tipo ChatGPT
    const system = {
      role: "system",
      content: `
Eres un asistente avanzado tipo ChatGPT.
Responde en español.
Sé claro, estructurado y profesional.
Cuando sea útil, usa ejemplos.
Si el usuario pide código, entrégalo bien formateado.
`.trim()
    };

    // Modelo a usar en Ollama (por defecto llama3.2:3b)
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

    // Convertimos tus mensajes al formato de Ollama
    const ollamaMessages = [
      { role: "system", content: system.content },
      ...safeMessages.map((m) => ({ role: m.role, content: m.content }))
    ];

    /**
     * Llamamos a Ollama en modo streaming
     * Ollama responde en NDJSON: cada línea es un JSON independiente
     */
    const ollamaRes = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: true
      })
    });

    // Si Ollama no responde, lanzamos error
    if (!ollamaRes.ok || !ollamaRes.body) {
      throw new Error("Ollama no respondió. Verifica que esté corriendo y que el modelo exista.");
    }

    // Leer el stream (NDJSON) de Ollama
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    // Leemos continuamente el stream de Ollama
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Ollama separa JSONs por saltos de línea
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          // Si una línea viene corrupta/partida, la ignoramos
          continue;
        }

        // Delta incremental de contenido
        const delta = obj?.message?.content || "";
        if (delta) {
          res.write(`event: delta\n`);
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }

        // Cuando Ollama termina
        if (obj?.done) {
          res.write(`event: done\n`);
          res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);
        }
      }
    }

    // Cerramos el SSE
    res.end();

  } catch (error) {
    // Enviamos error al frontend en formato SSE
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
  console.log(`ℹ️ Modo IA local: Ollama (http://localhost:11434)`);
});
