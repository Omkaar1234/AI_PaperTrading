const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/userModel');
const Watchlist = require('../models/watchlistModel');

const AUTH_COOKIE_NAME = 'ptx_session';
const GOOGLE_SETUP_COOKIE_NAME = 'ptx_google_setup';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const GOOGLE_SETUP_EXPIRES_IN = '15m';
const BALANCE_MIN = 100000;
const BALANCE_MAX = 1000000;
const BALANCE_STEP = 100000;
const PASSWORD_MIN_LENGTH = 8;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET is not configured');
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

function assertSessionConfigured() {
  getJwtSecret();
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function normalizeName(name = '') {
  return String(name).trim().replace(/\s+/g, ' ');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateAge(age) {
  const parsed = Number(age);
  return Number.isInteger(parsed) && parsed >= 13 && parsed <= 120;
}

function parseAllowedBalance(value) {
  const amount = Number(value);
  if (
    !Number.isInteger(amount) ||
    amount < BALANCE_MIN ||
    amount > BALANCE_MAX ||
    amount % BALANCE_STEP !== 0
  ) {
    return null;
  }
  return amount;
}

function validatePassword(password = '') {
  const value = String(password);
  if (value.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include letters and numbers';
  }
  return null;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.userId,
    name: user.name,
    email: user.email,
    age: user.age,
    authProvider: user.authProvider,
    initialBalance: user.initialBalance,
    currentBalance: user.currentBalance ?? user.wallet?.cashBalance ?? 0,
    balance: user.wallet?.cashBalance ?? user.currentBalance ?? 0,
    currency: user.wallet?.currency || 'INR',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || isProduction,
    sameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax'),
    maxAge: Number(process.env.JWT_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
    path: '/'
  };
}

function setupCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 15 * 60 * 1000
  };
}

function clearCookieOptions() {
  const options = sessionCookieOptions();
  return {
    path: options.path,
    sameSite: options.sameSite,
    secure: options.secure
  };
}

function signSession(user) {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      provider: user.authProvider
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function signGoogleSetup(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: GOOGLE_SETUP_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function ensureAuthStore() {
  if (!User) {
    throw new Error('MongoDB user model is unavailable');
  }
}

async function ensureDefaultWatchlist(userId) {
  if (!Watchlist) {
    return;
  }

  const exists = await Watchlist.findOne({ userId, isDefault: true }).lean();
  if (!exists) {
    await Watchlist.create({
      userId,
      name: 'Primary',
      isDefault: true,
      symbols: [
        { symbol: 'RELIANCE.NS', assetType: 'stocks' },
        { symbol: 'TCS.NS', assetType: 'stocks' },
        { symbol: 'INFY.NS', assetType: 'stocks' }
      ]
    });
  }
}

async function createUser({ name, age, email, password, initialBalance, authProvider = 'local', googleId = null }) {
  ensureAuthStore();

  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);
  const allowedBalance = parseAllowedBalance(initialBalance);

  if (!normalizedName) {
    const error = new Error('Name is required');
    error.statusCode = 400;
    throw error;
  }
  if (!validateAge(age)) {
    const error = new Error('Age must be a valid number between 13 and 120');
    error.statusCode = 400;
    throw error;
  }
  if (!validateEmail(normalizedEmail)) {
    const error = new Error('Enter a valid email address');
    error.statusCode = 400;
    throw error;
  }
  if (!allowedBalance) {
    const error = new Error('Initial balance must be between ₹1,00,000 and ₹10,00,000');
    error.statusCode = 400;
    throw error;
  }

  let passwordHash = null;
  if (authProvider === 'local' && !password) {
    const error = new Error('Password is required');
    error.statusCode = 400;
    throw error;
  }

  if (password !== undefined && password !== null) {
    const passwordError = validatePassword(password);
    if (passwordError) {
      const error = new Error(passwordError);
      error.statusCode = 400;
      throw error;
    }
    passwordHash = await bcrypt.hash(String(password), Number(process.env.BCRYPT_SALT_ROUNDS || 12));
  }

  const existing = await User.findOne({
    $or: [
      { email: normalizedEmail },
      ...(googleId ? [{ googleId }] : [])
    ]
  }).lean();
  if (existing) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({
    userId: `user_${uuidv4().split('-')[0]}`,
    name: normalizedName,
    age: Number(age),
    email: normalizedEmail,
    passwordHash,
    googleId,
    authProvider,
    initialBalance: allowedBalance,
    currentBalance: allowedBalance,
    wallet: {
      cashBalance: allowedBalance,
      currency: 'INR',
      buyingPower: allowedBalance
    },
    status: 'ACTIVE'
  });

  await ensureDefaultWatchlist(user.userId);
  return user;
}

async function findUserByEmailWithPassword(email) {
  ensureAuthStore();
  return User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
}

async function findUserById(userId) {
  ensureAuthStore();
  return User.findOne({ userId }).lean();
}

async function findGoogleUser({ googleId, email }) {
  ensureAuthStore();
  return User.findOne({
    $or: [
      { googleId },
      { email: normalizeEmail(email) }
    ]
  }).select('+passwordHash');
}

async function linkGoogleUser(user, googleId) {
  user.googleId = user.googleId || googleId;
  user.authProvider = user.passwordHash ? 'linked' : 'google';
  await user.save();
  return user;
}

async function loginWithPassword({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!validateEmail(normalizedEmail)) {
    const error = new Error('Enter a valid email address');
    error.statusCode = 400;
    throw error;
  }

  const user = await findUserByEmailWithPassword(normalizedEmail);
  if (!user || !user.passwordHash) {
    const error = new Error('Incorrect email or password');
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!isValid) {
    const error = new Error('Incorrect email or password');
    error.statusCode = 401;
    throw error;
  }

  return user;
}

function setSessionCookie(res, user) {
  const token = signSession(user);
  res.cookie(AUTH_COOKIE_NAME, token, sessionCookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, clearCookieOptions());
}

module.exports = {
  AUTH_COOKIE_NAME,
  GOOGLE_SETUP_COOKIE_NAME,
  BALANCE_MIN,
  BALANCE_MAX,
  BALANCE_STEP,
  assertSessionConfigured,
  createUser,
  findGoogleUser,
  findUserById,
  linkGoogleUser,
  loginWithPassword,
  normalizeEmail,
  publicUser,
  setSessionCookie,
  clearSessionCookie,
  clearCookieOptions,
  signGoogleSetup,
  setupCookieOptions,
  verifyToken,
  validatePassword,
  parseAllowedBalance
};
