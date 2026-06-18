# Multi-Provider Vector Database System

This project now supports **4 vector database providers**:

| Provider   | Type        | Connection                                                     |
| ---------- | ----------- | -------------------------------------------------------------- |
| **ChromaDB** | Local       | Default (local server)                                         |
| **Pinecone** | Cloud       | Managed vector database (Pinecone.io)                          |
| **Qdrant**   | Self-hosted | Docker or Qdrant Cloud                                         |
| **Weaviate** | Self-hosted | Docker or Weaviate Cloud Services (WCS)                        |

## Quick Switch

Set `VECTOR_DB_PROVIDER` in your `.env` file:

```env
# Choose one: chroma, pinecone, qdrant, weaviate (default: chroma)
VECTOR_DB_PROVIDER=pinecone
```

## Provider Installation Requirements

### ChromaDB (Default)
Already installed. Just run the server:
```bash
chroma run --path ./chroma_data --host localhost --port 8000
```

### Pinecone
Requires a Pinecone account and API key:
```env
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-east-1        # or your region
PINECONE_INDEX_NAME=documents         # optional, default: documents
```

### Qdrant
Self-hosted (Docker) or Qdrant Cloud:
```env
VECTOR_DB_PROVIDER=qdrant
QDRANT_URL=http://localhost:6333      # or cloud URL
QDRANT_API_KEY=your-qdrant-api-key    # optional for local
QDRANT_COLLECTION_NAME=documents      # optional, default: documents
```

Run Qdrant with Docker:
```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### Weaviate
Self-hosted (Docker) or WCS:
```env
VECTOR_DB_PROVIDER=weaviate
WEAVIATE_HOST=localhost               # or cloud host
WEAVIATE_PORT=8080                    # default: 8080
WEAVIATE_SCHEME=http                   # or https
WEAVIATE_API_KEY=your-weaviate-key    # optional for local
WEAVIATE_CLASS_NAME=Document          # optional, default: Document
```

Run Weaviate with Docker:
```bash
docker run -p 8080:8080 semitechnologies/weaviate:latest
```

## API Endpoints

All endpoints are available under `/api/vector/`.

### Check Active Provider
```bash
GET /api/vector/provider

Response:
{
  "success": true,
  "data": {
    "provider": "pinecone",
    "availableProviders": ["chroma", "pinecone", "qdrant", "weaviate"],
    "stats": {
      "documentCount": 42
    }
  }
}
```

### Add Documents
```bash
POST /api/vector/add
Content-Type: application/json

{
  "documents": [
    {
      "id": "doc1",
      "text": "Node.js is a JavaScript runtime built on Chrome's V8 engine",
      "metadata": {
        "name": "nodejs-intro",
        "category": "programming"
      }
    }
  ]
}
```

### Search (Semantic)
```bash
POST /api/vector/search
Content-Type: application/json

{
  "query": "JavaScript runtime",
  "nResults": 5,
  "keyword": "Node",           # optional - exact match filter
  "maxDistance": 0.5           # optional - similarity threshold (0-2, lower = better)
}
```

### Get Stats
```bash
GET /api/vector/stats
```

### Get All Documents
```bash
GET /api/vector/all
```

### Delete Documents
```bash
POST /api/vector/delete
Content-Type: application/json

{
  "ids": ["doc1", "doc2"]
}
```

### Reset Database
```bash
POST /api/vector/reset
```

## Architecture

```
src/services/vectorService.js          ← Unified facade (routes here)
├── src/services/vectorProviders/
│   ├── chromaService.js               ← ChromaDB implementation
│   ├── pineconeService.js             ← Pinecone implementation
│   ├── qdrantService.js               ← Qdrant implementation
│   └── weaviateService.js             ← Weaviate implementation
├── src/config/vectorProviders.js      ← Provider registry & config
└── src/modules/vector/                ← API routes, controller, validation
```

All providers share the same interface:
- `initialize()` - Connect/setup
- `addMany(documents)` - Add documents with embeddings
- `search(query, nResults, keyword, maxDistance, where)` - Semantic search
- `deleteMany(ids)` - Remove documents
- `getAll()` - List all documents
- `getStats()` - Collection/index stats
- `reset()` - Clear all data

## Switching Providers at Runtime

The active provider is determined by the `VECTOR_DB_PROVIDER` env variable. Each request to the vector service automatically delegates to the correct provider implementation.

To switch providers:
1. Update `VECTOR_DB_PROVIDER` in `.env`
2. Restart the server
3. Data is **not** automatically migrated between providers

## Notes

- All providers use **Gemini** (`text-embedding-004`) for creating embeddings (768 dimensions)
- Distance metric: Cosine similarity for all providers
- Each provider response includes `"provider": "xxx"` so you know which backend served the request
- ChromaDB is the default and requires no cloud accounts
