import { Schema, model, mongo } from "mongoose";

const StreamSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, default: () => new mongo.ObjectId() },
  title: { type: String },
  description: { type: String },
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
}, {
  methods: {
    toShortResponse() {
      return {
        _id: this._id.toString(),
        title: this.title,
        isLive: this.isLive
      };
    },

    toResponse() {
      return {
        _id: this._id.toString(),
        title: this.title,
        description: this.description,
        isLive: this.isLive,
        source: {
          width: this.source.width,
          height: this.source.height,
          display_aspect_ratio: this.source.display_aspect_ratio,
          qualities: this.source.qualities.map(q => ({
            name: q.name,
            height: q.height,
            width: q.width
          }))
        }
      };
    }
  },
});

const StreamModel = model('Stream', StreamSchema);

export { StreamModel };
