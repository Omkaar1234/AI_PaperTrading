const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const watchlistSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, index: true },
      name: { type: String, default: 'Primary' },
      symbols: [
        {
          symbol: { type: String, required: true },
          assetType: {
            type: String,
            enum: ['stocks', 'crypto', 'forex', 'unknown'],
            default: 'unknown'
          }
        }
      ],
      isDefault: { type: Boolean, default: true }
    },
    { timestamps: true }
  );

  watchlistSchema.index({ userId: 1, isDefault: 1 });

  module.exports = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema);
}
