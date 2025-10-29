# VOXA - Multimodal AI Assistant

An intelligent multimodal assistant that acts as both a customer-care representative and a personal AI assistant. Speak and respond naturally via voice, text, and video through a web dashboard or telephony (SIP).

## Features

### 🎯 Core Capabilities

- **Live Audio & Video** - HD video with automatic fallback to audio-only
- **Call Handling** - Voice and video calls via WebRTC/SIP
- **Intent Routing** - Detect and route user intents (Billing, Technical Support, Sales, Personal Assistant)
- **CRM Integration** - Customer lookup, order history, ticket creation
- **Scheduling** - Book, modify, and confirm meetings
- **FAQ & Multimodal Answers** - Answer questions with visual support
- **Call Summaries** - Automatic transcription and summary generation

### 🔐 Privacy & Safety

- Explicit consent for video, screen-share, and recording
- Visible recording indicators
- Privacy-first design
- GDPR compliant

## Tech Stack

### Frontend
- **React** + **TypeScript**
- **LiveKit Client** - Real-time video/audio
- **Tailwind CSS** + **shadcn/ui** - Beautiful UI
- **Zustand** - State management

### Backend
- **NestJS** - API server
- **MongoDB** - Database
- **LiveKit Server SDK** - Token generation
- **JWT** - Authentication

### Agent
- **Python** - Agent runtime
- **LiveKit Agents** - Agent framework
- **OpenAI GPT-4o** - LLM
- **Google Realtime API** - Voice synthesis

## Quick Start

### Prerequisites

```bash
# Install Node.js 18+
# Install Python 3.10+
# Install MongoDB
# Set up LiveKit Server (or use cloud.livekit.io)
```

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd Voxa
```

2. **Install dependencies**

```bash
# Backend
cd backend
npm install

# Frontend
cd ../voxa-flow
npm install

# Agent dependencies
cd ..
pip install -r requirements.txt
```

3. **Configure environment variables**

Create `.env` files in each directory with the following variables:

**Root .env:**
```env
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
OPENAI_API_KEY=sk-your_key
BACKEND_URL=http://localhost:3000
```

**Backend .env:**
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/voxa
JWT_SECRET=your_secret
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

**Frontend .env:**
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_LIVEKIT_URL=wss://your-livekit-server.com
```

4. **Start services**

Terminal 1 - Backend:
```bash
cd backend
npm run start:dev
```

Terminal 2 - Frontend:
```bash
cd voxa-flow
npm run dev
```

Terminal 3 - Agent:
```bash
python agent.py dev
```

5. **Access the application**

Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
Voxa/
├── agent.py              # Python agent entry point
├── prompts.py            # Agent instructions
├── tools.py              # Agent tools (CRM, scheduling, etc.)
├── requirements.txt      # Python dependencies
├── backend/              # NestJS backend
│   ├── src/
│   │   ├── agent/        # Agent controller
│   │   ├── auth/         # Authentication
│   │   ├── calls/        # Call management
│   │   ├── crm/          # CRM operations
│   │   ├── scheduling/   # Meeting scheduling
│   │   └── schemas/      # MongoDB schemas
│   └── package.json
├── voxa-flow/            # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # React hooks
│   │   ├── lib/          # Services (LiveKit)
│   │   └── pages/        # Pages
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Agent & LiveKit
- `GET /api/agent/token` - Generate LiveKit access token

### CRM
- `GET /api/crm/customers/:id` - Get customer details
- `GET /api/crm/customers/email/:email` - Find customer by email
- `POST /api/crm/tickets` - Create support ticket
- `GET /api/crm/tickets` - List tickets
- `POST /api/crm/orders` - Create order

### Scheduling
- `POST /api/scheduling/meetings` - Schedule meeting
- `GET /api/scheduling/meetings?upcoming=true` - Get upcoming meetings
- `PUT /api/scheduling/meetings/:id` - Update meeting
- `DELETE /api/scheduling/meetings/:id` - Cancel meeting

### Calls
- `POST /api/calls` - Create call record
- `GET /api/calls` - Get call history
- `PUT /api/calls/:id/transcript` - Add transcript
- `PUT /api/calls/:id/summary` - Add summary

## Development

### Adding New Agent Tools

1. Create the tool function in `tools.py`:

```python
@function_tool()
async def my_tool(context: RunContext, param: str) -> str:
    """Tool description"""
    # Implementation
    return "result"
```

2. Register it in `agent.py`:

```python
self.register_tool(my_tool)
```

3. The agent will automatically use the tool when appropriate

### Adding API Endpoints

1. Create service in `backend/src/problem/service.ts`
2. Create controller in `backend/src/problem/controller.ts`
3. Add module in `backend/src/problem/module.ts`
4. Import in `backend/src/app.module.ts`

## Deployment

### Using Docker

```bash
docker-compose up -d
```

### Manual Deployment

1. Build frontend: `cd voxa-flow && npm run build`
2. Build backend: `cd backend && npm run build`
3. Start with PM2 or systemd
4. Run agent as a service

## Configuration

### Agent Configuration

Edit `prompts.py` to customize agent behavior, tone, and instructions.

### UI Customization

Edit `voxa-flow/src/components/voxa/` to customize UI components.

### Business Configuration

Users can customize via the Settings dialog:
- Business name and branding
- Greeting messages
- Industry and services
- Customer care goals

## Troubleshooting

### Agent Not Starting

- Check Python version (3.10+)
- Verify all dependencies: `pip install -r requirements.txt`
- Check environment variables
- Review agent logs

### LiveKit Connection Issues

- Verify LiveKit server is running
- Check LIVEKIT_URL, API_KEY, and API_SECRET
- Ensure proper CORS configuration
- Check network connectivity

### Frontend Not Connecting

- Verify VITE_BACKEND_URL is correct
- Check backend is running
- Review browser console for errors
- Verify JWT token in localStorage

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Acknowledgments

- [LiveKit](https://livekit.io) for real-time media infrastructure
- [OpenAI](https://openai.com) for GPT-4o
- [NestJS](https://nestjs.com) for the backend framework
- [shadcn/ui](https://ui.shadcn.com) for beautiful components