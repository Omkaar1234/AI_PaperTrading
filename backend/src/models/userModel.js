const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const userSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true, unique: true, index: true },
      name: { type: String, default: 'Paper Trader' },
      email: { type: String, default: null },
      status: { type: String, default: 'ACTIVE' },
      wallet: {
        cashBalance: { type: Number, default: 100000 },
        currency: { type: String, default: 'USD' },
        buyingPower: { type: Number, default: 100000 }
      },
      preferences: {
        theme: { type: String, default: 'dark' },
        defaultAssetType: { type: String, default: 'stocks' }
      }
    },
    { timestamps: true }
  );

  module.exports = mongoose.models.User || mongoose.model('User', userSchema);
}
