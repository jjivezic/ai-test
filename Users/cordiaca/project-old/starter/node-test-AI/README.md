# Hyper Server

Node.js REST API server with JWT authentication, MySQL database, AI integration, and vector search.

## Features

- 🔐 JWT Token Authentication with Refresh Tokens
- 🗄️ MySQL Database Integration with Sequelize ORM
- 🤖 AI Chat (Gemini & OpenAI) with LangChain
- 🔍 Vector Search (Chroma, Qdrant, Pinecone, Weaviate)
- 🧠 LangChain Agent with Tools (search, email, summarize)
- 📄 Google Drive Sync (PDF, DOCX, XLSX, Google Docs/Sheets)
- 🛣️ RESTful API Routes
- 🎯 Modular Architecture (Feature-based modules)
- ✅ Input Validation with Error Codes
- 📝 Winston Logging (File + Console)
- 📊 Morgan HTTP Request Logging
- 🔄 Auto-generate Models, Migrations & Modules
- 📚 Swagger API Documentation
- 🎨 Centralized Error Handling

## Project Structure

```
server/
├── database/
│   ├── config.cjs               # Sequelize configuration
│   ├── connection.js            # Database connection
│   ├── models/
│   │   ├── index.js             # Models index
│   │   └── User.js              # User model
│   ├── migrations/
│   └── seeders/
├── src/
│   ├── config/
│   │   ├── logger.js            # Winston logger
│   │   ├── swagger.js           # Swagger docs
│   │   ├── validateEnv.js       # Env validation
│   │   └── vectorProviders.js   # Vector DB config
│   ├── integration/
│   │   └── googleDrive/
│   │       └── service.js       # Google Drive API
│   ├── jobs/
│   │   ├── index.js             # Job scheduler
│   │   ├── databaseJobs.js      # DB maintenance
│   │   └── systemJobs.js        # System jobs (Drive sync)
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verification
│   │   ├── errorHandler.js      # Error handling
│   │   ├── rateLimiter.js       # Rate limiting
│   │   ├── validate.js          # Input validation
│   │   └── ...
│   ├── modules/
│   │   ├── agent/               # AI Agent (LangChain)
│   │   ├── ai/                  # AI Chat endpoints
│   │   ├── auth/                # Authentication
│   │   ├── health/              # Health check
│   │   ├── product/             # Products CRUD
│   │   ├── users/               # Users CRUD
│   │   └── vector/              # Vector search API
│   ├── routes/
│   │   └── index.js             # Main router
│   ├── scripts/
│   │   └── syncDrive.js         # Google Drive sync
│   ├── services/
│   │   ├── ai/
│   │   │   ├── factory.js       # AI provider router
│   │   │   ├── gemini.js        # Gemini (LangChain)
│   │   │   └── openai.js        # OpenAI (LangChain)
│   │   ├── agentService.js      # LangChain agent
│   │   ├── vectorService.js     # Vector DB abstraction
│   │   ├── vectorProviders/     # DB implementations
│   │   │   ├── chromaService.js
│   │   │   ├── pineconeService.js
│   │   │   ├── qdrantService.js
│   │   │   └── weaviateService.js
│   │   ├── emailService.js
│   │   ├── googleDriveService.js
│   │   ├── s3Service.js
│   │   └── cronService.js
│   ├── templates/
│   │   └── emailTemplate.js
│   └── server.js                # Entry point
├── .env.example
├── .sequelizerc
├── CHROMADB_GUIDE.md
├── GEMINI_EXAMPLES.md
├── OPENAI_EXAMPLES.md
├── VECTOR_DATABASE_GUIDE.md
├── package.json
└── README.md
```

## Installation

```bash
git clone <repository>
cd server
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed   # optional
```

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hyper_server

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# AI Provider (gemini or openai)
AI_PROVIDER=gemini

# Gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4

# Vector Database (chroma, qdrant, pinecone, weaviate)
VECTOR_DB_PROVIDER=chroma

# Google Drive (for sync)
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account
GOOGLE_PRIVATE_KEY=your_private_key
```

## Usage

```bash
# Development (auto-reload)
npm run dev

# Production
npm start

# API docs at http://localhost:3000/api-docs
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production start |
| `npm run dev` | Development with nodemon |
| `npm run ingest:drive` | Sync Google Drive to vector DB |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed data |
| `npm run db:reset` | Reset database |
| `npm run generate:model <Name>` | Generate CRUD module |
| `npm run lint` | Lint code |
| `npm run format` | Format code |

## AI Chat

Switch between providers via `AI_PROVIDER` env var:

```javascript
import { chat, ragQuery } from './services/ai/factory.js';

// Simple chat
const response = await chat('What is Node.js?');

// RAG with context
const answer = await ragQuery(question, contextChunks);
```

Powered by **LangChain** — supports Gemini and OpenAI with the same interface.

## AI Agent (LangChain)

The agent can autonomously use tools to complete tasks:

```javascript
import { executeTask } from './services/agentService.js';

// Search documents, send emails, summarize files
const result = await executeTask('Find contracts from 2024');
```

**Available tools:**
- `searchDocuments` — Vector DB semantic search
- `sendEmail` — Send emails via SMTP
- `getDocumentStats` — Database statistics
- `summarizeDocument` — Summarize any document

## Vector Search

Supports multiple vector databases:

```
VECTOR_DB_PROVIDER=chroma   # Default, local
VECTOR_DB_PROVIDER=qdrant   # Local or cloud
VECTOR_DB_PROVIDER=pinecone # Cloud-only
VECTOR_DB_PROVIDER=weaviate # Local or cloud
```

```bash
# Start ChromaDB
npm run chroma

# API endpoints at /api/vector/*
```

## Google Drive Sync

```bash
npm run ingest:drive
```

Syncs Google Drive folder to vector DB:
- PDF, DOCX, XLSX, TXT, CSV
- Google Docs & Google Sheets
- Smart sync (only new/changed files)
- Automatic chunking (LangChain text splitter)

Also runs automatically via cron job (every hour).

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/verify` | Verify token |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |

### AI Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/chat` | Simple chat |
| POST | `/api/ai/history` | Chat with history |
| POST | `/api/ai/analyze-image` | Image analysis |

### AI Agent
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/agent/execute` | Run agent task |

### Vector Search
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vector/add` | Add documents |
| POST | `/api/vector/search` | Semantic search |
| GET | `/api/vector/stats` | DB statistics |
| GET | `/api/vector/all` | All documents |
| POST | `/api/vector/delete` | Delete documents |
| POST | `/api/vector/reset` | Reset database |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health |

## Technologies

- **Express.js** — Web framework
- **Sequelize** — ORM for MySQL
- **MySQL2** — Database driver
- **LangChain** — AI framework (agents, chains, tools)
- **Gemini / OpenAI** — AI providers
- **Chroma / Qdrant / Pinecone / Weaviate** — Vector databases
- **JWT** — Token authentication
- **Bcrypt** — Password hashing
- **Winston** — Logging
- **Swagger** — API documentation
- **Google APIs** — Drive & Sheets integration
- **CORS, Helmet, Rate Limiting** — Security

## Code Generator

```bash
npm run generate:model Product
```

Creates: model, migration, controller, manager, routes, Swagger docs.
Define schema in `database/schema-definition.js`.

## Error Handling

```javascript
throw new AppError('Not found', 404, true, 'NOT_FOUND');

// Response:
// { "success": false, "status": "fail", "message": "Not found", "code": "NOT_FOUND" }
```

## Logging

- `logs/error.log` — Errors only
- `logs/combined.log` — All logs
- Console output in development
