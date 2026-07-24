import express, { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { BookingType, HotelSearchResponse } from "../../../shared/types";
import { param, validationResult } from "express-validator";
import Stripe from "stripe";
import verifyToken from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

const router = express.Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    let query = supabase.from("hotels").select("*", { count: "exact" });

    if (req.query.destination && req.query.destination.toString().trim() !== "") {
      const dest = req.query.destination.toString().trim();
      query = query.or(`city.ilike.%${dest}%,country.ilike.%${dest}%`);
    }
    if (req.query.adultCount) {
      query = query.gte("adult_count", parseInt(req.query.adultCount as string));
    }
    if (req.query.childCount) {
      query = query.gte("child_count", parseInt(req.query.childCount as string));
    }
    if (req.query.facilities) {
      const facs = Array.isArray(req.query.facilities) ? req.query.facilities : [req.query.facilities];
      query = query.contains("facilities", facs);
    }
    if (req.query.types) {
      const types = Array.isArray(req.query.types) ? req.query.types : [req.query.types];
      query = query.overlaps("type", types);
    }
    if (req.query.stars) {
      const stars = Array.isArray(req.query.stars)
        ? req.query.stars.map((s: any) => parseInt(s))
        : [parseInt(req.query.stars as string)];
      query = query.in("star_rating", stars);
    }
    if (req.query.maxPrice) {
      query = query.lte("price_per_night", parseInt(req.query.maxPrice as string));
    }

    switch (req.query.sortOption) {
      case "starRating":
        query = query.order("star_rating", { ascending: false });
        break;
      case "pricePerNightAsc":
        query = query.order("price_per_night", { ascending: true });
        break;
      case "pricePerNightDesc":
        query = query.order("price_per_night", { ascending: false });
        break;
    }

    const pageSize = 5;
    const pageNumber = parseInt(req.query.page ? req.query.page.toString() : "1");
    const skip = (pageNumber - 1) * pageSize;

    query = query.range(skip, skip + pageSize - 1);

    const { data: hotels, count, error } = await query;
    if (error) throw error;

    const response: HotelSearchResponse = {
      data: hotels as any,
      pagination: {
        total: count || 0,
        page: pageNumber,
        pages: Math.ceil((count || 0) / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { data: hotels, error } = await supabase.from("hotels").select("*").order("last_updated", { ascending: false });
    if (error) throw error;
    res.json(hotels);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

/**
 * Admin: toggle hotel isActive.
 * PATCH /api/hotels/:id/active
 * Body: { isActive: boolean }
 */
router.patch(
  "/:id/active",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive boolean required" });
    }
    try {
      const { data: hotel, error } = await supabase
        .from("hotels")
        .update({ is_active: req.body.isActive, updated_at: new Date().toISOString() })
        .eq("_id", req.params.id)
        .select("*")
        .single();
      if (error || !hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }
      res.json(hotel);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update hotel status" });
    }
  }
);

router.get(
  "/:id",
  [param("id").notEmpty().withMessage("Hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id.toString();

    try {
      const { data: hotel, error } = await supabase.from("hotels").select("*").eq("_id", id).single();
      if (error || !hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }
      res.json(hotel);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error fetching hotel" });
    }
  }
);

router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;

    const { data: hotel } = await supabase.from("hotels").select("price_per_night").eq("_id", hotelId).single();
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }

    const totalCost = hotel.price_per_night * numberOfNights;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCost * 100,
      currency: "gbp",
      metadata: {
        hotelId,
        userId: req.userId,
      },
    });

    if (!paymentIntent.client_secret) {
      return res.status(500).json({ message: "Error creating payment intent" });
    }

    const response = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret.toString(),
      totalCost,
    };

    res.send(response);
  }
);

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );

      if (!paymentIntent) {
        return res.status(400).json({ message: "payment intent not found" });
      }

      if (
        paymentIntent.metadata.hotelId !== req.params.hotelId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res.status(400).json({ message: "payment intent mismatch" });
      }

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });
      }

      const newBooking = {
        user_id: req.userId,
        hotel_id: req.params.hotelId,
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        adult_count: req.body.adultCount,
        child_count: req.body.childCount,
        check_in: req.body.checkIn,
        check_out: req.body.checkOut,
        total_cost: req.body.totalCost,
        status: "confirmed",
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntent.id,
      };

      const { error: bookingError } = await supabase.from("bookings").insert([newBooking]);
      if (bookingError) throw bookingError;

      // Supabase RPC or simple fetch and update for stats
      const { data: hotel } = await supabase.from("hotels").select("total_bookings, total_revenue").eq("_id", req.params.hotelId).single();
      if (hotel) {
        await supabase.from("hotels").update({
          total_bookings: (hotel.total_bookings || 0) + 1,
          total_revenue: (hotel.total_revenue || 0) + req.body.totalCost
        }).eq("_id", req.params.hotelId);
      }

      const { data: user } = await supabase.from("users").select("total_bookings, total_spent").eq("_id", req.userId).single();
      if (user) {
        await supabase.from("users").update({
          total_bookings: (user.total_bookings || 0) + 1,
          total_spent: (user.total_spent || 0) + req.body.totalCost
        }).eq("_id", req.userId);
      }

      res.status(200).send();
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "something went wrong" });
    }
  }
);



export default router;
