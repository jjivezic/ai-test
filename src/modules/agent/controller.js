import { executeTask } from '../../ai/service.js';
import logger from '../../config/logger.js';
import { catchAsync } from '../../middleware/errorHandler.js';

export const agentExecuteTask = catchAsync(async (req, res) => {
  console.log('***********Agent task requested:', req.body);
  const { prompt, maxIterations = 5 } = req.body;
  logger.info('Agent task requested', {
    prompt,
    maxIterations
  });

  const result = await executeTask(prompt, maxIterations);
  console.log('***********Agent task completed:', result);
  logger.info('Agent task completed', {
    success: result.success,
    // toolCallsCount: result.toolCalls.length,
    iterations: result.iterations
  });

  res.json({
    success: true,
    data: result,
    message: 'Agent task completed'
  });
});
