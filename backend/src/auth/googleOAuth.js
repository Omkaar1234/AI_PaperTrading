const axios = require('axios');

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL
  };
}

function assertGoogleConfigured() {
  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
    const error = new Error('Google OAuth is not configured');
    error.statusCode = 503;
    throw error;
  }
  return config;
}

function buildGoogleAuthUrl(state) {
  const config = assertGoogleConfigured();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForProfile(code) {
  const config = assertGoogleConfigured();
  const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    grant_type: 'authorization_code'
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  const idToken = tokenResponse.data?.id_token;
  if (!idToken) {
    const error = new Error('Google authentication failed');
    error.statusCode = 401;
    throw error;
  }

  const profileResponse = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000
  });

  const profile = profileResponse.data || {};
  if (profile.aud !== config.clientId || profile.email_verified !== 'true') {
    const error = new Error('Google identity could not be verified');
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email
  };
}

module.exports = {
  buildGoogleAuthUrl,
  exchangeCodeForProfile
};
