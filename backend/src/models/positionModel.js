const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const positionSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, index: true },
      symbol: { type: String, required: true, index: true },
      assetType: {
        type: String,
        enum: ['stocks', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      quantity: { type: Number, default: 0 },
      averagePrice: { type: Number, default: 0 },
      invested: { type: Number, default: 0 },
      marketPrice: { type: Number, default: 0 },
      marketValue: { type: Number, default: 0 },
      unrealizedPnl: { type: Number, default: 0 },
      realizedPnl: { type: Number, default: 0 },
      lastUpdatedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
  );

  positionSchema.index({ userId: 1, symbol: 1 }, { unique: true });

  module.exports = mongoose.models.Position || mongoose.model('Position', positionSchema);
}
