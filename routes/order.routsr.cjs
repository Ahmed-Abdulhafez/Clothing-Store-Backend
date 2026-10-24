const express = require("express");
const router = express.Router();

const orderController = require("../controllers/order.controller.cjs");
const authMiddlware = require("../middlewares/auth.middleware.cjs");
const { isAdmin } = require("../middlewares/isAdmin.middleware.cjs");


router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  orderController.webhookCheckout 
);

// Get All Orders
router.get("/", authMiddlware, isAdmin, orderController.getAllOrder);

// Get User Orders
router.get(
  "/my-orders",
  authMiddlware,
  orderController.getUserOrders,
);

// Get Specific Order By ID
router.get("/:id", authMiddlware, orderController.getOrderById);

// Stripe Checkout
router.post(
  "/checkout-session/:cartId",
  authMiddlware,
  orderController.createCheckoutSession,
);

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

module.exports = router;