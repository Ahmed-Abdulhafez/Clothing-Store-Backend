const mongoose = require("mongoose");
const schema = mongoose.Schema;

const productSchema = new schema(
  {
    title: {
      type: String,
      required: [true, "اسم المنتج مطلوب"],
      trim: true,
      maxlength: [200, "اسم المنتج لا يمكن أن يتجاوز 200 حرف"],
    },
    desc: {
      type: String,
      required: [true, "وصف المنتج مطلوب"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "السعر مطلوب"],
      default: 0,
      min: [0, "السعر لا يمكن أن يكون أقل من 0"], 
    },
    offerPrice: {
      type: Number,
      required: [true, "السعر مطلوب"],
      default: 0,
      min: [0, "السعر لا يمكن أن يكون أقل من 0"], 
    },
    brand: {
      type: String,
      default: "Evo",
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "الكمية المتاحة مطلوبة"],
      default: 0,
      min: [0, "الكمية لا يمكن أن تكون أقل من 0"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "قسم المنتج مطلوب"],
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showInProductSlider: {
      type: Boolean,
      default: false,
    },

    productSliderOrder: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// تسريع عمليات البحث بالكلمات المفتاحية في عنوان المنتج
productSchema.index({ title: "text" });

module.exports = mongoose.model("Product", productSchema);
