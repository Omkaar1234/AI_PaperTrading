const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const symbolSchema = new mongoose.Schema(
    {
      symbol: { type: String, required: true, trim: true, uppercase: true },
      displaySymbol: { type: String, trim: true, uppercase: true },
      baseSymbol: { type: String, trim: true, uppercase: true },
      providerSymbol: { type: String, trim: true, uppercase: true },
      name: { type: String, required: true, trim: true },
      exchange: { type: String, required: true, trim: true, uppercase: true },
      type: {
        type: String,
        enum: ['stock', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      assetType: {
        type: String,
        enum: ['stocks', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      marketCapCategory: {
        type: String,
        enum: ['large cap', 'mid cap', 'small cap', 'unclassified'],
        default: 'unclassified'
      },
      currency: { type: String, default: null },
      sector: { type: String, default: null },
      searchText: { type: String, required: true },
      source: { type: String, default: 'internal' },
      isActive: { type: Boolean, default: true },
      metadata: { type: Object, default: {} },
      lastSyncedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
  );

  symbolSchema.index({ symbol: 1 }, { unique: true });
  symbolSchema.index({ exchange: 1, type: 1, isActive: 1 });
  symbolSchema.index({ marketCapCategory: 1, type: 1 });
  symbolSchema.index({ searchText: 1 });

  module.exports = mongoose.models.Symbol || mongoose.model('Symbol', symbolSchema);
}
