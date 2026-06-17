import sequelize from '../connection.js';
import User from './User.js';
import Product from './Product.js';

// Define associations here if needed
// Example:
// User.hasMany(Post);
// Post.belongsTo(User);

const db = {
  sequelize,
  User,
  Product
};

export default db;
