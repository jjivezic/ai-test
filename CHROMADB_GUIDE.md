# ChromaDB Vector Database - Quick Start

Napravljen potpuni RAG (Retrieval Augmented Generation) sistem sa ChromaDB!

## Šta je urađeno:

✅ ChromaDB instaliran  
✅ Vector servis kreiran  
✅ Gemini embeddings integracija  
✅ CRUD API endpoints  
✅ Swagger dokumentacija  

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
import vectorService from './services/vectorService.js';

// 1. Dodaj dokumente
await vectorService.addDocuments([
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
const results = await vectorService.search(
  'Gde je ugovor sa klijentom XYZ?',
  5
);

console.log(results);
// [{
//   id: 'contract-xyz',
//   text: 'Ugovor sa klijentom XYZ...',
//   metadata: { fileName: 'XYZ_contract.pdf', ... },
//   distance: 0.12
// }]

// 3. Dobavi statistiku
const stats = await vectorService.getStats();
console.log(stats); // { collectionName: 'documents', documentCount: 100 }
```

## RAG Pattern - AI sa Kontekstom:

```javascript
// Kombinuj Vector Search + Gemini Chat
import vectorService from './services/vectorService.js';
import geminiService from './services/geminiService.js';

async function askQuestion(question) {
  // 1. Pronađi relevantne dokumente
  const relevantDocs = await vectorService.search(question, 3);
  
  // 2. Napravi kontekst
  const context = relevantDocs
    .map(doc => doc.text)
    .join('\n\n');
  
  // 3. Pitaj AI sa kontekstom
  const prompt = `
    Kontekst iz dokumenata:
    ${context}
    
    Pitanje: ${question}
    
    Odgovori na osnovu konteksta:
  `;
  
  const answer = await geminiService.chat(prompt);
  
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

## Kako Radi:

```
1. Dodaješ Tekst → Gemini kreira Embeddings (768 brojeva)
2. ChromaDB čuva embeddings + tekst + metadata
3. Pretraga → Gemini embedding od upita → ChromaDB pronalazi slične
4. Vraća najsličnije dokumente sa distance score (niže = bolje)
```

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

## Best Practices:

1. **Chunking** - Razbij velike dokumente na manje delove (500-1000 karaktera)
2. **Metadata** - Čuvaj korisne info (ime fajla, datum, path)
3. **Unique IDs** - Koristi jedinstvene ID-jeve (npr. `${fileName}_chunk_${index}`)
4. **Batch Insert** - Dodavaj više dokumenata odjednom (do 100)
5. **Distance Threshold** - Filtriraj rezultate sa distance > 0.5

## Sledeći Korak - Google Drive Integracija:

```javascript
// 1. Skeniranje Google Drive fajlova
// 2. Ekstrakcija teksta (PDF, DOCX, etc)
// 3. Chunking u manje delove
// 4. Kreiranje embeddings
// 5. Skladištenje u ChromaDB
// 6. AI Chat sa kontekstom
```

Hoćeš da nastavimo sa Google Drive integracijom? 🚀
