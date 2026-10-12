const express = require("express");
const router = express.Router();
const productController = require("../controllers/product.controller.cjs");
const upload = require("../middlewares/upload.middleware.cjs");
const authMiddlware = require("../middlewares/auth.middleware.cjs");
const { isAdmin } = require("../middlewares/isAdmin.middleware.cjs");

// get all products
router.get("/", productController.getAllProducts);

// create new product
router.post(
  "/",
  authMiddlware,
  isAdmin,
  upload.array("images", 5),
  productController.createNewProduct,
);

// updated product
router.put(
  "/:id",
  authMiddlware,
  isAdmin,
  upload.array("images", 10),
  productController.updateProduct,
);

// get product By id
router.get("/:id",  productController.getProductById);

// deleted product
router.delete("/:id", authMiddlware, isAdmin, productController.deleteProduct);

module.exports = router;
