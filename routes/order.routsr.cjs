const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order.controller.cjs");
const authMiddlware = require("../middlewares/auth.middleware.cjs");
const { isAdmin } = require("../middlewares/isAdmin.middleware.cjs");

//  Get All Orders
router.get("/", authMiddlware, isAdmin, orderController.getAllOrder);

// Get User Orders
router.get(
  "/my-orders",
  authMiddlware,
  orderController.getUserOrders,
);

// Get Specific Order By ID (الجديد - ولازم يكون تحت my-orders)
router.get("/:id", authMiddlware, orderController.getOrderById);

// Create New Order
router.post(
  "/:cartId",
  authMiddlware,
  orderController.createNewOrder,
);

// Update Order to Paid
router.put(
  "/:id/pay",
  authMiddlware,
  isAdmin,
  orderController.updateOrderToPaid,
);

// Update Order to Delivered
router.put(
  "/:id/deliver",
  authMiddlware,
  isAdmin,
  orderController.updateOrderToDelivered,
);

// Stripe Checkout
router.post(
  "/checkout-session/:cartId",
  authMiddlware,
  orderController.createCheckoutSession,
);
module.exports = router;