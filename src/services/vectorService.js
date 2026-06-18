/**
 * Vector Database Service - Unified Provider Abstraction
 *
 * Supports multiple vector database providers:
 * - ChromaDB (default, local)
 * - Pinecone (cloud)
 * - Qdrant (self-hosted or cloud)
 * - Weaviate (self-hosted or cloud)
 *
 * Set VECTOR_DB_PROVIDER in .env to select the active provider:
 * 'chroma', 'pinecone', 'qdrant', or 'weaviate'
 */

import { VECTOR_PROVIDERS, DEFAULT_PROVIDER } from '../config/vectorProviders.js';
import logger from '../config/logger.js';

// Provider-specific services
import * as chromaService from './vectorProviders/chromaService.js';
import * as pineconeService from './vectorProviders/pineconeService.js';
import * as qdrantService from './vectorProviders/qdrantService.js';
import * as weaviateService from './vectorProviders/weaviateService.js';

/**
 * Get the currently active provider service based on environment config
 */
const getActiveProvider = () => {
  const provider = DEFAULT_PROVIDER;

  switch (provider) {
    case VECTOR_PROVIDERS.PINECONE:
      logger.debug('Using Pinecone vector database provider');
      return pineconeService;
    case VECTOR_PROVIDERS.QDRANT:
      logger.debug('Using Qdrant vector database provider');
      return qdrantService;
    case VECTOR_PROVIDERS.WEAVIATE:
      logger.debug('Using Weaviate vector database provider');
      return weaviateService;
    case VECTOR_PROVIDERS.CHROMA:
    default:
      logger.debug('Using ChromaDB vector database provider');
      return chromaService;
  }
};

/** Initialize the active vector database provider */
export const initialize = async () => {
  const provider = getActiveProvider();
  logger.info(`Initializing vector database provider: ${DEFAULT_PROVIDER}`);
  return provider.initialize();
};

/**
 * Add documents to the active vector database
 * @param {Array} documents - Array of {id, text, metadata}
 */
export const addMany = async (documents) => {
  const provider = getActiveProvider();
  logger.info(`Adding ${documents.length} documents to ${DEFAULT_PROVIDER}`);
  return provider.addMany(documents);
};

/**
 * Search for similar documents using semantic search
 * @param {string} query - Search query
 * @param {number} nResults - Number of results to return
 * @param {string} keyword - Optional keyword to filter results
 * @param {number} maxDistance - Optional max distance threshold
 * @param {Object} where - Optional metadata filter
 */
export const search = async (query, nResults = 5, keyword = null, maxDistance = 1, where = null) => {
  const provider = getActiveProvider();
  logger.info(`Searching ${DEFAULT_PROVIDER} for: "${query.substring(0, 50)}..."`);
  return provider.search(query, nResults, keyword, maxDistance, where);
};

/** Delete documents by IDs */
export const deleteMany = async (ids) => {
  const provider = getActiveProvider();
  logger.info(`Deleting ${ids.length} documents from ${DEFAULT_PROVIDER}`);
  return provider.deleteMany(ids);
};

/** Get all documents */
export const getAll = async () => {
  const provider = getActiveProvider();
  logger.info(`Getting all documents from ${DEFAULT_PROVIDER}`);
  return provider.getAll();
};

/** Get collection/index stats */
export const getStats = async () => {
  const provider = getActiveProvider();
  logger.info(`Getting stats from ${DEFAULT_PROVIDER}`);
  return provider.getStats();
};

/** Reset the active vector database */
export const reset = async () => {
  const provider = getActiveProvider();
  logger.info(`Resetting ${DEFAULT_PROVIDER} database`);
  return provider.reset();
};

/** Get the name of the currently active provider */
export const getActiveProviderName = () => DEFAULT_PROVIDER;

export default {
  initialize,
  addMany,
  search,
  deleteMany,
  getAll,
  getStats,
  reset,
  getActiveProviderName,
};
