# Voxa - AI Voice Assistant

A full-stack AI voice application that connects users to a LiveKit voice room with a Python voice agent.

## Project Structure

```
/
├── backend/          # NestJS backend server
├── frontend/         # React frontend with Vite
├── agent.py          # Python voice agent
├── tools.py          # Agent tools and functions
└── prompts.py        # Agent prompts and instructions
```

## Features

- **Splash Screen**: 3-second animated splash screen with Voxa logo
- **Voice Chat**: Real-time voice interaction with AI assistant
- **LiveKit Integration**: Seamless WebRTC voice communication
- **Transcript Display**: Real-time conversation transcript
- **Dark Theme**: Modern UI with dark background (#101828) and blue accent (#3B82F6)

## Setup

### 1. Configure Environment Variables

Update `.env` in the root directory:

```bash
LIVEKIT_URL=wss://voice-assistant-zcs1h1kx.livekit.cloud
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
MISTRAL_API_KEY=your_mistral_api_key_here
BACKEND_URL=https://voxa-smoky.vercel.app
BACKEND_API_KEY=your_backend_api_key_here
REDIS_URL=redis://localhost:6379  # Optional: for conversation history persistence
```

Update `backend/.env`:

```bash
LIVEKIT_URL=wss://voice-assistant-zcs1h1kx.livekit.cloud
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
PORT=3000
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

**Python Agent:**
```bash
pip install -r requirements.txt
```

### 3. Run the Application

**Start Backend (NestJS):**
```bash
cd backend
npm run start:dev
```

The backend will automatically start the Python agent on startup.

**Start Frontend (React):**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## How It Works

1. User opens the app and sees the Voxa splash screen for 3 seconds
2. User clicks "Start Talking" button
3. Frontend requests a LiveKit token from the backend
4. Backend creates a room and returns access credentials
5. User connects to the LiveKit voice room
6. Python agent (Voxa) joins the same room automatically
7. Real-time voice conversation begins with transcript display

## API Endpoints

### Backend (NestJS)

- `GET /auth/token?roomName=xxx&participantName=xxx` - Get LiveKit access token
- `POST /rooms/create` - Create room and get token
- `GET /health` - Health check endpoint

## Technologies

- **Frontend**: React, Vite, Tailwind CSS, LiveKit Components
- **Backend**: NestJS, LiveKit Server SDK
- **Agent**: Python, LiveKit Agents, Google Realtime, Mistral AI
- **Communication**: LiveKit (WebRTC)
