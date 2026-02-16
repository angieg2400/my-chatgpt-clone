ChatGPT Clone — Streaming + Local AI
Aplicación full‑stack que replica el comportamiento de ChatGPT mediante arquitectura cliente-servidor y streaming en tiempo real (SSE). Integra un modelo de lenguaje local usando Ollama.

Aplicación desplegada:
https://angieg2400.github.io/my-chatgpt-clone/ 

Stack Tecnológico
Frontend
• React + Vite
• Server-Sent Events (SSE)
• Persistencia con localStorage
• Deploy automático con GitHub Actions
Backend
• Node.js + Express
• Streaming HTTP
• Integración con Ollama
Modelo de IA
• Ollama
• Llama 3 (modelo local)

Arquitectura
1. El usuario envía un mensaje desde el frontend.
2. El frontend envía el historial al backend vía POST.
3. El backend consulta el modelo local y recibe la respuesta en streaming.
4. Los fragmentos se transmiten al cliente mediante SSE.
5. El frontend renderiza la respuesta progresivamente.

Ejecución Local

Clonar repositorio:
git clone https://github.com/angieg2400/my-chatgpt-clone.git


Instalar dependencias 

Backend:

cd server
npm install

Frontend:

cd ../client
npm install

Instalar Ollama

Descargar desde:
https://ollama.com

Instalar modelo:
ollama pull llama3.2:3b

Ejecutar backend:

cd server
node server.js

Servidor disponible en:
http://localhost:8080 

Ejecutar frontend:

cd client
npm run dev

Aplicacion disponible en:
http://localhost:5173

Autora

Angie Gomez

LinkedIn: https://www.linkedin.com/in/angie-gómez-benavides-3b5378342
