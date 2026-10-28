const mongoose = require("mongoose");

const schema = mongoose.Schema;
const orderSchema = new schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Order must belong to a user"],
    },

    cartItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: "Product",
        },
        quantity: Number,
        price: Number, // 💡 تريكة مهمة: بنسجل السعر هنا عشان لو سعر الكتاب اتغير بعدين، الفاتورة دي ماتتأثرش
      },
    ],

    shippingAddress: {
      details: String,
      phone: String,
      city: String,
      fullName: String,
      address: String,
    },

    totalOrderPrice: {
      type: Number,
    },

    paymentMethodType: {
      type: String,
      enum: ["cash", "card"],
      default: "cash",
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    paidAt: Date, // تاريخ الدفع

    isDelivered: {
      type: Boolean,
      default: false,
    },

    deliveredAt: Date, // تاريخ التوصيل
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
