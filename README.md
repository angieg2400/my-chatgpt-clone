\# 🤖 My ChatGPT Clone (Streaming + IA Local)



Clon funcional de ChatGPT construido con arquitectura full-stack moderna, implementando streaming en tiempo real mediante Server-Sent Events (SSE) e integración con modelo de IA local vía Ollama.



Proyecto desarrollado como parte de mi portafolio técnico para demostrar habilidades en arquitectura cliente-servidor, streaming en tiempo real y buenas prácticas de desarrollo.



---



\## 🎯 Objetivo del Proyecto



Construir un clon funcional de ChatGPT aplicando:



\- Separación clara entre frontend y backend

\- Streaming en tiempo real (SSE)

\- Integración con modelo de IA local

\- Control de versiones profesional con Git

\- Documentación clara y reproducible



---



\## 🚀 Tecnologías Utilizadas



\### 🖥 Frontend

\- React (Vite)

\- Server-Sent Events (SSE)

\- Manejo de estado con hooks

\- UI estilo ChatGPT

\- CSS modular



\### ⚙ Backend

\- Node.js

\- Express

\- Streaming HTTP (SSE)

\- Integración con Ollama (modelo Llama 3 local)

\- Arquitectura REST



\### 🧠 IA

\- Ollama

\- Llama3 (modelo local gratuito)



---



\## 🧱 Arquitectura



El proyecto sigue una arquitectura cliente-servidor:



1\. El usuario escribe un mensaje en el frontend (React).

2\. El frontend envía el historial al backend vía POST.

3\. El backend:

&nbsp;  - Procesa el mensaje

&nbsp;  - Llama al modelo local en Ollama

&nbsp;  - Recibe la respuesta en streaming

&nbsp;  - Reenvía los fragmentos al cliente usando SSE

4\. El frontend actualiza la interfaz progresivamente con los deltas recibidos.



Esto permite una experiencia similar a ChatGPT real.



---



\## 🧠 Características Principales



\- Streaming de respuesta en tiempo real

\- Integración con modelo local (sin costos de API)

\- Manejo de errores

\- Separación clara de responsabilidades

\- Código modular y comentado

\- Buenas prácticas con Git (.gitignore, commits estructurados)



---



\## 📂 Estructura del Proyecto



my-chatgpt-clone/

│

├── client/ # Frontend React

│ ├── src/

│ └── package.json

│

├── server/ # Backend Express

│ ├── server.js

│ └── package.json

│

├── .gitignore

└── README.md





---



\## ⚙ Instalación y Ejecución Local



\### 1️⃣ Clonar repositorio



```bash

git clone https://github.com/TU\_USUARIO/my-chatgpt-clone.git

cd my-chatgpt-clone





2\. Instalar dependencias



Backend

cd server

npm install





Frontend

cd ../client

npm install





3\. Instalar Ollama (IA local)



Descargar desde:



👉 https://ollama.com



Descargar modelo:

ollama pull llama3.2:3b





4\.  Ejecutar Backend



cd server

node server.js





Servidor disponible en: http://localhost:8080





5\. Ejecutar Frontend



cd client

npm run dev



Aplicación disponible en: http://localhost:5173





📸 Vista Previa



Interfaz estilo ChatGPT con:



Mensajes diferenciados usuario / asistente



Indicador de "Escribiendo..."



Streaming progresivo de respuesta



📚 Aprendizajes Clave



Durante este proyecto reforcé:



Implementación de streaming con SSE



Manejo avanzado de estados en React



Integración de modelos de IA locales



Arquitectura full-stack desacoplada



Flujo profesional de Git y control de versiones



🔮 Mejoras Futuras



Persistencia de historial en base de datos



Autenticación de usuarios



Soporte multi-modelo (OpenAI / Claude / Local)



Deploy en Vercel + Render



Versión SaaS multi-tenant



👩‍💻 Autora



Angie Gomez



GitHub: https://github.com/angieg2400/my-chatgpt-clone.git



LinkedIn: www.linkedin.com/in/angie-gómez-benavides-3b5378342



