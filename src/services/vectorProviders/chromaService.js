/**
 * ChromaDB Vector Database Service
 * Handles document storage, embeddings, and semantic search via ChromaDB
 */

import { ChromaClient } from 'chromadb';
import { createEmbedding, createEmbeddingsBatch } from '../geminiService.js';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';
import { COLLECTION_NAMES, VECTOR_PROVIDERS as PROVIDERS } from '../../config/vectorProviders.js';

/**
 * ChromaDB Vector Database Service
 * Handles document storage, embeddings, and semantic search
 */

// Module-level state
let client = null;
let collection = null;
const collectionName = COLLECTION_NAMES[PROVIDERS.CHROMA];

/**
 * Initialize ChromaDB client and collection
 */
export const initialize = async () => {
  try {
    if (client && collection) {
      logger.info('ChromaDB already initialized');
      return;
    }

    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';

    logger.info('Initializing ChromaDB client...');
    client = new ChromaClient({
      path: chromaUrl,
    });

    // Try to get existing collection or create new one
    try {
      collection = await client.getCollection({
        name: collectionName,
        embeddingFunction: undefined, // We provide embeddings manually via Gemini
      });
      logger.info(`Connected to existing collection: ${collectionName}`);
    } catch (error) {
      logger.warn('Collection not found, trying to create:', error.message);
      try {
        collection = await client.createCollection({
          name: collectionName,
          metadata: { description: 'Document embeddings for RAG' },
          embeddingFunction: undefined, // We provide embeddings manually via Gemini
        });
        logger.info(`Created new collection: ${collectionName}`);
      } catch (createError) {
        // If resource already exists, get the collection
        if (createError.message && createError.message.includes('already exists')) {
          logger.warn('Collection already exists, fetching existing collection.');
          collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: undefined, // We provide embeddings manually via Gemini
          });
          logger.info(`Connected to existing collection: ${collectionName}`);
        } else {
          throw createError;
        }
      }
    }

    logger.info('ChromaDB initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize ChromaDB:', error);
    logger.error('Make sure ChromaDB server is running: chroma run --path ./chroma_data');
    throw new AppError(
      `ChromaDB initialization failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Add documents to the vector database
 * @param {Array} documents - Array of document objects {id, text, metadata}
 */
export const addMany = async (documents) => {
  try {
    // Ensure ChromaDB is initialized
    await initialize();

    logger.info(`Adding ${documents.length} documents to ChromaDB`);

    // Create embeddings for all documents using batch embedding (more efficient)
    const texts = documents.map((doc) => doc.text);
    const embeddings = await createEmbeddingsBatch(texts);

    // Prepare data for ChromaDB
    const ids = documents.map((doc) => doc.id);
    const metadatas = documents.map((doc) => doc.metadata || {});

    // Add to ChromaDB
    await collection.add({
      ids,
      documents: texts,
      embeddings,
      metadatas,
    });

    logger.info(`Successfully added ${documents.length} documents to ChromaDB`);

    return {
      success: true,
      count: documents.length,
      ids,
    };
  } catch (error) {
    logger.error('Failed to add documents to ChromaDB:', error);
    throw new AppError(
      `Failed to add documents to ChromaDB: ${error.message}`,
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
 * @param {Object} where - Optional metadata filter (e.g., {name: "document.pdf"})
 */
export const search = async (
  query,
  nResults = 5,
  keyword = null,
  maxDistance = 1,
  where = null
) => {
  try {
    if (!collection) {
      await initialize();
    }

    // Create embedding for query using Gemini (with RETRIEVAL_QUERY task type)
    const queryEmbedding = await createEmbedding(query, { taskType: 'RETRIEVAL_QUERY' });

    // Build query options
    const queryOptions = {
      queryEmbeddings: [queryEmbedding],
      nResults: keyword ? nResults * 3 : nResults, // Get more results if filtering by keyword
    };

    // Add metadata filter if provided
    if (where) {
      queryOptions.where = where;
      logger.info('Using metadata filter:', where);
    }

    // Search in ChromaDB
    const results = await collection.query(queryOptions);

    logger.info(`Found ${results.ids[0].length} results from ChromaDB`);

    // Format results
    let formattedResults = results.ids[0].map((id, index) => {
      const metadata = results.metadatas[0][index];

      return {
        id,
        text: results.documents[0][index],
        metadata,
        distance: results.distances[0][index],
        path: `${process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME || ''}/${
          metadata.folderPath
            ? `${metadata.folderPath}/${metadata.name}`
            : metadata.name
        }${metadata.extension || ''}`,
        googleLink:
          metadata.googleLink ||
          `https://drive.google.com/file/d/${id}`, // Use stored link or fallback
      };
    });

    // Filter by keyword if provided (case-insensitive)
    if (keyword) {
      const keywordLower = keyword.toLowerCase();

      // Filter and count keyword occurrences
      formattedResults = formattedResults
        .filter((doc) => doc.text.toLowerCase().includes(keywordLower))
        .map((doc) => {
          // Count how many times keyword appears
          const text = doc.text.toLowerCase();
          const count = (text.match(new RegExp(keywordLower, 'g')) || []).length;
          return { ...doc, keywordCount: count };
        })
        // Sort by keyword count (descending), then by distance (ascending)
        .sort((a, b) => {
          if (b.keywordCount !== a.keywordCount) {
            return b.keywordCount - a.keywordCount; // More keywords = better
          }
          return a.distance - b.distance; // Lower distance = better
        });

      logger.info(
        `After keyword filter "${keyword}": ${formattedResults.length} results (sorted by relevance)`
      );
    }

    // Filter by distance threshold if provided
    if (maxDistance !== null && maxDistance !== undefined) {
      formattedResults = formattedResults.filter((doc) => doc.distance <= maxDistance);
      logger.info(`After distance filter (<= ${maxDistance}): ${formattedResults.length} results`);
    }

    // Limit to requested number
    formattedResults = formattedResults.slice(0, nResults);

    return formattedResults;
  } catch (error) {
    logger.error('ChromaDB search failed:', error);
    throw new AppError(
      `ChromaDB search failed: ${error.message}`,
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
    // Ensure ChromaDB is initialized
    if (!collection) {
      await initialize();
    }

    await collection.delete({
      ids,
    });

    logger.info(`Successfully deleted ${ids.length} documents from ChromaDB`);

    return {
      success: true,
      count: ids.length,
    };
  } catch (error) {
    logger.error('Failed to delete documents from ChromaDB:', error);
    throw new AppError(
      `Failed to delete documents from ChromaDB: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get all documents in the collection
 */
export const getAll = async () => {
  try {
    // Ensure ChromaDB is initialized
    await initialize();

    logger.info('Getting all documents from ChromaDB');

    const results = await collection.get();

    logger.info(`Retrieved ${results.ids.length} documents from ChromaDB`);

    return {
      count: results.ids.length,
      documents: results.ids.map((id, index) => ({
        id,
        text: results.documents[index],
        metadata: results.metadatas[index],
      })),
    };
  } catch (error) {
    logger.error('Failed to get documents from ChromaDB:', error);
    throw new AppError(
      `Failed to get documents from ChromaDB: ${error.message}`,
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
    await initialize();

    const count = await collection.count();

    return {
      collectionName,
      documentCount: count,
    };
  } catch (error) {
    logger.error('Failed to get ChromaDB stats:', error);
    throw new AppError(
      `Failed to get ChromaDB stats: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Reset collection (delete all documents)
 */
export const reset = async () => {
  try {
    // Ensure ChromaDB is initialized
    if (!collection) {
      await initialize();
    }

    logger.info('Resetting ChromaDB collection...');

    // Delete old collection
    try {
      await client.deleteCollection({ name: collectionName });
    } catch (e) {
      logger.warn('Could not delete collection (may not exist):', e.message);
    }

    // Create fresh collection
    collection = await client.createCollection({
      name: collectionName,
      metadata: { description: 'Document embeddings for RAG' },
      embeddingFunction: undefined,
    });

    logger.info('ChromaDB collection reset successfully');

    return {
      success: true,
      message: 'ChromaDB collection reset successfully',
    };
  } catch (error) {
    logger.error('Failed to reset ChromaDB collection:', error);
    throw new AppError(
      `Failed to reset ChromaDB collection: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
