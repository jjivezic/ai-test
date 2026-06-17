import { findAll, findAndCountAll,findByPk, updateOne, deleteOne } from './manager.js';
import { catchAsync } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

export const getAllUsersPaginated = catchAsync(async (req, res) => {
  const { items, total } = await findAll(req.filters || {}, req.sort || {}, req.pagination || {});
  res.status(200).json({
    success: true,
    data: items,
    total
  });
});

export const getAllUsers = catchAsync(async (req, res) => {
  const users = await findAndCountAll(req.filters || {}, req.sort || {});

  res.status(200).json({
    success: true,
    data: users
  });
});

export const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = await findByPk(id);

  res.status(200).json({
    success: true,
    data: user
  });
});

export const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = await updateOne(id, req.body);
  logger.info(`User updated: ${id}`);

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: user
  });
});

export const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  await deleteOne(id);
  logger.info(`User deleted: ${id}`);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});
