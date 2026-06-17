# Google Gemini Integration Examples

## Quick Start

### 1. Nabavi API Key
🔑 https://aistudio.google.com/app/apikey
- Klikni "Get API key"  
- FREE tier: 15 req/min, 1500 req/day

### 2. Dodaj u .env
```env
GEMINI_API_KEY=tvoj-api-key-ovde
```

### 3. Testiranje

#### Primer 1: Jednostavan Chat
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Objasni Node.js u 2-3 rečenice",
    "provider": "gemini"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": "Objasni Node.js u 2-3 rečenice",
    "response": "Node.js je JavaScript runtime environment koji omogućava izvršavanje JavaScript koda van browsera...",
    "provider": "gemini",
    "model": "gemini-1.5-flash"
  }
}
```

#### Primer 2: Sa Specificnim Modelom
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Write a haiku about coding",
    "provider": "gemini",
    "model": "gemini-1.5-pro",
    "temperature": 1.2
  }'
```

#### Primer 3: Konverzacija sa Istorijom
```bash
curl -X POST http://localhost:3000/api/ai/chat-history \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "messages": [
      {"role": "user", "content": "Šta je closure u JavaScript?"},
      {"role": "assistant", "content": "Closure je funkcija koja ima pristup promenljivama..."},
      {"role": "user", "content": "Daj mi praktičan primer"}
    ],
    "provider": "gemini"
  }'
```

## Direktno Korišćenje u Kodu

```javascript
import geminiService from './services/geminiService.js';

// 1. Jednostavan chat
const response = await geminiService.chat(
  'Kako napraviti REST API u Node.js?',
  {
    model: 'gemini-1.5-flash', // Brz i besplatan
    maxTokens: 800,
    temperature: 0.7
  }
);

// 2. Chat sa konverzacijom
const conversation = await geminiService.chatWithHistory(
  [
    { role: 'user', content: 'Zdravo!' },
    { role: 'assistant', content: 'Zdravo! Kako mogu da pomognem?' },
    { role: 'user', content: 'Objasni async/await' }
  ],
  { model: 'gemini-1.5-pro' }
);

// 3. Kreiranje embeddings (za RAG/Vector search)
const embedding = await geminiService.createEmbedding(
  'Tekst za embedovanje',
  'text-embedding-004'
);
console.log(embedding); // [0.123, 0.456, ...] - 768 brojeva

// 4. Analiza slike (bonus!)
const imageAnalysis = await geminiService.analyzeImage(
  'Šta se nalazi na ovoj slici?',
  imageBuffer, // Buffer ili base64
  'image/jpeg'
);
```

## Gemini Modeli

| Model | Opis | Brzina | Cena | Context |
|-------|------|--------|------|---------|
| **gemini-1.5-flash** | Najbrži, idealan za production | ⚡⚡⚡ | FREE | 1M tokens |
| **gemini-1.5-pro** | Najkvalitetniji | ⚡⚡ | FREE | 1M tokens |
| **text-embedding-004** | Embeddings za RAG | ⚡⚡⚡ | FREE | - |

## Parametri

### temperature
- `0.0` - Deterministički, isti odgovori
- `0.7` - Balans (default)
- `1.0` - Kreativnije
- `2.0` - Vrlo kreativno/random

### maxTokens
- Max dužina odgovora
- Gemini: do 8000 tokena
- 1 token ≈ 4 karaktera (engleski)
- 1 token ≈ 2-3 karaktera (srpski)

## Provider Poređenje

```javascript
// Gemini (FREE, brz)
{
  "provider": "gemini",
  "model": "gemini-1.5-flash"
}

// OpenAI (plaćen, možda bolji za kod)
{
  "provider": "openai", 
  "model": "gpt-4"
}
```

## Use Cases

### 1. Chatbot
```javascript
const answer = await geminiService.chat(
  'Kako resetujem password?',
  { temperature: 0.3 } // Nizak za tačnost
);
```

### 2. Generisanje Sadržaja
```javascript
const blogPost = await geminiService.chat(
  'Napiši blog post o AI u 200 reči',
  { temperature: 1.0, maxTokens: 1000 }
);
```

### 3. Code Review
```javascript
const review = await geminiService.chat(
  `Pregledaj ovaj kod:\n${code}\n\nDa li ima bagova?`,
  { model: 'gemini-1.5-pro', temperature: 0.5 }
);
```

### 4. Summarization
```javascript
const summary = await geminiService.chat(
  `Sažmi ovaj dokument:\n${longText}`,
  { model: 'gemini-1.5-flash', maxTokens: 500 }
);
```

### 5. Q&A sa Kontekstom
```javascript
const answer = await geminiService.chatWithHistory([
  { role: 'system', content: 'Ti si expert za Node.js' },
  { role: 'user', content: 'Šta je middleware?' },
  { role: 'assistant', content: 'Middleware je funkcija...' },
  { role: 'user', content: 'Daj primer sa Express' }
]);
```

## Error Handling

```javascript
try {
  const response = await geminiService.chat(prompt);
} catch (error) {
  if (error.message.includes('API key')) {
    console.error('Pogrešan API key');
  } else if (error.message.includes('quota')) {
    console.error('Prekoračen free tier limit');
  } else {
    console.error('Greška:', error.message);
  }
}
```

## Free Tier Limiti

✅ **Besplatno za Development:**
- 15 requests/minute
- 1,500 requests/day
- 1 million tokens/month
- Svi modeli dostupni

⚠️ **Rate Limiting:**
- Ako pređeš limit → 429 error
- Čeka se 1 minut i probaj opet

## Best Practices

1. **Koristi gemini-1.5-flash za production** (brz + besplatan)
2. **gemini-1.5-pro za kompleksne taskove** (analiza, reasoning)
3. **Niža temperatura** (0.3-0.5) za faktičke odgovore
4. **Viša temperatura** (0.9-1.2) za kreativnost
5. **Implementiraj retry logiku** za rate limits
6. **Kesiranje** čestih odgovora da uštediš API calls

## Testing

```bash
# 1. Proveri da li radi
npm start

# 2. Login i uzmi token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com", "password": "yourpass"}'

# 3. Testiraj Gemini
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test prompt", "provider": "gemini"}'
```

## Swagger UI

http://localhost:3000/api-docs → AI sekcija → Try it out

---

**Napomena:** Gemini je default provider - ako ne staviš `provider`, koristiće Gemini umesto OpenAI! 🚀
