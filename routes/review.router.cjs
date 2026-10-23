const express = require("express");
const router = express.Router();
const reveiwController = require("../controllers/review.controller.cjs")

const authMiddleware = require("../middlewares/auth.middleware.cjs");

// create Review
router.post("/", authMiddleware, reveiwController.createReview)

// get All Review
router.get("/", reveiwController.getAllReviews)

// Get all reviews written by the logged-in user
router.get("/my-reviews", authMiddleware, reveiwController.getLoggedUserReviews);

// update Review
router.put("/:id", authMiddleware, reveiwController.updateReview)

// get Review By Id
router.get("/:id",authMiddleware, reveiwController.getReviewById )

// delete Review
router.delete("/:id",authMiddleware, reveiwController.deleteReview )

module.exports = router;