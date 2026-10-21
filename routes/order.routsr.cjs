const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order.controller.cjs");
const authMiddlware = require("../middlewares/auth.middleware.cjs");
const { isAdmin } = require("../middlewares/isAdmin.middleware.cjs");

//  Get All Orders
router.get("/api/orders", authMiddlware, isAdmin, orderController.getAllOrder);

// Get User Orders
router.get(
  "/api/orders/my-orders",
  authMiddlware,
  orderController.getUserOrders,
);

// Get Specific Order By ID (الجديد - ولازم يكون تحت my-orders)
router.get("/api/orders/:id", authMiddlware, orderController.getOrderById);

// Create New Order
router.post(
  "/api/orders/:cartId",
  authMiddlware,
  orderController.createNewOrder,
);

// Update Order to Paid
router.put(
  "/api/orders/:id/pay",
  authMiddlware,
  isAdmin,
  orderController.updateOrderToPaid,
);

// Update Order to Delivered
router.put(
  "/api/orders/:id/deliver",
  authMiddlware,
  isAdmin,
  orderController.updateOrderToDelivered,
);

// Stripe Checkout
router.post(
  "/api/orders/checkout-session/:cartId",
  authMiddlware,
  orderController.createCheckoutSession,
);
module.exports = router;