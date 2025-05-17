import { Schema, model, mongo } from "mongoose";

const StreamSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, default: () => new mongo.ObjectId() },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  streamKey: { type: String, required: true, unique: true, index: true },
  isLive: { type: Boolean, required: true },
  source: {
    type: {
      width: Number,
      height: Number,
      display_aspect_ratio: String,
      qualities: [
        {
          name: String,
          height: Number,
          width: Number,
        }
      ]
    },
    required: true,
  }
});

const StreamModel = model('Stream', StreamSchema);

export { StreamModel };
