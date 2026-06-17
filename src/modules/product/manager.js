import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { Product } = db;

export const findAll = async (filters = {}, sort = {}) => {
  const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

  const items = await Product.findAll({
    where: filters,
    order
  });
  
  return items;
};

export const findAndCountAll = async (filters = {}, sort = {}, pagination = {}) => {
  const { limit, offset } = pagination;
  const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

  const { count, rows } = await Product.findAndCountAll({
    where: filters,
    order,
    limit,
    offset
  });

  return {
    items: rows,
    total: count
  };
};

export const findByPk = async (id) => {
  const item = await Product.findByPk(id);

  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  return item;
};

export const createOne = async (data) => {
  const item = await Product.create(data);
  return item;
};

export const updateOne = async (id, data) => {
  const item = await Product.findByPk(id);
  
  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  await item.update(data);
  return findByPk(id);
};

export const deleteOne = async (id) => {
  const item = await Product.findByPk(id);

  if (!item) {
    throw new AppError(COMMON_ERRORS.NOT_FOUND);
  }

  await item.destroy();
  return { success: true };
};
