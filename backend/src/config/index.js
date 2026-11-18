require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fashion_house',
  // Origins allowed to talk to the API and to open a Socket.IO connection
  // (shared by the Express CORS config in app.js and socketService.js).
  allowedOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
  ].filter(Boolean),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  jwt: {
    secret: process.env.JWT_SECRET_KEY || 'fashion-house-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRE || '7d',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      process.env.JWT_SECRET_KEY ||
      'fashion-house-dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  },
};

module.exports = config;