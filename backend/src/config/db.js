let mongoose = null;

try {
  // Optional dependency so the existing app can still run before install.
  mongoose = require('mongoose');
} catch (error) {
  mongoose = null;
}

async function connectDatabase() {
  if (!mongoose) {
    return { enabled: false, reason: 'mongoose_not_installed' };
  }

  if (process.env.MONGODB_ENABLED === 'false') {
    return { enabled: false, reason: 'mongodb_disabled' };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return { enabled: false, reason: 'missing_mongodb_uri' };
  }

  if (mongoose.connection.readyState === 1) {
    return { enabled: true, reason: 'already_connected', mongoose };
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || 'paper_trading',
    serverSelectionTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 5000)
  });

  return { enabled: true, reason: 'connected', mongoose };
}

function getMongoose() {
  return mongoose;
}

module.exports = {
  connectDatabase,
  getMongoose
};
