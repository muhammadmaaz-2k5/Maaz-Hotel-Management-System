import express, { Request, Response } from "express";
import verifyToken from "../middleware/auth";
import { supabase } from "../lib/supabase";

const router = express.Router();

// /api/my-bookings
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const { data: userBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", req.userId)
      .order("created_at", { ascending: false });

    if (bookingsError || !userBookings) {
      throw bookingsError;
    }

    if (userBookings.length === 0) return res.status(200).send([]);

    const hotelIds = [...new Set(userBookings.map((b) => b.hotel_id))];
    const { data: hotels, error: hotelsError } = await supabase
      .from("hotels")
      .select("*")
      .in("_id", hotelIds);

    if (hotelsError) throw hotelsError;

    const hotelsMap = new Map(hotels?.map(h => [h._id, h]));

    const validResults = userBookings.map(booking => {
      const hotel = hotelsMap.get(booking.hotel_id);
      if (!hotel) return null;
      return {
        ...hotel,
        bookings: [booking]
      };
    }).filter(r => r !== null);

    res.status(200).send(validResults);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

export default router;
