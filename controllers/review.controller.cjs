const reviewModel = require("../models/review.schema.cjs");

// create Review
exports.createReview = async (req, res) => {
  try {
    const { rating, reviewComment, productId } = req.body;

    // التأكد من عدم وجود مراجعة سابقة من نفس المستخدم
    const existingReview = await reviewModel.findOne({
      product: productId,
      user: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product!",
      });
    }

    const review = await reviewModel.create({
      rating,
      reviewComment,
      product: productId,
      user: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// get All Review
exports.getAllReviews = async (req, res) => {
  try {
    let filter = {};

    // 1. فلترة المراجعات حسب المنتج لو تم التمرير في الـ query أو params
    if (req.params.productId) filter.product = req.params.productId;
    if (req.query.productId) filter.product = req.query.productId;

    // 2. إعدادات الـ Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // 3. جلب البيانات مع الترتيب من الأحدث للأقدم
    const reviews = await reviewModel
      .find(filter)
      .populate("user", "name profileImg")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalReviews = await reviewModel.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      results: reviews.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
      },
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// get Review By Id
exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await reviewModel.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review retrieved successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error getting review by id:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format!",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// update Review
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, reviewComment } = req.body;

    // 1. البحث عن المراجعة أولاً
    const review = await reviewModel.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found!",
      });
    }

    // 2.  التحقق من أن المستخدم هو صاحب هذه المراجعة
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this review!",
      });
    }

    // 3. تحديث الحقول إذا تم إرسالها
    if (rating !== undefined) review.rating = rating;
    if (reviewComment !== undefined) review.reviewComment = reviewComment;

    // 4. الحفظ (هنا سيتم تفعيل الـ post('save') تلقائياً لإعادة حساب متوسط التقييمات للمنتج!)
    const updatedReview = await review.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Error updating review:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format!",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// Get all reviews written by the logged-in user
exports.getLoggedUserReviews = async (req, res) => {
  try {
    const reviews = await reviewModel
      .find({ user: req.user._id })
      .populate("product", "title images price") // 👈 لجلب تفاصيل المنتج المرتبط بالتقييم
      .sort({ createdAt: -1 }); // من الأحدث للأقدم

    return res.status(200).json({
      success: true,
      message: "User reviews fetched successfully",
      results: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// delete Review
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. البحث عن المراجعة أولاً للتأكد من وجودها
    const review = await reviewModel.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found!",
      });
    }

    // 2. التحقق من الصلاحيات (أن يكون صاحب المراجعة أو أدمن)
    if (
      review.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review!",
      });
    }

    // 3. الحذف باستخدام deleteOne لكي يتم تفعيل الـ Hook (post("deleteOne")) لإعادة حساب متوسط التقييمات
    await review.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting review:", error);

    // معالجة خطأ الـ ID لو لم يكن مطابخاً لشروط مونجو ديبى
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID format!",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
