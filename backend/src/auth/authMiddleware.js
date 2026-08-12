const {
  AUTH_COOKIE_NAME,
  clearCookieOptions,
  findUserById,
  publicUser,
  verifyToken
} = require('./authService');

async function optionalAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return next();
  }

  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (user?.status === 'ACTIVE') {
      req.auth = payload;
      req.user = publicUser(user);
    }
  } catch (error) {
    res.clearCookie(AUTH_COOKIE_NAME, clearCookieOptions());
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

module.exports = {
  optionalAuth,
  requireAuth
};
