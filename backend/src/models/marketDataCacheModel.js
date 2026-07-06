const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const marketDataCacheSchema = new mongoose.Schema(
    {
      symbol: { type: String, required: true, index: true },
      assetType: {
        type: String,
        enum: ['stocks', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      provider: { type: String, required: true },
      interval: { type: String, default: '1m' },
      quote: { type: Object, default: {} },
      candles: { type: Array, default: [] },
      fetchedAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true, expires: 0 }
    },
    { timestamps: true }
  );

  marketDataCacheSchema.index({ symbol: 1, interval: 1, provider: 1 }, { unique: true });
  module.exports =
    mongoose.models.MarketDataCache || mongoose.model('MarketDataCache', marketDataCacheSchema);
}
