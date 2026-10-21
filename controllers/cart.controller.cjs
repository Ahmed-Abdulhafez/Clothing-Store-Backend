const cartModel = require("../models/cart.schema.cjs");
const productModel = require("../models/product.schema.cjs");
const { calcTotalCartPrice } = require("../utils/calcTotalCartPrice.utils.cjs");

const mongoose = require("mongoose");

// Add product to cart
exports.AddToCart = async (req, res) => {
  try {
    const { productId } = req.body;

    // 1. البحث عن المنتج والتحقق من المخزون قبل أي شيء
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found!" });
    }
    if (product.stock < 1) {
      return res.status(400).json({ message: "Product is out of stock!" });
    }

    let cart = await cartModel.findOne({ user: req.user._id });

    if (!cart) {
      cart = await cartModel.create({
        user: req.user._id,
        cartItems: [
          { product: product._id, price: product.price, quantity: 1 },
        ],
        totalCartPrice: product.price,
      });
      return res
        .status(201)
        .json({ message: "Cart created and product added", cart: cart });
    }

    const itemIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === productId,
    );

    if (itemIndex > -1) {
      // 2. التحقق من أن الزيادة لن تتخطى المخزون المتاح
      if (cart.cartItems[itemIndex].quantity >= product.stock) {
        return res.status(400).json({
          message: `Cannot add more. Only ${product.stock} items in stock.`,
        });
      }
      cart.cartItems[itemIndex].quantity += 1;
    } else {
      cart.cartItems.push({
        product: product._id,
        price: product.price,
        quantity: 1,
      });
    }

    calcTotalCartPrice(cart);
    await cart.save();

    return res
      .status(200)
      .json({ message: "Product added to cart successfully", cart: cart });
  } catch (error) {
    console.log("Error adding to cart:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid product ID format" }); // تم التعديل
    }
    return res.status(500).json({ message: "Server Error" });
  }
};

// Get logged user cart
exports.getLoggedUserCart = async (req, res) => {
  try {
    const cart = await cartModel
      .findOne({ user: req.user._id })
      .populate("cartItems.product", "title price images stock");
    if (!cart) {
      return res
        .status(404)
        .json({ message: "There is no cart for this user" });
    }
    return res
      .status(200)
      .json({ message: "Cart retrieved successfully", cart: cart });
  } catch (error) {
    console.log("Error getting user cart:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Update specific cart item quantity
exports.updateCartItemQuantity = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // 🟢 1. التحقق من صحة الـ ID
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    // 🟢 2. التحقق من الرقم المدخل
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    // 🟢 3. فحص المخزون المتاح للمنتج
    const product = await productModel.findById(itemId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (quantity > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} items available in stock`,
      });
    }

    let cart = await cartModel.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found!" });
    }

    const itemIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === itemId,
    );

    if (itemIndex > -1) {
      cart.cartItems[itemIndex].quantity = quantity;
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    calcTotalCartPrice(cart);
    await cart.save();

    return res.status(200).json({
      message: "Cart item quantity updated successfully",
      cart: cart,
    });
  } catch (error) {
    console.log("Error updating cart item:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Remove specific item from cart
exports.removeSpecificCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    // 🟢 1. التحقق من صحة الـ ID
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    let cart = await cartModel.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // 🟢 2. التأكد من وجود العنصر قبل الحذف
    const initialLength = cart.cartItems.length;
    cart.cartItems = cart.cartItems.filter(
      (item) => item.product.toString() !== itemId,
    );

    if (cart.cartItems.length === initialLength) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    calcTotalCartPrice(cart);
    await cart.save();

    return res.status(200).json({
      message: "Item removed successfully",
      cart: cart,
    });
  } catch (error) {
    console.log("Error removing item from cart:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Clear logged user cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await cartModel.findOneAndDelete({ user: req.user._id });

    if (!cart) {
      return res.status(404).json({ message: "No cart found to clear" });
    }

    return res.status(200).json({
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.log("Error clearing cart:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};
