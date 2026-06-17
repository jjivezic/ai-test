# OpenAI Integration Examples

This document provides examples of how to use the OpenAI integration in this project.

## Setup

The OpenAI API key is configured in your `.env` file:
```
OPENAI_API_KEY=your-api-key-here
```

## Available Endpoints

### 1. GET /api/ai/examples
Get example prompts (no authentication required)

```bash
curl http://localhost:3000/api/ai/examples
```

### 2. POST /api/ai/chat
Send a simple prompt to OpenAI (requires authentication)

**Request:**
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "model": "gpt-3.5-turbo",
    "maxTokens": 500,
    "temperature": 0.7
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": "Explain quantum computing in simple terms",
    "response": "Quantum computing is a type of computing that uses quantum-mechanical phenomena...",
    "model": "gpt-3.5-turbo"
  },
  "message": "AI response generated successfully"
}
```

### 3. POST /api/ai/chat-history
Send a conversation with history (requires authentication)

**Request:**
```bash
curl -X POST http://localhost:3000/api/ai/chat-history \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful coding assistant"
      },
      {
        "role": "user",
        "content": "What is a closure in JavaScript?"
      },
      {
        "role": "assistant",
        "content": "A closure is a function that has access to variables in its outer scope..."
      },
      {
        "role": "user",
        "content": "Can you give me an example?"
      }
    ],
    "model": "gpt-3.5-turbo",
    "maxTokens": 500,
    "temperature": 0.7
  }'
```

## Using the OpenAI Service Directly

You can also use the `openaiService` directly in your code:

```javascript
import openaiService from './services/openaiService.js';

// Simple chat
const response = await openaiService.chat(
  'Explain Node.js in simple terms',
  {
    model: 'gpt-3.5-turbo',
    maxTokens: 500,
    temperature: 0.7
  }
);

// Chat with conversation history
const historyResponse = await openaiService.chatWithHistory(
  [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi! How can I help you?' },
    { role: 'user', content: 'Tell me a joke' }
  ],
  {
    model: 'gpt-3.5-turbo',
    maxTokens: 200,
    temperature: 0.9
  }
);

// Text completion (simpler model)
const completion = await openaiService.complete(
  'The best thing about Node.js is',
  {
    model: 'gpt-3.5-turbo-instruct',
    maxTokens: 100,
    temperature: 0.7
  }
);
```

## Parameters

### model
- `gpt-3.5-turbo` - Fast and cost-effective (default)
- `gpt-4` - More capable but slower and more expensive
- `gpt-4-turbo-preview` - Latest GPT-4 with improved performance

### maxTokens
- Maximum number of tokens in the response (1 token ≈ 4 characters)
- Default: 500
- Range: 1-4000

### temperature
- Controls randomness/creativity
- Default: 0.7
- Range: 0-2
  - 0 = Deterministic, focused
  - 1 = Balanced
  - 2 = Very creative, random

## Example Use Cases

### 1. Code Explanation
```javascript
const response = await openaiService.chat(
  'Explain what async/await does in JavaScript with an example',
  { temperature: 0.3 } // Lower temperature for factual responses
);
```

### 2. Creative Writing
```javascript
const response = await openaiService.chat(
  'Write a short story about a robot learning to paint',
  { temperature: 1.2 } // Higher temperature for creativity
);
```

### 3. Code Generation
```javascript
const response = await openaiService.chat(
  'Write a Node.js function that validates an email address using regex',
  { temperature: 0.5, maxTokens: 300 }
);
```

### 4. Data Analysis
```javascript
const response = await openaiService.chat(
  'Analyze this sales data and provide insights: [your data here]',
  { temperature: 0.4, maxTokens: 800 }
);
```

### 5. Conversational AI
```javascript
const messages = [
  { role: 'system', content: 'You are a customer support assistant' },
  { role: 'user', content: 'I forgot my password' },
  { role: 'assistant', content: 'I can help you reset it. What is your email?' },
  { role: 'user', content: 'user@example.com' }
];

const response = await openaiService.chatWithHistory(messages);
```

## Testing with Swagger

1. Start your server: `npm start`
2. Visit: `http://localhost:3000/api-docs`
3. Navigate to the "AI" section
4. Try the endpoints with the "Try it out" button

## Error Handling

All endpoints include proper error handling:
- Invalid API key → 500 error with message
- Rate limiting → 429 error
- Invalid input → 400 error with validation details
- Network issues → Proper error logging

## Best Practices

1. **Use appropriate temperature**: Lower for factual tasks, higher for creative tasks
2. **Limit maxTokens**: Prevents excessive costs and response times
3. **Add system messages**: Guide the AI's behavior and personality
4. **Handle errors**: Always wrap calls in try-catch blocks
5. **Monitor costs**: Track token usage in logs
6. **Cache responses**: For repeated queries to save costs
7. **Rate limit**: Protect against abuse and excessive costs

## Cost Considerations

- GPT-3.5-turbo: ~$0.002 per 1K tokens
- GPT-4: ~$0.03-0.06 per 1K tokens
- Monitor usage in OpenAI dashboard

Token usage is logged for every request:
```
[info] Received response from OpenAI { model: 'gpt-3.5-turbo', tokensUsed: 245 }
```
