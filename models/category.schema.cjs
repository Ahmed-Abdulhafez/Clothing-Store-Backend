const mongoose = require("mongoose");
const schema = mongoose.Schema;
const categorySchema = new schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Category", categorySchema);
