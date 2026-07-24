import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { supabase } from "../lib/supabase";
import verifyToken from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";

const router = express.Router();

/**
 * Admin: global review list (newest first).
 * GET /api/reviews
 */
router.get(
  "/",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "100"), 10), 200);
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      res.json(reviews);
    } catch {
      res.status(500).json({ message: "Error fetching reviews" });
    }
  }
);

/**
 * Public: list reviews for a hotel (newest first).
 * GET /api/reviews/hotel/:hotelId
 */
router.get("/hotel/:hotelId", async (req: Request, res: Response) => {
  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("*, users(first_name, last_name, image)")
      .eq("hotel_id", req.params.hotelId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(reviews);
  } catch {
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

/**
 * Public: aggregate rating for a hotel.
 * GET /api/reviews/hotel/:hotelId/summary
 */
router.get("/hotel/:hotelId/summary", async (req: Request, res: Response) => {
  try {
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("rating")
      .eq("hotel_id", req.params.hotelId);

    if (error) throw error;

    let averageRating = 0;
    let reviewCount = 0;

    if (reviews && reviews.length > 0) {
      reviewCount = reviews.length;
      const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
      averageRating = Math.round((sum / reviewCount) * 10) / 10;
    }

    res.json({
      hotelId: req.params.hotelId,
      averageRating,
      reviewCount,
    });
  } catch {
    res.status(500).json({ message: "Error fetching review summary" });
  }
});

/**
 * Authenticated: create a review for a completed/confirmed booking at a hotel.
 * POST /api/reviews
 */
router.post(
  "/",
  verifyToken,
  [
    body("hotelId").notEmpty(),
    body("bookingId").notEmpty(),
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").notEmpty().isLength({ min: 3 }),
    body("categories.cleanliness").isInt({ min: 1, max: 5 }),
    body("categories.service").isInt({ min: 1, max: 5 }),
    body("categories.location").isInt({ min: 1, max: 5 }),
    body("categories.value").isInt({ min: 1, max: 5 }),
    body("categories.amenities").isInt({ min: 1, max: 5 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Invalid review", errors: errors.array() });
    }

    try {
      const { hotelId, bookingId, rating, comment, categories } = req.body;

      const { data: hotel } = await supabase.from("hotels").select("*").eq("_id", hotelId).single();
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      const { data: booking } = await supabase.from("bookings")
        .select("*")
        .eq("_id", bookingId)
        .eq("user_id", req.userId)
        .eq("hotel_id", hotelId)
        .single();
        
      if (!booking) {
        return res.status(403).json({ message: "Booking not found for this user/hotel" });
      }

      const { data: existing } = await supabase.from("reviews")
        .select("_id")
        .eq("booking_id", bookingId)
        .eq("user_id", req.userId)
        .single();
        
      if (existing) {
        return res.status(409).json({ message: "Review already exists for this booking" });
      }

      const newReview = {
        user_id: req.userId,
        hotel_id: hotelId,
        booking_id: bookingId,
        rating,
        comment,
        categories,
        is_verified: booking.payment_status === "paid",
      };

      const { data: review, error } = await supabase.from("reviews").insert([newReview]).select("*").single();
      if (error) throw error;

      // Update hotel average ratings
      const { data: allReviews } = await supabase.from("reviews").select("rating").eq("hotel_id", hotelId);
      if (allReviews && allReviews.length > 0) {
        const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
        const count = allReviews.length;
        const avg = Math.round((sum / count) * 10) / 10;
        
        await supabase.from("hotels").update({
          average_rating: avg,
          review_count: count
        }).eq("_id", hotelId);
      }

      res.status(201).json(review);
    } catch (e) {
      res.status(500).json({ message: "Error creating review" });
    }
  }
);

export default router;
