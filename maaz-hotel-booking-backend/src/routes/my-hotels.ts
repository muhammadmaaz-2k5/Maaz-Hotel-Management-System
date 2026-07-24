import express, { Request, Response } from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import { supabase } from "../lib/supabase";
import verifyToken from "../middleware/auth";
import { body } from "express-validator";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/** Classify bookings into upcoming / completed / cancelled for owner cards */
function classifyBookingCounts(
  bookings: Array<{ status: string; check_in: string; check_out: string }>
) {
  const now = new Date();
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  for (const b of bookings) {
    if (b.status === "cancelled" || b.status === "refunded") {
      cancelled += 1;
    } else if (
      b.status === "completed" ||
      new Date(b.check_out).getTime() < now.getTime()
    ) {
      completed += 1;
    } else {
      upcoming += 1;
    }
  }
  return { upcoming, completed, cancelled };
}

router.post(
  "/",
  verifyToken,
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("country").notEmpty().withMessage("Country is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type")
      .notEmpty()
      .isArray({ min: 1 })
      .withMessage("Select at least one hotel type"),
    body("pricePerNight")
      .notEmpty()
      .isNumeric()
      .withMessage("Price per night is required and must be a number"),
    body("facilities")
      .notEmpty()
      .isArray()
      .withMessage("Facilities are required"),
  ],
  upload.array("imageFiles", 6),
  async (req: Request, res: Response) => {
    try {
      const imageFiles = (req as any).files as any[];
      const imageUrls = await uploadImages(imageFiles);

      const newHotel = {
        name: req.body.name,
        city: req.body.city,
        country: req.body.country,
        description: req.body.description,
        type: typeof req.body.type === "string" ? [req.body.type] : req.body.type,
        price_per_night: req.body.pricePerNight,
        star_rating: req.body.starRating,
        adult_count: req.body.adultCount,
        child_count: req.body.childCount,
        facilities: req.body.facilities,
        contact: {
          phone: req.body["contact.phone"] || "",
          email: req.body["contact.email"] || "",
          website: req.body["contact.website"] || "",
        },
        policies: {
          checkInTime: req.body["policies.checkInTime"] || "",
          checkOutTime: req.body["policies.checkOutTime"] || "",
          cancellationPolicy: req.body["policies.cancellationPolicy"] || "",
          petPolicy: req.body["policies.petPolicy"] || "",
          smokingPolicy: req.body["policies.smokingPolicy"] || "",
        },
        user_id: req.userId,
        image_urls: imageUrls,
      };

      const { data: hotel, error } = await supabase.from("hotels").insert([newHotel]).select("*").single();
      if (error) throw error;
      res.status(201).send(hotel);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

// Enriched list: booking status counts + live averageRating from Review collection
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const { data: hotels, error: hotelsError } = await supabase.from("hotels").select("*").eq("user_id", req.userId);
    if (hotelsError || !hotels || hotels.length === 0) return res.json([]);

    const hotelIds = hotels.map(h => h._id);

    const { data: allBookings } = await supabase.from("bookings").select("hotel_id, status, check_in, check_out").in("hotel_id", hotelIds);
    const { data: allReviews } = await supabase.from("reviews").select("hotel_id, rating").in("hotel_id", hotelIds);

    const bookingsByHotel = new Map<string, typeof allBookings>();
    for (const b of allBookings || []) {
      const list = bookingsByHotel.get(b.hotel_id) || [];
      list.push(b);
      bookingsByHotel.set(b.hotel_id, list);
    }

    const reviewsByHotel = new Map<string, { sum: number, count: number }>();
    for (const r of allReviews || []) {
      const stats = reviewsByHotel.get(r.hotel_id) || { sum: 0, count: 0 };
      stats.sum += r.rating;
      stats.count += 1;
      reviewsByHotel.set(r.hotel_id, stats);
    }

    const enriched = hotels.map((hotel) => {
      const id = hotel._id;
      const counts = classifyBookingCounts(bookingsByHotel.get(id) || []);
      const reviewStats = reviewsByHotel.get(id);
      let avgRating = 0;
      if (reviewStats && reviewStats.count > 0) {
        avgRating = Math.round((reviewStats.sum / reviewStats.count) * 10) / 10;
      }

      return {
        ...hotel,
        upcomingBookings: counts.upcoming,
        completedBookings: counts.completed,
        cancelledBookings: counts.cancelled,
        averageRating: avgRating || hotel.average_rating || hotel.star_rating || 0,
        reviewCount: reviewStats?.count || hotel.review_count || 0,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    const { data: hotel, error } = await supabase.from("hotels").select("*").eq("_id", req.params.id).eq("user_id", req.userId).single();
    if (error || !hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }
    res.json(hotel);
  } catch (error) {
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

router.patch(
  "/:id/active",
  verifyToken,
  async (req: Request, res: Response) => {
    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ message: "isActive boolean required" });
    }
    try {
      const { data: hotel, error } = await supabase
        .from("hotels")
        .update({ is_active: req.body.isActive, updated_at: new Date().toISOString() })
        .eq("_id", req.params.id)
        .eq("user_id", req.userId)
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

router.put(
  "/:hotelId",
  verifyToken,
  upload.array("imageFiles"),
  async (req: Request, res: Response) => {
    try {
      const { data: existingHotel } = await supabase.from("hotels").select("*").eq("_id", req.params.hotelId).eq("user_id", req.userId).single();

      if (!existingHotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      const updateData: any = {
        name: req.body.name,
        city: req.body.city,
        country: req.body.country,
        description: req.body.description,
        type: Array.isArray(req.body.type) ? req.body.type : [req.body.type],
        price_per_night: Number(req.body.pricePerNight),
        star_rating: Number(req.body.starRating),
        adult_count: Number(req.body.adultCount),
        child_count: Number(req.body.childCount),
        facilities: Array.isArray(req.body.facilities)
          ? req.body.facilities
          : [req.body.facilities],
        updated_at: new Date().toISOString(),
      };

      updateData.contact = {
        phone: req.body["contact.phone"] || "",
        email: req.body["contact.email"] || "",
        website: req.body["contact.website"] || "",
      };

      updateData.policies = {
        checkInTime: req.body["policies.checkInTime"] || "",
        checkOutTime: req.body["policies.checkOutTime"] || "",
        cancellationPolicy: req.body["policies.cancellationPolicy"] || "",
        petPolicy: req.body["policies.petPolicy"] || "",
        smokingPolicy: req.body["policies.smokingPolicy"] || "",
      };

      const files = (req as any).files as any[];
      if (files && files.length > 0) {
        const updatedImageUrls = await uploadImages(files);
        updateData.image_urls = [
          ...updatedImageUrls,
          ...(req.body.imageUrls
            ? Array.isArray(req.body.imageUrls)
              ? req.body.imageUrls
              : [req.body.imageUrls]
            : []),
        ];
      }

      const { data: updatedHotel, error } = await supabase
        .from("hotels")
        .update(updateData)
        .eq("_id", req.params.hotelId)
        .select("*")
        .single();

      if (error || !updatedHotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      res.status(200).json(updatedHotel);
    } catch (error) {
      console.error("Error updating hotel:", error);
      res.status(500).json({
        message: "Something went wrong"
      });
    }
  }
);

async function uploadImages(imageFiles: any[]) {
  const uploadPromises = imageFiles.map(async (image) => {
    const b64 = Buffer.from(image.buffer as Uint8Array).toString("base64");
    let dataURI = "data:" + image.mimetype + ";base64," + b64;
    const res = await cloudinary.v2.uploader.upload(dataURI, {
      secure: true,
      transformation: [
        { width: 800, height: 600, crop: "fill" },
        { quality: "auto" },
      ],
    });
    return res.url;
  });

  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;
