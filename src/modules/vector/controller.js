import {
  addMany,
  search,
  getStats,
  deleteMany,
  reset,
  getAll,
  getActiveProviderName,
} from '../../services/vectorService.js';
import { VECTOR_PROVIDERS } from '../../config/vectorProviders.js';
import logger from '../../config/logger.js';
import { catchAsync } from '../../middleware/errorHandler.js';

/**
 * Helper to include active provider info in responses
 */
const withProvider = (data = {}) => ({
  ...data,
  provider: getActiveProviderName(),
});

export const addVectorDocuments = catchAsync(async (req, res) => {
  const { documents } = req.body;

  logger.info('Adding documents to vector DB', {
    count: documents.length,
    provider: getActiveProviderName(),
  });

  const result = await addMany(documents);

  logger.info('Documents added successfully to vector DB');

  res.json({
    success: true,
    data: withProvider(result),
    message: 'Documents added successfully',
  });
});

export const searchVectorDocuments = catchAsync(async (req, res) => {
  const { query, nResults = 5, keyword, maxDistance } = req.body;
  
  logger.info('Searching vector DB', {
    query,
    nResults,
    keyword,
    maxDistance,
    provider: getActiveProviderName(),
  });

  const results = await search(query, nResults, keyword, maxDistance);

  logger.info('Search completed', {
    resultsFound: results.length,
  });

  res.json({
    success: true,
    data: withProvider({
      query,
      keyword,
      maxDistance,
      results,
      count: results.length,
    }),
    message: 'Search completed successfully',
  });
});

export const getDocumentStats = catchAsync(async (req, res) => {
  logger.info('Getting vector DB stats');

  const stats = await getStats();

  res.json({
    success: true,
    data: withProvider(stats),
    message: 'Stats retrieved successfully',
  });
});

export const deleteVectorDocuments = catchAsync(async (req, res) => {
  const { ids } = req.body;

  logger.info('Deleting documents from vector DB', {
    count: ids.length,
  });

  const result = await deleteMany(ids);

  res.json({
    success: true,
    data: withProvider(result),
    message: 'Documents deleted successfully',
  });
});

export const resetVectorDocuments = catchAsync(async (req, res) => {
  logger.info('Resetting vector DB');

  const result = await reset();

  res.json({
    success: true,
    data: withProvider(result),
    message: 'Vector database reset successfully',
  });
});

export const getAllVectorDocuments = catchAsync(async (req, res) => {
  logger.info('Getting all documents from vector DB');

  const result = await getAll();

  res.json({
    success: true,
    data: withProvider(result),
    message: 'Documents retrieved successfully',
  });
});

/**
 * Get the active vector database provider info
 */
export const getProviderInfo = catchAsync(async (req, res) => {
  logger.info('Getting vector DB provider info');

  const providerName = getActiveProviderName();
  const stats = await getStats();

  res.json({
    success: true,
    data: {
      provider: providerName,
      availableProviders: Object.values(VECTOR_PROVIDERS),
      stats,
    },
    message: 'Provider info retrieved successfully',
  });
});
