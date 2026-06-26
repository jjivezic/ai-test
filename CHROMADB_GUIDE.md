# ChromaDB Vector Database - Quick Start

Napravljen potpuni RAG (Retrieval Augmented Generation) sistem sa ChromaDB!

## Šta je urađeno:

✅ ChromaDB instaliran  
✅ Vector servis kreiran  
✅ AI embeddings integracija (Gemini ili OpenAI preko factory)  
✅ CRUD API endpoints  
✅ Swagger dokumentacija  
✅ LangChain agent sa alatima  
✅ Google Drive sync (npm run ingest:drive)

## API Endpoints:

### 1. Dodaj Dokumente
```bash
POST /api/vector/add

curl -X POST http://localhost:3000/api/vector/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "id": "doc1",
        "text": "Node.js je JavaScript runtime koji omogućava server-side development",
        "metadata": {
          "fileName": "nodejs-intro.txt",
          "category": "programming"
        }
      },
      {
        "id": "doc2",
        "text": "Express.js je web framework za Node.js aplikacije",
        "metadata": {
          "fileName": "express-guide.txt",
          "category": "frameworks"
        }
      }
    ]
  }'
```

### 2. Pretraga (Semantic Search)
```bash
POST /api/vector/search

curl -X POST http://localhost:3000/api/vector/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Kako napraviti web aplikaciju?",
    "nResults": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "Kako napraviti web aplikaciju?",
    "results": [
      {
        "id": "doc2",
        "text": "Express.js je web framework...",
        "metadata": {
          "fileName": "express-guide.txt",
          "category": "frameworks"
        },
        "distance": 0.23
      }
    ],
    "count": 1
  }
}
```

### 3. Statistika
```bash
GET /api/vector/stats

curl http://localhost:3000/api/vector/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Svi Dokumenti
```bash
GET /api/vector/all

curl http://localhost:3000/api/vector/all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Brisanje Dokumenata
```bash
POST /api/vector/delete

curl -X POST http://localhost:3000/api/vector/delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["doc1", "doc2"]
  }'
```

### 6. Reset Database
```bash
POST /api/vector/reset

curl -X POST http://localhost:3000/api/vector/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Korišćenje u Kodu:

```javascript
import { search, getStats, addDocuments } from './services/vectorService.js';

// 1. Dodaj dokumente
await addDocuments([
  {
    id: 'contract-xyz',
    text: 'Ugovor sa klijentom XYZ o izradi web aplikacije...',
    metadata: {
      fileName: 'XYZ_contract.pdf',
      path: '/Drive/Contracts/2024/',
      date: '2024-12-29'
    }
  }
]);

// 2. Pretraži
const results = await search('Gde je ugovor sa klijentom XYZ?', 5);

console.log(results);
// [{
//   id: 'contract-xyz',
//   text: 'Ugovor sa klijentom XYZ...',
//   metadata: { fileName: 'XYZ_contract.pdf', ... },
//   distance: 0.12
// }]

// 3. Dobavi statistiku
const stats = await getStats();
console.log(stats); // { collectionName: 'documents', documentCount: 100 }
```

## RAG Pattern - AI sa Kontekstom (provider-agnostic):

```javascript
import { search } from './services/vectorService.js';
import { ragQuery } from './services/ai/factory.js';

async function askQuestion(question) {
  // 1. Pronađi relevantne dokumente
  const relevantDocs = await search(question, 3);
  
  // 2. Pitaj AI sa kontekstom (radi sa Gemini ili OpenAI)
  const answer = await ragQuery(
    question,
    relevantDocs.map(doc => doc.text)
  );
  
  return {
    answer,
    sources: relevantDocs.map(d => d.metadata.fileName)
  };
}

// Primer
const result = await askQuestion('Gde je ugovor sa klijentom XYZ?');
console.log(result.answer);
console.log('Izvori:', result.sources);
```

## LangChain Agent - AI Assistant sa Alatima:

Agent može da pretražuje dokumente, šalje email i sumira fajlove.

```javascript
import { executeTask } from './services/agentService.js';

// Agent automatski bira alate i odgovara na pitanja
const result = await executeTask('Pronađi ugovore iz 2024. godine');
console.log(result.answer);
```

Podržani alati:
- **searchDocuments** - Pretraga dokumenata u vector DB
- **sendEmail** - Slanje email-a
- **getDocumentStats** - Statistika baze
- **summarizeDocument** - Sumiranje dokumenata

Radi sa Gemini ili OpenAI (podesi u `.env`: `AI_PROVIDER=gemini` ili `AI_PROVIDER=openai`)

## Kako Radi:

```
1. Dodaješ Tekst → AI kreira Embeddings (768 brojeva)
2. Vector DB (Chroma/Qdrant/Pinecone/Weaviate) čuva embeddings + tekst + metadata
3. Pretraga → Embedding od upita → DB pronalazi slične
4. Vraća najsličnije dokumente sa distance score (niže = bolje)
```

## Folder Struktura (servisi):

```
src/services/
├── ai/
│   ├── factory.js    ← Bira Gemini ili OpenAI
│   ├── gemini.js     ← Gemini implementacija
│   └── openai.js     ← OpenAI implementacija
├── agentService.js   ← LangChain agent
├── vectorService.js  ← Vector DB apstrakcija
├── vectorProviders/  ← DB provideri
└── ...
```

## Google Drive Sync:

```bash
# Ručno pokretanje
npm run ingest:drive

# Automatski: cron job (vidi src/jobs/systemJobs.js)
```

Podržani fajlovi: PDF, DOCX, XLSX, Google Docs, Google Sheets, TXT, CSV

## Persistent Storage:

ChromaDB automatski čuva podatke u:
```
./chroma_data/
```

Podaci ostaju nakon restarta servera!

## Testiranje:

```bash
# 1. Pokreni server
npm start

# 2. Login pa uzmi token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "pass"}'

# 3. Dodaj test dokumente
curl -X POST http://localhost:3000/api/vector/add \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "id": "test1",
        "text": "ChromaDB je vector database za embeddings",
        "metadata": {"type": "tutorial"}
      }
    ]
  }'

# 4. Pretraži
curl -X POST http://localhost:3000/api/vector/search \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Šta je vector database?"}'
```

## AI Provider Config:

U `.env` fajlu:
```env
# Biraj provider
AI_PROVIDER=gemini    # ili openai

# Gemini
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# OpenAI
OPENAI_API_KEY=xxx
OPENAI_MODEL=gpt-4

# Vector DB
VECTOR_DB_PROVIDER=chroma  # ili qdrant, pinecone, weaviate
```

## Best Practices:

1. **Chunking** - Razbij velike dokumente na manje delove (500-1000 karaktera)
2. **Metadata** - Čuvaj korisne info (ime fajla, datum, path)
3. **Unique IDs** - Koristi jedinstvene ID-jeve (npr. `${fileName}_chunk_${index}`)
4. **Batch Insert** - Dodavaj više dokumenata odjednom (do 100)
5. **Distance Threshold** - Filtriraj rezultate sa distance > 0.5
