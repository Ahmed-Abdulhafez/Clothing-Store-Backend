const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cart.controller.cjs");
const authMiddleware = require("../middlewares/auth.middleware.cjs");

// API Add product to cart
router.post("/", authMiddleware, cartController.AddToCart);

// API Get My Cart
router.get("/", authMiddleware, cartController.getLoggedUserCart);

// API Clear entire cart
router.delete("/", authMiddleware, cartController.clearCart);

// API Update specific cart item quantity
router.put("/:itemId", authMiddleware, cartController.updateCartItemQuantity);

// API Remove specific item from cart
router.delete(
  "/:itemId",
  authMiddleware,
  cartController.removeSpecificCartItem,
);
module.exports = router;
