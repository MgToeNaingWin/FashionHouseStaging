const catchAsync = require('../src/utils/catchAsync');
const responseHandler = require('../src/utils/responseHandler');
const User = require('../src/models/User');
const AppError = require('../src/utils/errors').AppError;
const ValidationError = require('../src/utils/errors').ValidationError;
const NotFoundError = require('../src/utils/errors').NotFoundError;
const { generateRefreshToken, verifyRefreshToken } = require('../src/utils/jwtToken');
const { emitToAdmins, emitToUser } = require('../src/services/socketService');

// Explicit allow-list of fields safe to broadcast. Never include the password
// hash or any token, even though the model's toJSON already strips the hash.
const toPublicUser = (user) => ({
  _id: user._id,
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  phone: user.phone,
  addresses: user.addresses || [],
  isActive: user.isActive,
  createdAt: user.createdAt,
});

// Persist the JWT as an httpOnly cookie so sessions survive page refreshes.
// `SameSite=Lax` keeps the cookie on same-site requests, `Secure` is enabled in
// production, and the 7-day Max-Age makes it a persistent (not session) cookie so
// it survives closing and reopening the browser while the token is still valid.
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Long-lived refresh cookie (30 days). When the short-lived access cookie
// expires, POST /api/auth/refresh silently exchanges it for a new pair, so the
// visitor stays logged in across browser restarts without ever seeing the
// refresh token in JS-accessible storage.
const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

// Register a new user
const register = catchAsync(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    responseHandler.error(res, 400, 'Username, email, and password are required');
    return;
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    if (existingUser.email === email) {
      responseHandler.error(res, 409, 'Email already registered');
    } else {
      responseHandler.error(res, 409, 'Username already taken');
    }
    return;
  }

  // Create new user
  const newUser = new User({
    username,
    email,
    passwordHash: password, // Password will be hashed by pre-save middleware
  });

  await newUser.save();

  // Admins see the new customer account in their user list without a refresh.
  emitToAdmins('user_updated', { user: toPublicUser(newUser), action: 'created' });

  // Generate JWT token
  const token = newUser.generateAuthToken();
  setTokenCookie(res, token);
  setRefreshCookie(res, generateRefreshToken(newUser));

  responseHandler.success(res, 201, {
    token,
    user: {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    },
  }, 'User registered successfully');
});

// Login user
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    responseHandler.error(res, 400, 'Email and password are required');
    return;
  }

  // Find user by email
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    responseHandler.error(res, 401, 'Invalid email or password');
    return;
  }

  // Check if password is correct (bcrypt comparison against stored hash)
  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    responseHandler.error(res, 401, 'Invalid email or password');
    return;
  }

  // Check if user is active
  if (!user.isActive) {
    responseHandler.error(res, 401, 'Account is disabled');
    return;
  }

  // Generate JWT token
  const token = user.generateAuthToken();
  setTokenCookie(res, token);
  setRefreshCookie(res, generateRefreshToken(user));

  responseHandler.success(res, 200, {
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  }, 'Login successful');
});

// Get current user profile
const getMe = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  responseHandler.success(res, 200, req.user, 'User profile retrieved successfully');
});

// Update user profile
const updateProfile = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  // Only real schema fields are editable here. `username` and `phone` persist;
  // email is the account identity and is intentionally not changed via this route.
  const { username, phone } = req.body;

  if (username !== undefined) {
    const trimmed = String(username).trim().toLowerCase();
    if (trimmed.length < 3) {
      responseHandler.error(res, 400, 'Username must be at least 3 characters');
      return;
    }
    if (trimmed !== req.user.username) {
      const taken = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } });
      if (taken) {
        responseHandler.error(res, 409, 'Username already taken');
        return;
      }
      req.user.username = trimmed;
    }
  }
  if (phone !== undefined) req.user.phone = String(phone).trim();

  await req.user.save();

  // The owner's other tabs/devices update immediately; admins see the change.
  const publicUser = toPublicUser(req.user);
  emitToUser(req.user._id, 'profile_updated', { user: publicUser });
  emitToAdmins('user_updated', { user: publicUser, action: 'updated' });

  responseHandler.success(res, 200, { user: req.user }, 'Profile updated successfully');
});

// Change password
const changePassword = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    responseHandler.error(res, 400, 'Current password and new password are required');
    return;
  }

  // Check if current password is correct (reload with the hidden hash)
  const userWithPassword = await User.findById(req.user._id).select('+passwordHash');
  const currentMatches = await userWithPassword.comparePassword(currentPassword);
  if (!currentMatches) {
    responseHandler.error(res, 401, 'Current password is incorrect');
    return;
  }

  // Update password (pre-save hook re-hashes it)
  userWithPassword.passwordHash = newPassword;
  await userWithPassword.save();

  responseHandler.success(res, 200, {}, 'Password changed successfully');
});

// Manage user addresses
const manageAddresses = catchAsync(async (req, res) => {
  if (!req.user) {
    responseHandler.error(res, 401, 'Not authenticated');
    return;
  }

  const { action, address } = req.body;

  if (action === 'add') {
    // Add new address
    if (!address || !address.street || !address.city) {
      responseHandler.error(res, 400, 'Valid address is required');
      return;
    }

    if (!req.user.addresses) {
      req.user.addresses = [];
    }

    req.user.addresses.push({
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      isDefault: address.isDefault || false,
    });
  } else if (action === 'get') {
    // Return addresses
    responseHandler.success(res, 200, { addresses: req.user.addresses || [] }, 'Addresses retrieved successfully');
    return;
  } else if (action === 'delete') {
    const { addressId } = req.body;

    if (!addressId) {
      responseHandler.error(res, 400, 'Address ID is required');
      return;
    }

    if (req.user.addresses) {
      req.user.addresses = req.user.addresses.filter(
        (addr) => addr._id.toString() !== addressId
      );
    }
  }

  await req.user.save({ validateBeforeSave: false });

  // Address lists are part of the profile — same live sync as updateProfile.
  const publicUser = toPublicUser(req.user);
  emitToUser(req.user._id, 'profile_updated', { user: publicUser });
  emitToAdmins('user_updated', { user: publicUser, action: 'updated' });

  responseHandler.success(res, 200, { action }, 'Address management completed');
});

// Logout - clear the session cookie
const logout = catchAsync(async (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
  res.clearCookie('token', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  responseHandler.success(res, 200, {}, 'Logged out successfully');
});

// Refresh - exchange a valid refresh cookie for a new access + refresh pair.
// Called by the frontend when an API call comes back 401 (expired access token)
// so the session is silently renewed instead of forcing a new login. The refresh
// token is rotated on every use and never leaves the httpOnly cookie.
const refresh = catchAsync(async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;

  if (!token) {
    responseHandler.error(res, 401, 'No refresh token provided');
    return;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (_error) {
    // Invalid or expired refresh token: the session cannot be renewed.
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    responseHandler.error(res, 401, 'Refresh token is invalid or expired');
    return;
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    responseHandler.error(res, 401, 'Not authorized, user no longer exists');
    return;
  }

  const accessToken = user.generateAuthToken();
  setTokenCookie(res, accessToken);
  setRefreshCookie(res, generateRefreshToken(user)); // rotation

  responseHandler.success(res, 200, {
    token: accessToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  }, 'Token refreshed');
});

module.exports = {
  register,
  login,
  logout,
  refresh,
  getMe,
  updateProfile,
  changePassword,
  manageAddresses,
};