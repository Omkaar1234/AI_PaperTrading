const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const userSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, unique: true, index: true },
      name: { type: String, default: 'Paper Trader', trim: true },
      email: { type: String, default: null, trim: true, lowercase: true },
      age: { type: Number, default: null },
      passwordHash: { type: String, default: null, select: false },
      googleId: { type: String, default: null },
      authProvider: {
        type: String,
        enum: ['local', 'google', 'linked', 'demo'],
        default: 'demo'
      },
      status: { type: String, default: 'ACTIVE' },
      initialBalance: { type: Number, default: 100000 },
      currentBalance: { type: Number, default: 100000 },
      wallet: {
        cashBalance: { type: Number, default: 100000 },
        currency: { type: String, default: 'INR' },
        buyingPower: { type: Number, default: 100000 }
      },
      preferences: {
        theme: { type: String, default: 'dark' },
        defaultAssetType: { type: String, default: 'stocks' }
      }
    },
    { timestamps: true }
  );

  userSchema.index({ email: 1 }, { unique: true, sparse: true });
  userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

  module.exports = mongoose.models.User || mongoose.model('User', userSchema);
}
