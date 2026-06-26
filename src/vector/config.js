/**
 * Vector Database Provider Configuration
 * Central registry for all supported vector database providers
 */

export const VECTOR_PROVIDERS = {
  CHROMA: 'chroma',
  PINECONE: 'pinecone',
  QDRANT: 'qdrant',
  WEAVIATE: 'weaviate',
};

/**
 * Default provider from environment, falls back to chroma
 */
export const DEFAULT_PROVIDER = process.env.VECTOR_DB_PROVIDER || VECTOR_PROVIDERS.CHROMA;

/**
 * Collection/Index names for each provider
 */
export const COLLECTION_NAMES = {
  [VECTOR_PROVIDERS.CHROMA]: process.env.CHROMA_COLLECTION_NAME || 'documents',
  [VECTOR_PROVIDERS.PINECONE]: process.env.PINECONE_INDEX_NAME || 'documents',
  [VECTOR_PROVIDERS.QDRANT]: process.env.QDRANT_COLLECTION_NAME || 'documents',
  [VECTOR_PROVIDERS.WEAVIATE]: process.env.WEAVIATE_CLASS_NAME || 'Document',
};

/**
 * Embedding dimensions (depends on the embedding model used)
 * Gemini text-embedding-004 = 768 dimensions
 */
export const EMBEDDING_DIMENSIONS = {
  [VECTOR_PROVIDERS.PINECONE]: 768,
  [VECTOR_PROVIDERS.QDRANT]: 768,
  [VECTOR_PROVIDERS.WEAVIATE]: 768,
};

/**
 * Connection configs for each provider
 */
export const CONNECTION_CONFIGS = {
  [VECTOR_PROVIDERS.CHROMA]: {
    path: process.env.CHROMA_URL || 'http://localhost:8000',
  },
  [VECTOR_PROVIDERS.PINECONE]: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
  },
  [VECTOR_PROVIDERS.QDRANT]: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  },
  [VECTOR_PROVIDERS.WEAVIATE]: {
    host: process.env.WEAVIATE_HOST || 'localhost',
    port: process.env.WEAVIATE_PORT || 8080,
    scheme: process.env.WEAVIATE_SCHEME || 'http',
    apiKey: process.env.WEAVIATE_API_KEY,
  },
};

export default {
  PROVIDERS: VECTOR_PROVIDERS,
  DEFAULT_PROVIDER,
  COLLECTION_NAMES,
  EMBEDDING_DIMENSIONS,
  CONNECTION_CONFIGS,
};
