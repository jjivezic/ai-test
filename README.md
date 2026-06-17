# Hyper Server

Node.js REST API server with JWT authentication and MySQL database.

## Features

- 🔐 JWT Token Authentication with Refresh Tokens
- 🗄️ MySQL Database Integration with Sequelize ORM
- 🛣️ RESTful API Routes
- 🎯 Modular Architecture (Feature-based modules)
- 🔒 Authentication Middleware
- ✅ Input Validation with Error Codes
- 📝 Winston Logging (File + Console)
- 📊 Morgan HTTP Request Logging
- 🔄 Auto-generate Models, Migrations & Modules
- 📚 Swagger API Documentation
- 🎨 Centralized Error Handling

## Project Structure

```
server/
├── database/
│   ├── config.js                # Sequelize configuration
│   ├── connection.js            # Database connection
│   ├── models/
│   │   ├── index.js             # Models index
│   │   └── User.js              # User model
│   ├── migrations/
│   │   └── 20251222000001-create-users-table.js
│   └── seeders/
│       └── 20251222000001-demo-users.js
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── controller.js    # Auth endpoints
│   │   │   ├── manager.js       # Auth business logic
│   │   │   └── routes.js        # Auth routes
│   │   └── users/
│   │       ├── controller.js    # User endpoints
│   │       ├── manager.js       # User business logic
│   │       └── routes.js        # User routes
│   ├── middleware/
│   │   └── authMiddleware.js    # JWT verification
│   ├── routes/
│   │   └── index.js             # Main router
│   └── server.js                # Express app entry point
├── .env.example
├── .sequelizerc                 # Sequelize CLI config
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
4. Update `.env` with your database credentials and JWT secret

5. Run database migrations:
```bash
npm run db:migrate
```

6. (Optional) Seed demo data:
```bash
npm run db:seed
```.env.example .env
```

4. Update `.env` with your database credentials and JWT secret

5. Create database and tables:
```bash
mysql -u root -p < database/schema.sql
```

## Usage

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

Server will run on `http://localhost:3000` (or your configured PORT)

## API Documentation

Interactive API documentation is available via Swagger UI:

```
http://localhost:3000/api-docs
```

Features:
- 📖 Complete API reference with examples
- 🔐 Built-in authentication (click "Authorize" to add JWT token)
- 🧪 Test endpoints directly from the browser
- 📝 Request/response schemas
- ✅ Auto-updated when new modules are generated

## API Endpoints

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Verify Token
```
GET /api/auth/verify
Authorization: Bearer <token>
```

#### Refresh Access Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<your_refresh_token>"
}

// Or send in header:
X-Refresh-Token: <your_refresh_token>
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>
```

### Users (Protected Routes)

All user routes require authentication token in header:
```
Authorization: Bearer <your_jwt_token>
```

#### Get All Users
```
GET /api/users
```

#### Get Current User Profile
```
GET /api/users/profile
```

#### Get User by ID
```
GET /api/users/:id
```

#### Update User
```
PUT /api/users/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

#### Delete User
```
DELETE /api/users/:id
```

### Health Check
```
GET /api/health
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - MySQL host
- `DB_USER` - MySQL username
## Technologies

- **Express.js** - Web framework
- **Sequelize** - ORM for MySQL
- **MySQL2** - Database driver
- **JWT** - Token authentication (access + refresh tokens)
- **Bcrypt** - Password hashing
- **Winston** - Advanced logging system
- **Morgan** - HTTP request logger
- **Swagger** - API documentation (swagger-jsdoc + swagger-ui-express)
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment configuration

## Code Generator

Automatically generate complete modules with a single command:

```bash
# Generate model, migration, controller, manager, and routes
npm run generate:model <ModelName>

# Example:
npm run generate:model Product
```

This creates:
- ✅ Sequelize model with validations
- ✅ Database migration file
- ✅ Manager (business logic)
- ✅ Controller (HTTP handlers)
- ✅ Routes with Swagger docs
- ✅ Auto-updates models/index.js and routes/index.js

Define your schema in `database/schema-definition.js` before generating.

## Error Handling

Centralized error handling with error codes:

```javascript
import { AppError, COMMON_ERRORS } from './middleware/errorHandler.js';

// Use common errors
throw new AppError(COMMON_ERRORS.NOT_FOUND);
throw new AppError(COMMON_ERRORS.UNAUTHORIZED);
throw new AppError(COMMON_ERRORS.BAD_REQUEST);

// Or custom errors
throw new AppError('Custom message', 400, true, 'CUSTOM_CODE');
```

Frontend receives:
```json
{
  "success": false,
  "status": "fail",
  "message": "Resource not found",
  "code": "NOT_FOUND"
}
```

## Logging

Logs are written to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs
- Console - Development output

## Database Commands

### Migrations
```bash
# Run all pending migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Create new migration
npx sequelize-cli migration:generate --name migration-name
```

### Seeders
```bash
# Run all seeders
npm run db:seed

# Undo all seeders
npm run db:seed:undo

# Create new seeder
npx sequelize-cli seed:generate --name seeder-name
```

### Reset Database
```bash
# Undo migrations, re-run them, and seed
npm run db:reset
```
- **MySQL2** - Database driver
- **JWT** - Token authentication
- **Bcrypt** - Password hashing
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment configuration
