const { getMongoose } = require('../config/db');

const mongoose = getMongoose();

if (!mongoose) {
  module.exports = null;
} else {
  const notificationSchema = new mongoose.Schema(
    {
      notificationId: { type: String, required: true, unique: true, index: true },
      userId: { type: String, required: true, index: true },
      title: { type: String, required: true },
      message: { type: String, required: true },
      type: { type: String, default: 'INFO' },
      read: { type: Boolean, default: false },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: true }
  );

  notificationSchema.index({ userId: 1, createdAt: -1 });

  module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
}

