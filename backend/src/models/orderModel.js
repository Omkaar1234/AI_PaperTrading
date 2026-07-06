const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const orderSchema = new mongoose.Schema(
    {
      orderId: { type: String, required: true, unique: true, index: true },
      userId: { type: String, required: true, index: true },
      symbol: { type: String, required: true, index: true },
      assetType: {
        type: String,
        enum: ['stocks', 'crypto', 'forex', 'unknown'],
        default: 'unknown'
      },
      exchange: { type: String, default: null },
      side: { type: String, enum: ['BUY', 'SELL'], required: true },
      orderType: { type: String, enum: ['MARKET', 'LIMIT'], default: 'LIMIT' },
      timeInForce: { type: String, default: 'GTC' },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      filled_qty: { type: Number, default: 0 },
      remaining_qty: { type: Number, default: 0 },
      avg_fill_price: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['PENDING_SUBMISSION', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED'],
        default: 'PENDING_SUBMISSION',
        index: true
      },
      source: { type: String, default: 'frontend' },
      engineOrderRef: { type: String, default: null },
      submittedAt: { type: Date, default: null },
      lastEventAt: { type: Date, default: null },
      timestamp: { type: String, default: null }
    },
    { timestamps: true }
  );

  orderSchema.index({ userId: 1, createdAt: -1 });
  orderSchema.index({ symbol: 1, status: 1, createdAt: -1 });

  module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
}
