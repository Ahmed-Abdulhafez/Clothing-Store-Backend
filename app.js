const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");

const productRouter = require("./routes/product.router.cjs");
const userRouter = require("./routes/user.router.cjs");
const categoryRouter = require("./routes/category.router");
const cartsRouter = require("./routes/cart.router.cjs");
const reviewsRouter = require("./routes/review.router.cjs");
const allowedOrigins = [
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(cookieParser());
app.use(express.json());
connectDB();

// ✅ المسارات
app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/carts", cartsRouter);
app.use("/api/reviews", reviewsRouter);


app.use((err, req, res, next) => {
  console.error("UPLOAD / ROUTE ERROR:");
  console.dir(err, { depth: null });

  return res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.message || "Upload failed",
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
});
module.exports = app;
