const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const tradeSchema = new mongoose.Schema(
    {
      tradeId: { type: String, required: true, unique: true, index: true },
      orderId: { type: String, default: null, index: true },
      engineTradeRef: { type: String, default: null, sparse: true },
      userId: { type: String, default: null, index: true },
      buyer_id: { type: String, default: null, index: true },
      seller_id: { type: String, default: null, index: true },
      symbol: { type: String, required: true, index: true },
      assetType: {
        type: String,
        enum: ['stocks', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      side: { type: String, enum: ['BUY', 'SELL'], default: null },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      notional: { type: Number, default: 0 },
      fees: { type: Number, default: 0 },
      counterpartyOrderId: { type: String, default: null },
      executedAt: { type: Date, default: Date.now },
      timestamp: { type: Number, default: null }
    },
    { timestamps: true }
  );

  tradeSchema.index({ userId: 1, executedAt: -1 });

  module.exports = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);
}
