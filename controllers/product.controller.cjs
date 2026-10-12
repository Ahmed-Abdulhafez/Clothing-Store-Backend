const mongoose = require("mongoose");
const productModel = require("../models/product.schema.cjs");
const cloudinary = require("cloudinary").v2;

// get all products
exports.getAllProducts = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page, limit } = req.query;
    let queryArgs = {};
    if (search) {
      queryArgs.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      queryArgs.category = category;
    }

    if (minPrice || maxPrice) {
      queryArgs.price = {};
      if (minPrice) queryArgs.price.$gte = Number(minPrice);
      if (maxPrice) queryArgs.price.$lte = Number(maxPrice);
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;
    const totalProducts = await productModel.countDocuments(queryArgs);
    const totalPages = Math.ceil(totalProducts / limitNumber);

    const products = await productModel
      .find(queryArgs)
      .populate("category", "name")
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      message: "Products fetched successfully",
      pagination: {
        totalProducts,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
      },
      results: products.length,
      data: products,
    });
  } catch (error) {
    console.log("Error fetching products:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get product By id
exports.getProductById = async (req, res) => {
  try {
    const product = await productModel
      .findById(req.params.id)
      .populate("category", "name");
    if (!product) {
      return res.status(404).json({ message: "Product Not Found!" });
    }
    return res.status(200).json({
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.log("Error getting Product by ID:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid Product ID format" });
    }

    return res.status(500).json({ message: "Server Error" });
  }
};

// create new product
exports.createNewProduct = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "Please upload at least one image!" });
    }

    const uploadedImages = req.files.map((file) => {
      return {
        url: file.path,
        public_id: file.filename,
      };
    });

    const {
      title,
      desc,
      price,
      category,
      brand,
      stock,
      isFeatured,
      rating,
      numReviews,
    } = req.body;

    const productData = {
      title,
      desc,
      price,
      category,
      brand,
      stock: stock || 0,
      isFeatured: isFeatured || false,
      rating: rating || 0,
      numReviews: numReviews || 0,
      images: uploadedImages,
    };

    const newProduct = new productModel(productData);
    const saveProduct = await newProduct.save();
    await saveProduct.populate("category", "name");
    return res.status(201).json({
      message: "Product created successfully with images",
      data: saveProduct,
    });
  } catch (error) {
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        await cloudinary.uploader.destroy(file.filename);
      }
      console.log(
        "Images removed from Cloudinary due to database save failure.",
      );
    }
    console.log("Error creating book:", error);

    return res.status(500).json({
      message: "Failed to save book",
      error: error.message,
    });
  }
};

// updated product
exports.updateProduct = async (req, res) => {
  const newFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const { title, desc, price, stock, brand, category, isFeatured } = req.body;
    const productId = req.params.id;

    // 1. Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    // 2. Find existing product
    const product = await productModel.findById(productId);
    if (!product) {
      // تنظيف الصور الجديدة التي تم تحميلها إذا لم يتم العثور على المنتج
      if (newFiles.length > 0) {
        await Promise.allSettled(
          newFiles.map((file) => cloudinary.uploader.destroy(file.filename)),
        );
      }
      return res.status(404).json({
        message: "Product not found!",
      });
    }

    // 3. Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (desc !== undefined) updateData.desc = desc;
    if (price !== undefined) updateData.price = price;
    if (stock !== undefined) updateData.stock = stock;
    if (brand !== undefined) updateData.brand = brand;
    if (category !== undefined) updateData.category = category;
    if (isFeatured !== undefined) {
      updateData.isFeatured = isFeatured === true || isFeatured === "true";
    }

    // 4. Handle images logic
    const oldImages = Array.isArray(product.images) ? product.images : [];
    let existingImageIds = [];

    try {
      existingImageIds = JSON.parse(req.body.existingImages ?? "[]");
    } catch {
      if (newFiles.length > 0) {
        await Promise.allSettled(
          newFiles.map((file) => cloudinary.uploader.destroy(file.filename)),
        );
      }
      return res.status(400).json({
        success: false,
        message: "Invalid existingImages format",
      });
    }

    if (!Array.isArray(existingImageIds)) {
      if (newFiles.length > 0) {
        await Promise.allSettled(
          newFiles.map((file) => cloudinary.uploader.destroy(file.filename)),
        );
      }
      return res.status(400).json({
        success: false,
        message: "existingImages must be an array",
      });
    }

    const retainedImages = oldImages.filter(
      (image) => image.public_id && existingImageIds.includes(image.public_id),
    );

    const uploadedImages = newFiles.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));

    updateData.images = [...retainedImages, ...uploadedImages];

    // 5. Update product
    const updatedProduct = await productModel.findByIdAndUpdate(
      productId,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedProduct) {
      return res.status(404).json({
        message: "Product not found!",
      });
    }

    // 6. Delete old Cloudinary images that were removed by the user
    const retainedIds = new Set(retainedImages.map((image) => image.public_id));
    const removedImages = oldImages.filter(
      (image) => image.public_id && !retainedIds.has(image.public_id),
    );

    if (removedImages.length > 0) {
      const deletePromises = removedImages.map((image) =>
        cloudinary.uploader.destroy(image.public_id),
      );
      Promise.allSettled(deletePromises).catch((err) =>
        console.error("Failed to delete removed images:", err),
      );
    }

    return res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    // Rollback: حذف الصور الجديدة المرفوعة إذا حدث خطأ في قاعدة البيانات
    if (newFiles.length > 0) {
      const rollbackPromises = newFiles.map((file) =>
        cloudinary.uploader.destroy(file.filename),
      );
      await Promise.allSettled(rollbackPromises);
    }

    console.error("UPDATE PRODUCT ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Product validation failed",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid product data",
      });
    }

    return res.status(500).json({
      message: "Server Error",
    });
  }
};

// deleted product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found!" });
    }

    if (product.images && product.images.length > 0) {
      for (let image of product.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }
    await productModel.findByIdAndDelete(req.params.id);
    return res
      .status(200)
      .json({ message: "Product and all its images deleted successfully" });
  } catch (error) {
    console.log("Error deleting Product:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};
