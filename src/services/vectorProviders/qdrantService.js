/**
 * Qdrant Vector Database Service
 * Handles document storage, embeddings, and semantic search via Qdrant
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { createEmbedding } from '../geminiService.js';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';
import { COLLECTION_NAMES, EMBEDDING_DIMENSIONS, VECTOR_PROVIDERS as PROVIDERS } from '../../config/vectorProviders.js';

// Module-level state
let qdrantClient = null;
const collectionName = COLLECTION_NAMES[PROVIDERS.QDRANT];
const dimension = EMBEDDING_DIMENSIONS[PROVIDERS.QDRANT];

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

    // Create embeddings for all documents
    const embeddings = await Promise.all(
      documents.map((doc) => createEmbedding(doc.text))
    );

    // Prepare points for Qdrant
    const points = documents.map((doc, i) => ({
      id: doc.id,
      vector: embeddings[i],
      payload: {
        text: doc.text,
        ...(doc.metadata || {}),
      },
    }));

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await qdrantClient.upsert(collectionName, {
        wait: true,
        points: batch,
      });
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

    // Create embedding for query
    const queryEmbedding = await createEmbedding(query);

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
      id: hit.id,
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
 * @param {Array} ids - Array of document IDs to delete
 */
export const deleteMany = async (ids) => {
  try {
    if (!qdrantClient) {
      await initialize();
    }

    await qdrantClient.delete(collectionName, {
      wait: true,
      points: ids,
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
        id: point.id,
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
