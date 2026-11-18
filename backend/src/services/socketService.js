const { Server } = require('socket.io');
const cookie = require('cookie');
const config = require('../config');
const { verifyAccessToken, verifyRefreshToken } = require('../utils/jwtToken');
const User = require('../models/User');

// Rooms
// -----
// `admins`        — every authenticated admin socket. Administrative events
//                   (new orders, contact messages, user sign-ups) go here only.
// `user:<id>`     — every socket belonging to one authenticated account. Private
//                   data (own orders, cart, wishlist, profile) is emitted only to
//                   this room, so one customer can never observe another's data.
// Public catalog events (product/category changes) are broadcast to every
// connected socket with io.emit — that data is public on the storefront anyway.
const ADMINS_ROOM = 'admins';
const USER_ROOM_PREFIX = 'user:';

const userRoom = (userId) => `${USER_ROOM_PREFIX}${String(userId)}`;

let io = null;

// Decode the httpOnly auth cookie attached to the Socket.IO handshake. The
// access cookie is preferred; the refresh cookie is accepted as a fallback so a
// user whose access token has expired (but whose session is still valid) keeps
// receiving live events. A Bearer-style handshake `auth` payload is also
// accepted for non-browser clients.
const getUserIdFromHandshake = (socket) => {
  const header = socket.request && socket.request.headers && socket.request.headers.cookie;
  const cookies = header ? cookie.parse(header) : {};
  const handshakeAuth = (socket.handshake && socket.handshake.auth) || {};

  const candidates = [
    cookies.token,
    handshakeAuth.token,
    cookies.refreshToken,
    handshakeAuth.refreshToken,
  ].filter(Boolean);

  for (const token of candidates) {
    try {
      const decoded = verifyAccessToken(token);
      if (decoded && decoded.id) return String(decoded.id);
    } catch (_error) {
      try {
        const decoded = verifyRefreshToken(token);
        if (decoded && decoded.id && decoded.type === 'refresh') return String(decoded.id);
      } catch (_ignored) {
        // Try the next candidate.
      }
    }
  }
  return null;
};

const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: config.allowedOrigins,
      credentials: true,
    },
  });

  // Handshake authentication. Guests are allowed to connect (they only receive
  // public catalog broadcasts); an invalid or stale token simply degrades the
  // connection to guest level instead of joining any room. Only active accounts
  // join their private user room, and only admins join the admins room.
  io.use(async (socket, next) => {
    try {
      const userId = getUserIdFromHandshake(socket);
      if (!userId) return next();

      const user = await User.findById(userId);
      if (!user || !user.isActive) return next();

      socket.join(userRoom(user._id));
      socket.data.userId = String(user._id);
      if (user.role === 'admin') socket.join(ADMINS_ROOM);
      return next();
    } catch (_error) {
      // Never block a connection because of auth trouble — a guest connection
      // cannot subscribe to any privileged room.
      return next();
    }
  });

  io.on('connection', () => {
    // Rooms are joined in the middleware above; pages attach and detach their
    // own listeners in React effects.
  });

  return io;
};

// Emit an administrative event. Called AFTER the database write succeeds, so a
// broadcast can never announce data that was not persisted. Safe no-op when
// Socket.IO has not been initialised (jest imports the bare Express app).
const emitToAdmins = (event, payload) => {
  if (!io) return;
  io.to(ADMINS_ROOM).emit(event, payload);
};

// Emit to every connected socket for one account (all their open tabs/devices).
// Used for private data: cart, wishlist, the customer's own orders, profile.
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit(event, payload);
};

// Broadcast public catalog data (products, categories) to everyone — guests and
// signed-in users alike see the same storefront.
const emitToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

module.exports = {
  initSocketIO,
  emitToAdmins,
  emitToUser,
  emitToAll,
  userRoom,
  ADMINS_ROOM,
};
