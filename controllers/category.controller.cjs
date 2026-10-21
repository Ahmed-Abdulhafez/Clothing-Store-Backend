const mongoose = require("mongoose");
const categoryModle = require("../models/category.schema.cjs");
const cloudinary = require("cloudinary").v2;

// create Category
exports.createCategory = async (req, res) => {
  // تعريف متغير files في أعلى الدالة ليكون متاحاً في try و catch
  const files = Array.isArray(req.files) ? req.files : [];

  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required!" });
    }

    if (files.length === 0) {
      return res
        .status(400)
        .json({ message: "Please upload at least one image!" });
    }

    const uploadedImages = files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));

    const categoryData = {
      name: name.trim(),
      images: uploadedImages,
    };

    // تأكد من اسم المودل الصحيح لديك (مثلاً categoryModel)
    const newCategory = new categoryModle(categoryData);
    const saveCategory = await newCategory.save();

    return res.status(201).json({
      message: "Category created successfully",
      data: saveCategory,
    });
  } catch (error) {
    // الآن متغير files معرف وسيعمل التراجع والحذف بشكل صحيح دون أخطاء
    if (files.length > 0) {
      const cleanupPromises = files.map((file) =>
        cloudinary.uploader.destroy(file.filename),
      );
      await Promise.allSettled(cleanupPromises);
      console.log(
        "Images removed from Cloudinary due to database save failure.",
      );
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "Category already exists!" });
    }

    console.error("Error creating category:", error);
    return res.status(500).json({
      message: "Failed to create category",
      error: error.message,
    });
  }
};

// GET ALL category
exports.getAllCategory = async (req, res) => {
  try {
    const category = await categoryModle.find();
    return res
      .status(200)
      .json({ message: "category retrieved successfully", data: category });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Category By Id
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await categoryModle.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found!" });
    }

    return res
      .status(200)
      .json({ message: "category retrieved successfully", data: category });
  } catch (error) {
    console.log("Error getting category:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID format" });
    }

    res.status(500).json({ message: "Server Error" });
  }
};

// get Category With Products
exports.getCategoryWithProducts = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await categoryModle.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found!" });
    }

    const products = await productModel.find({ category: id });

    return res.status(200).json({
      message: "Category and related products retrieved successfully",
      data: {
        category,
        productsCount: products.length,
        products,
      },
    });
  } catch (error) {
    console.log("Error getting category with products:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID format" });
    }

    res.status(500).json({ message: "Server Error" });
  }
};

// update Category
exports.updateCategory = async (req, res) => {
  const newFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const { id } = req.params;
    const { name } = req.body;

    // 1. التحقق من صحة الـ ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (newFiles.length > 0) {
        await Promise.allSettled(
          newFiles.map((file) => cloudinary.uploader.destroy(file.filename)),
        );
      }
      return res.status(400).json({ message: "Invalid category ID format" });
    }

    // 2. البحث عن التصنيف الحالي
    const category = await categoryModle.findById(id);
    if (!category) {
      if (newFiles.length > 0) {
        await Promise.allSettled(
          newFiles.map((file) => cloudinary.uploader.destroy(file.filename)),
        );
      }
      return res.status(404).json({ message: "Category not found!" });
    }

    // 3. بناء بيانات التحديث
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();

    // 4. إدارة الصور (الاحتفاظ بالقديم أو استبداله بجديد حسب رغبتك)
    const oldImages = Array.isArray(category.images) ? category.images : [];

    if (newFiles.length > 0) {
      const uploadedImages = newFiles.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));

      // إذا كنت تريد استبدال الصور القديمة تماماً بالجديدة:
      updateData.images = uploadedImages;
    }

    // 5. تنفيذ التحديث في قاعدة البيانات
    const updatedCategory = await categoryModle.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    // 6. حذف الصور القديمة من Cloudinary إذا تم رفع صور جديدة
    if (newFiles.length > 0 && oldImages.length > 0) {
      const deletePromises = oldImages.map((image) =>
        cloudinary.uploader.destroy(image.public_id),
      );
      Promise.allSettled(deletePromises).catch((err) =>
        console.error("Failed to delete old category images:", err),
      );
    }

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    // تراجع (Rollback) لحذف الصور الجديدة إذا حدث خطأ أثناء الحفظ
    if (newFiles.length > 0) {
      const rollbackPromises = newFiles.map((file) =>
        cloudinary.uploader.destroy(file.filename),
      );
      await Promise.allSettled(rollbackPromises);
    }

    console.error("Error updating category:", error);

    if (error.code === 11000) {
      return res.status(400).json({ message: "Category name already exists!" });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid category ID format" });
    }
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Delete Category
exports.deletedCategory = async (req, res) => {
  try {
    const category = await categoryModle.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "category not found!" });
    }
    await categoryModle.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.log("Error deleting category:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};
