/**
 * Weaviate Vector Database Service
 * Handles document storage, embeddings, and semantic search via Weaviate
 */

import weaviate, { ApiKey } from 'weaviate-ts-client';
import { createEmbedding, createEmbeddingsBatch } from '../../ai/factory.js';
import logger from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES } from '../../config/errorCodes.js';
import { COLLECTION_NAMES, EMBEDDING_DIMENSIONS, VECTOR_PROVIDERS as PROVIDERS } from '../config.js';

// Module-level state
let weaviateClient = null;
const className = COLLECTION_NAMES[PROVIDERS.WEAVIATE];
const dimension = EMBEDDING_DIMENSIONS[PROVIDERS.WEAVIATE];

/**
 * Initialize Weaviate client and ensure schema exists
 */
export const initialize = async () => {
  try {
    if (weaviateClient) {
      logger.info('Weaviate already initialized');
      return;
    }

    const host = process.env.WEAVIATE_HOST || 'localhost';
    const port = process.env.WEAVIATE_PORT || 8080;
    const scheme = process.env.WEAVIATE_SCHEME || 'http';

    logger.info(`Initializing Weaviate client at ${scheme}://${host}:${port}...`);

    const clientConfig = {
      scheme,
      host: `${host}:${port}`,
    };

    if (process.env.WEAVIATE_API_KEY) {
      clientConfig.apiKey = new ApiKey(process.env.WEAVIATE_API_KEY);
    }

    weaviateClient = weaviate.client(clientConfig);

    // Check if class exists, create if not
    const schema = await weaviateClient.schema.getter().do();
    const classExists = schema.classes?.some((c) => c.class === className);

    if (!classExists) {
      logger.info(`Creating Weaviate class: ${className} (dimension: ${dimension})`);

      const classObj = {
        class: className,
        description: 'Document embeddings for RAG',
        properties: [
          {
            name: 'text',
            dataType: ['text'],
            description: 'Document text content',
          },
          {
            name: 'name',
            dataType: ['string'],
            description: 'File name without extension',
          },
          {
            name: 'mimeType',
            dataType: ['string'],
            description: 'MIME type of the original file',
          },
          {
            name: 'folderPath',
            dataType: ['string'],
            description: 'Folder path in Google Drive',
          },
          {
            name: 'modifiedTime',
            dataType: ['string'],
            description: 'Last modified time',
          },
          {
            name: 'extension',
            dataType: ['string'],
            description: 'File extension',
          },
          {
            name: 'googleLink',
            dataType: ['string'],
            description: 'Google Drive link',
          },
        ],
        vectorizer: 'none', // We provide our own vectors from Gemini
      };

      await weaviateClient.schema.classCreator().withClass(classObj).do();
      logger.info(`Created Weaviate class: ${className}`);
    } else {
      logger.info(`Connected to existing Weaviate class: ${className}`);
    }

    logger.info('Weaviate initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Weaviate:', error);
    throw new AppError(
      `Weaviate initialization failed: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Add documents to Weaviate
 * @param {Array} documents - Array of document objects {id, text, metadata}
 */
export const addMany = async (documents) => {
  try {
    await initialize();

    logger.info(`Adding ${documents.length} documents to Weaviate`);

    // Create embeddings using batch embedding (more efficient)
    const texts = documents.map((doc) => doc.text);
    const embeddings = await createEmbeddingsBatch(texts);

    // Add in batches of 100
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batchDocs = documents.slice(i, i + batchSize);
      const batchEmbs = embeddings.slice(i, i + batchSize);

      const batcher = weaviateClient.batch.objectsBatcher();
      const objects = batchDocs.map((doc, idx) => ({
        id: doc.id,
        class: className,
        vector: batchEmbs[idx],
        properties: {
          text: doc.text,
          ...(doc.metadata || {}),
        },
      }));

      objects.forEach((obj) => batcher.withObject(obj));
      await batcher.do();
    }

    logger.info(`Successfully added ${documents.length} documents to Weaviate`);

    return {
      success: true,
      count: documents.length,
      ids: documents.map((d) => d.id),
    };
  } catch (error) {
    logger.error('Failed to add documents to Weaviate:', error);
    throw new AppError(
      `Failed to add documents to Weaviate: ${error.message}`,
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
    if (!weaviateClient) {
      await initialize();
    }

    // Create embedding for query (with RETRIEVAL_QUERY task type)
    const queryEmbedding = await createEmbedding(query, { taskType: 'RETRIEVAL_QUERY' });

    // Build the query
    const nearVector = {
      vector: queryEmbedding,
      certainty: maxDistance !== null ? 1 - maxDistance : undefined,
    };

    // Build where filter if provided
    let whereFilter = null;
    if (where && Object.keys(where).length > 0) {
      const operands = Object.entries(where).map(([key, value]) => ({
        path: [key],
        operator: 'Equal',
        valueString: String(value),
      }));

      if (operands.length > 0) {
        whereFilter = {
          operator: 'And',
          operands,
        };
      }
    }

    // Get more results if keyword filtering
    const limit = keyword ? nResults * 3 : nResults;

    let queryBuilder = weaviateClient.graphql
      .get()
      .withClassName(className)
      .withNearVector(nearVector)
      .withLimit(limit)
      .withFields('_additional { certainty }');

    if (whereFilter) {
      queryBuilder = queryBuilder.withWhere(whereFilter);
    }

    const result = await queryBuilder.do();

    const objects = result.data?.Get?.[className] || [];

    logger.info(`Found ${objects.length} results from Weaviate`);

    // Format results
    let formattedResults = objects.map((obj) => ({
      id: obj._additional?.id || '',
      text: obj.text || '',
      metadata: {
        name: obj.name || '',
        mimeType: obj.mimeType || '',
        folderPath: obj.folderPath || '',
        modifiedTime: obj.modifiedTime || '',
        extension: obj.extension || '',
        googleLink: obj.googleLink || '',
      },
      distance: obj._additional?.certainty !== undefined
        ? 1 - obj._additional.certainty
        : 0,
      path: `${process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME || ''}/${
        obj.folderPath
          ? `${obj.folderPath}/${obj.name}`
          : obj.name || ''
      }${obj.extension || ''}`,
      googleLink:
        obj.googleLink ||
        `https://drive.google.com/file/d/${obj._additional?.id}`,
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
    logger.error('Weaviate search failed:', error);
    throw new AppError(
      `Weaviate search failed: ${error.message}`,
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
    if (!weaviateClient) {
      await initialize();
    }

    // Delete each document by ID
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await weaviateClient.data
        .deleter()
        .withClassName(className)
        .withId(id)
        .do();
    }

    logger.info(`Successfully deleted ${ids.length} documents from Weaviate`);

    return {
      success: true,
      count: ids.length,
    };
  } catch (error) {
    logger.error('Failed to delete documents from Weaviate:', error);
    throw new AppError(
      `Failed to delete documents from Weaviate: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get all documents from Weaviate using aggregation
 */
export const getAll = async () => {
  try {
    if (!weaviateClient) {
      await initialize();
    }

    // Use Get query to fetch all (limited - Weaviate returns max 100 by default)
    // For larger datasets, use cursor-based pagination
    const result = await weaviateClient.graphql
      .get()
      .withClassName(className)
      .withLimit(100)
      .withFields('_additional { id } text name mimeType folderPath modifiedTime extension googleLink')
      .do();

    const objects = result.data?.Get?.[className] || [];

    return {
      count: objects.length,
      documents: objects.map((obj) => ({
        id: obj._additional?.id || '',
        text: obj.text || '',
        metadata: {
          name: obj.name || '',
          mimeType: obj.mimeType || '',
          folderPath: obj.folderPath || '',
          modifiedTime: obj.modifiedTime || '',
          extension: obj.extension || '',
          googleLink: obj.googleLink || '',
        },
      })),
    };
  } catch (error) {
    logger.error('Failed to get documents from Weaviate:', error);
    throw new AppError(
      `Failed to get documents from Weaviate: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Get class stats
 */
export const getStats = async () => {
  try {
    if (!weaviateClient) {
      await initialize();
    }

    // Get aggregate stats
    const aggResult = await weaviateClient.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();

    const count = aggResult.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

    return {
      className,
      documentCount: count,
      dimension,
    };
  } catch (error) {
    logger.error('Failed to get Weaviate stats:', error);
    throw new AppError(
      `Failed to get Weaviate stats: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};

/**
 * Reset class (delete all objects)
 */
export const reset = async () => {
  try {
    if (!weaviateClient) {
      await initialize();
    }

    logger.info('Resetting Weaviate class...');

    // Delete class and recreate
    await weaviateClient.schema.classDeleter().withClassName(className).do();

    const classObj = {
      class: className,
      description: 'Document embeddings for RAG',
      properties: [
        { name: 'text', dataType: ['text'], description: 'Document text content' },
        { name: 'name', dataType: ['string'], description: 'File name without extension' },
        { name: 'mimeType', dataType: ['string'], description: 'MIME type' },
        { name: 'folderPath', dataType: ['string'], description: 'Folder path' },
        { name: 'modifiedTime', dataType: ['string'], description: 'Last modified time' },
        { name: 'extension', dataType: ['string'], description: 'File extension' },
        { name: 'googleLink', dataType: ['string'], description: 'Google Drive link' },
      ],
      vectorizer: 'none',
    };

    await weaviateClient.schema.classCreator().withClass(classObj).do();

    logger.info('Weaviate class reset successfully');

    return {
      success: true,
      message: 'Weaviate class reset successfully',
    };
  } catch (error) {
    logger.error('Failed to reset Weaviate class:', error);
    throw new AppError(
      `Failed to reset Weaviate class: ${error.message}`,
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }
};
