import { Schema, model, mongo } from "mongoose";

const StreamSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, default: () => new mongo.ObjectId() },
  userId: { type: Schema.Types.ObjectId, required: true },
  streamKey: { type: String, required: true, unique: true, index: true },
  isLive: { type: Boolean, required: true },
  qualities: {
    type: [
      {
        isSource: { type: Boolean, default: false },
        status: {
          type: String,
          enum: ['prepare', 'live', 'offline'],
          default: 'offline',
          required: true,
        },
        quality: {
          type: String,
          enum: ['144p', '240p', '360p', '480p', '720p', '1080p', 'source'],
          default: '720p',
          required: true,
        },
      }
    ],
    required: true,
  },
});

const StreamModel = model('Stream', StreamSchema);

export { StreamModel };
