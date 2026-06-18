/**
 * Pinecone Vector Database Service
 * Handles document storage, embeddings, and semantic search via Pinecone
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding, createEmbeddingsBatch } from '../geminiService.js';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';
import { COLLECTION_NAMES, EMBEDDING_DIMENSIONS, VECTOR_PROVIDERS as PROVIDERS } from '../../config/vectorProviders.js';

// Module-level state
let pineconeClient = null;
let index = null;
const indexName = COLLECTION_NAMES[PROVIDERS.PINECONE];
const dimension = EMBEDDING_DIMENSIONS[PROVIDERS.PINECONE];

/**
 * Initialize Pinecone client and index
 */
export const initialize = async () => {
  try {
    if (pineconeClient && index) {
      logger.info('Pinecone already initialized');
      return;
    }

    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'PINECONE_API_KEY environment variable is required',
        500,
        true,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    logger.info('Initializing Pinecone client...');

    pineconeClient = new Pinecone({
      apiKey,
    });

    // Check if index exists, create if not
    const existingIndexes = await pineconeClient.listIndexes();
    const indexExists = existingIndexes.indexes?.some((idx) => idx.name === indexName);

    if (!indexExists) {
      logger.info(`Creating Pinecone index: ${indexName} (dimension: ${dimension})`);
      await pineconeClient.createIndex({
        name: indexName,
        dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
          },
        },
      });
      logger.info(`Created Pinecone index: ${indexName}`);
    } else {
      logger.info(`Connected to existing Pinecone index: ${indexName}`);
    }

    index = pineconeClient.index(indexName);
    logger.info('Pinecone initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Pinecone:', error);
    throw new AppError(
      `Pinecone initialization failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Add documents to Pinecone
 * @param {Array} documents - Array of document objects {id, text, metadata}
 */
export const addMany = async (documents) => {
  try {
    await initialize();

    logger.info(`Adding ${documents.length} documents to Pinecone`);

    // Create embeddings using batch embedding (more efficient)
    const texts = documents.map((doc) => doc.text);
    const embeddings = await createEmbeddingsBatch(texts);

    // Prepare vectors for Pinecone
    const vectors = documents.map((doc, i) => ({
      id: doc.id,
      values: embeddings[i],
      metadata: {
        text: doc.text,
        ...(doc.metadata || {}),
      },
    }));

    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }

    logger.info(`Successfully added ${documents.length} documents to Pinecone`);

    return {
      success: true,
      count: documents.length,
      ids: documents.map((d) => d.id),
    };
  } catch (error) {
    logger.error('Failed to add documents to Pinecone:', error);
    throw new AppError(
      `Failed to add documents to Pinecone: ${error.message}`,
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
 * @param {string} keyword - Optional keyword to filter results (exact text match)
 * @param {number} maxDistance - Optional max distance threshold (lower = more similar)
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
    if (!index) {
      await initialize();
    }

    // Create embedding for query (with RETRIEVAL_QUERY task type)
    const queryEmbedding = await createEmbedding(query, { taskType: 'RETRIEVAL_QUERY' });

    // Build filter if provided
    const filter = where || {};

    // Query Pinecone
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: keyword ? nResults * 3 : nResults,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    logger.info(`Found ${queryResponse.matches?.length || 0} results from Pinecone`);

    // Format results
    let formattedResults = (queryResponse.matches || []).map((match) => ({
      id: match.id,
      text: match.metadata?.text || '',
      metadata: { ...match.metadata },
      distance: match.score,
      path: `${process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME || ''}/${
        match.metadata?.folderPath
          ? `${match.metadata.folderPath}/${match.metadata.name}`
          : match.metadata?.name || ''
      }${match.metadata?.extension || ''}`,
      googleLink:
        match.metadata?.googleLink ||
        `https://drive.google.com/file/d/${match.id}`,
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
    logger.error('Pinecone search failed:', error);
    throw new AppError(
      `Pinecone search failed: ${error.message}`,
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
    if (!index) {
      await initialize();
    }

    await index.deleteMany(ids);

    logger.info(`Successfully deleted ${ids.length} documents from Pinecone`);

    return {
      success: true,
      count: ids.length,
    };
  } catch (error) {
    logger.error('Failed to delete documents from Pinecone:', error);
    throw new AppError(
      `Failed to delete documents from Pinecone: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get all document IDs (Pinecone doesn't support listing all easily, so this is limited)
 */
export const getAll = async () => {
  try {
    await initialize();

    const stats = await index.describeIndexStats();

    return {
      count: stats.totalRecordCount || 0,
      documents: [], // Pinecone doesn't support listing all vectors natively
    };
  } catch (error) {
    logger.error('Failed to get Pinecone stats:', error);
    throw new AppError(
      `Failed to get Pinecone stats: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get index stats
 */
export const getStats = async () => {
  try {
    await initialize();

    const stats = await index.describeIndexStats();

    return {
      indexName,
      documentCount: stats.totalRecordCount || 0,
      dimension,
      namespaces: stats.namespaces || {},
    };
  } catch (error) {
    logger.error('Failed to get Pinecone stats:', error);
    throw new AppError(
      `Failed to get Pinecone stats: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Reset index (delete all vectors)
 */
export const reset = async () => {
  try {
    if (!index) {
      await initialize();
    }

    logger.info('Resetting Pinecone index...');

    // Delete all vectors
    await index.deleteAll();

    logger.info('Pinecone index reset successfully');

    return {
      success: true,
      message: 'Pinecone index reset successfully',
    };
  } catch (error) {
    logger.error('Failed to reset Pinecone index:', error);
    throw new AppError(
      `Failed to reset Pinecone index: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
