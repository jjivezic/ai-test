/**
 * Qdrant Vector Database Service
 * Handles document storage, embeddings, and semantic search via Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createEmbedding, createEmbeddingsBatch } from '../../ai/providers/gemini.js';
import { randomUUID } from 'crypto';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';
import { COLLECTION_NAMES, EMBEDDING_DIMENSIONS, VECTOR_PROVIDERS as PROVIDERS } from '../config.js';

// Module-level state
let qdrantClient = null;
const collectionName = COLLECTION_NAMES[PROVIDERS.QDRANT];
const dimension = EMBEDDING_DIMENSIONS[PROVIDERS.QDRANT];

/**
 * Convert any string ID to a valid UUID v4 for Qdrant.
 * Qdrant requires IDs as UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 * or unsigned integers. String IDs like Google Drive file IDs won't work.
 * 
 * @param {string} id - Original string ID (e.g., Google Drive file ID) - used to seed a consistent UUID
 * @returns {string} UUID v4 string
 */
const stringToUuid = (id) => {
  return randomUUID();
};

/**
 * Sanitize payload for Qdrant.
 * Qdrant only accepts primitive values (string, number, boolean, null) in payload.
 * Nested objects and arrays are not allowed.
 * 
 * @param {Object} metadata - Raw metadata object
 * @returns {Object} Sanitized flat payload
 */
const sanitizePayload = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return {};
  
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Skip undefined and functions
    if (value === undefined || typeof value === 'function') continue;
    
    // Convert everything to string if it's not a primitive
    if (value === null) {
      sanitized[key] = null;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Arrays: join into string or skip if too large
      sanitized[key] = JSON.stringify(value);
    } else if (typeof value === 'object') {
      // Nested objects: stringify
      sanitized[key] = JSON.stringify(value);
    }
  }
  
  return sanitized;
};

/**
 * Initialize Qdrant client and collection
 */
export const initialize = async () => {
  try {
    if (qdrantClient) {
      logger.info('Qdrant already initialized');
      return;
    }

    const url = process.env.QDRANT_URL || 'http://localhost:6333';

    logger.info(`Initializing Qdrant client at ${url}...`);

    qdrantClient = new QdrantClient({
      url,
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Check if collection exists, create if not
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections?.some((c) => c.name === collectionName);
    console.log('Collection exists check:', { collectionName, exists, availableCollections: collections.collections?.map(c => c.name) });
    if (!exists) {
      logger.info(
        `Creating Qdrant collection: ${collectionName} (dimension: ${dimension})`
      );
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });
      logger.info(`Created Qdrant collection: ${collectionName}`);
    } else {
      logger.info(`Connected to existing Qdrant collection: ${collectionName}`);
    }

    logger.info('Qdrant initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Qdrant:', error);
    throw new AppError(
      `Qdrant initialization failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Add documents to Qdrant
 * @param {Array} documents - Array of document objects {id, text, metadata}
 */
export const addMany = async (documents) => {
  try {
    await initialize();

    logger.info(`Adding ${documents.length} documents to Qdrant`);

    // Create embeddings using batch embedding (more efficient)
    const texts = documents.map((doc) => doc.text);
    const embeddings = await createEmbeddingsBatch(texts);

    // Prepare points for Qdrant
    // NOTE: Qdrant requires IDs as UUIDs or unsigned integers.
    // String IDs (like Google Drive file IDs) must be converted.
    // Also, Qdrant payload only supports flat key-value pairs (no nested objects)
    const points = documents.map((doc, i) => ({
      id: stringToUuid(doc.id),
      vector: embeddings[i],
      payload: {
        text: doc.text,
        originalId: doc.id, // Store original ID for lookups
      //  ...sanitizePayload(doc.metadata || {}),
      },
    }));

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      logger.debug(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
      try {
        await qdrantClient.upsert(collectionName, {
          wait: true,
          points: batch,
        });
      } catch (batchError) {
        // Log detailed error info for debugging
        console.error('QDrant batch upsert ERROR:', {
          message: batchError.message,
          status: batchError.status,
          responseData: batchError.response?.data,
          requestBody: batchError.cause?.message,
        });
        throw batchError;
      }
    }
    logger.info(`Successfully added ${documents.length} documents to Qdrant`);

    return {
      success: true,
      count: documents.length,
      ids: documents.map((d) => d.id),
    };
  } catch (error) {
    logger.error('Failed to add documents to Qdrant:', error);
    throw new AppError(
      `Failed to add documents to Qdrant: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Search for similar documents using semantic search
 * @param {string} query - Search query
 * @param {number} nResults - Number of results to return
 * @param {string} keyword - Optional keyword filter
 * @param {number} maxDistance - Optional max distance threshold
 * @param {Object} where - Optional metadata filter
 */
export const search = async (
  query,
  nResults = 5,
  keyword = null,
  maxDistance = 1,
  where = null
) => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    // Create embedding for query (with RETRIEVAL_QUERY task type)
    const queryEmbedding = await createEmbedding(query, { taskType: 'RETRIEVAL_QUERY' });

    // Build filter if provided
    const filter = {};
    const mustConditions = [];

    if (where && Object.keys(where).length > 0) {
      Object.entries(where).forEach(([key, value]) => {
        mustConditions.push({
          key,
          match: { value },
        });
      });
    }

    if (mustConditions.length > 0) {
      filter.must = mustConditions;
    }

    // Search Qdrant
    const searchResult = await qdrantClient.search(collectionName, {
      vector: queryEmbedding,
      limit: keyword ? nResults * 3 : nResults,
      with_payload: true,
      with_vector: false,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    logger.info(`Found ${searchResult.length} results from Qdrant`);

    // Format results
    let formattedResults = searchResult.map((hit) => ({
      id: hit.payload?.originalId || hit.id, // Return original ID, fallback to UUID
      text: hit.payload?.text || '',
      metadata: { ...hit.payload },
      distance: hit.score,
      path: `${process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME || ''}/${
        hit.payload?.folderPath
          ? `${hit.payload.folderPath}/${hit.payload.name}`
          : hit.payload?.name || ''
      }${hit.payload?.extension || ''}`,
      googleLink:
        hit.payload?.googleLink ||
        `https://drive.google.com/file/d/${hit.id}`,
    }));

    // Filter by keyword if provided
    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      formattedResults = formattedResults
        .filter((doc) => doc.text.toLowerCase().includes(keywordLower))
        .map((doc) => {
          const text = doc.text.toLowerCase();
          const count = (text.match(new RegExp(keywordLower, 'g')) || []).length;
          return { ...doc, keywordCount: count };
        })
        .sort((a, b) => {
          if (b.keywordCount !== a.keywordCount) return b.keywordCount - a.keywordCount;
          return a.distance - b.distance;
        });

      logger.info(
        `After keyword filter "${keyword}": ${formattedResults.length} results`
      );
    }

    // Filter by distance threshold
    if (maxDistance !== null && maxDistance !== undefined) {
      formattedResults = formattedResults.filter((doc) => doc.distance <= maxDistance);
    }

    formattedResults = formattedResults.slice(0, nResults);

    return formattedResults;
  } catch (error) {
    logger.error('Qdrant search failed:', error);
    throw new AppError(
      `Qdrant search failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Delete documents by IDs
 * @param {Array} ids - Array of document IDs (original string IDs) to delete
 */
export const deleteMany = async (ids) => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    // Convert original IDs to Qdrant UUIDs
    const qdrantIds = ids.map((id) => {
      // If it's already a UUID, use it directly
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return id;
      }
      return stringToUuid(id);
    });

    await qdrantClient.delete(collectionName, {
      wait: true,
      points: qdrantIds,
    });

    logger.info(`Successfully deleted ${ids.length} documents from Qdrant`);

    return {
      success: true,
      count: ids.length,
    };
  } catch (error) {
    logger.error('Failed to delete documents from Qdrant:', error);
    throw new AppError(
      `Failed to delete documents from Qdrant: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get all documents from Qdrant
 */
export const getAll = async () => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    // Use scroll to get all points
    const allPoints = [];
    let offset = null;

    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await qdrantClient.scroll(collectionName, {
        limit: 100,
        offset,
        with_payload: true,
        with_vector: false,
      });

      allPoints.push(...result.points);
      offset = result.next_page_offset;
    } while (offset);

    return {
      count: allPoints.length,
      documents: allPoints.map((point) => ({
        id: point.payload?.originalId || point.id, // Return original ID
        text: point.payload?.text || '',
        metadata: { ...point.payload },
      })),
    };
  } catch (error) {
    logger.error('Failed to get documents from Qdrant:', error);
    throw new AppError(
      `Failed to get documents from Qdrant: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get collection stats
 */
export const getStats = async () => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    const collectionInfo = await qdrantClient.getCollection(collectionName);

    return {
      collectionName,
      documentCount: collectionInfo.points_count || 0,
      dimension,
      status: collectionInfo.status,
    };
  } catch (error) {
    logger.error('Failed to get Qdrant stats:', error);
    throw new AppError(
      `Failed to get Qdrant stats: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Reset collection (delete all points)
 */
export const reset = async () => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    logger.info('Resetting Qdrant collection...');

    // Delete the collection and recreate
    await qdrantClient.deleteCollection(collectionName);
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: dimension,
        distance: 'Cosine',
      },
    });

    logger.info('Qdrant collection reset successfully');

    return {
      success: true,
      message: 'Qdrant collection reset successfully',
    };
  } catch (error) {
    logger.error('Failed to reset Qdrant collection:', error);
    throw new AppError(
      `Failed to reset Qdrant collection: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
