import express, { Request, Response } from "express";
import Stripe from "stripe";
import { supabase } from "../lib/supabase";
import verifyToken from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";
import { body, validationResult } from "express-validator";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

/** True when booking can still be cancelled (upcoming pending/confirmed). */
const isCancellable = (booking: {
  status?: string;
  check_in: string;
}): boolean => {
  const status = booking.status || "pending";
  if (status !== "pending" && status !== "confirmed") return false;
  return new Date(booking.check_in).getTime() > Date.now();
};

/** Guest owns booking, or hotel owner, or admin role. */
const assertCanCancel = async (
  req: Request,
  booking: { user_id: string; hotel_id: string }
): Promise<{ ok: true } | { ok: false; status: number; message: string }> => {
  if (String(booking.user_id) === req.userId) {
    return { ok: true };
  }

  const { data: hotel } = await supabase.from("hotels").select("user_id").eq("_id", booking.hotel_id).single();
  if (!hotel) {
    return { ok: false, status: 404, message: "Hotel not found" };
  }
  if (hotel.user_id === req.userId) {
    return { ok: true };
  }

  const { data: user } = await supabase.from("users").select("role").eq("_id", req.userId).single();
  if (user?.role === "admin") {
    return { ok: true };
  }

  return { ok: false, status: 403, message: "Access denied" };
};

/** Owner or admin only (not guest) — for status patch / delete. */
const assertOwnerOrAdmin = async (
  req: Request,
  hotelId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> => {
  const { data: hotel } = await supabase.from("hotels").select("user_id").eq("_id", hotelId).single();
  if (!hotel) {
    return { ok: false, status: 404, message: "Hotel not found" };
  }
  if (hotel.user_id === req.userId) {
    return { ok: true };
  }
  const { data: user } = await supabase.from("users").select("role").eq("_id", req.userId).single();
  if (user?.role === "admin") {
    return { ok: true };
  }
  return { ok: false, status: 403, message: "Access denied" };
};

// Get all bookings (admin only)
router.get("/", verifyToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, hotels (name, city, country)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.status(200).json(bookings);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to fetch bookings" });
  }
});

// Get bookings by hotel ID (for hotel owners)
router.get(
  "/hotel/:hotelId",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const { hotelId } = req.params;

      const { data: hotel } = await supabase.from("hotels").select("user_id").eq("_id", hotelId).single();
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      if (hotel.user_id !== req.userId) {
        const { data: user } = await supabase.from("users").select("role").eq("_id", req.userId).single();
        if (user?.role !== "admin") {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*, users (first_name, last_name, email)")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.status(200).json(bookings);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch hotel bookings" });
    }
  }
);

/**
 * Cancel booking (guest / hotel owner / admin).
 * Full Stripe refund when paid + stripePaymentIntentId present.
 * POST /api/bookings/:id/cancel
 */
router.post(
  "/:id/cancel",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const { data: booking } = await supabase.from("bookings").select("*").eq("_id", req.params.id).single();
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const authz = await assertCanCancel(req, booking);
      if (authz.ok === false) {
        return res.status(authz.status).json({ message: authz.message });
      }

      if (!isCancellable(booking)) {
        return res.status(400).json({
          message:
            "Booking cannot be cancelled (must be upcoming pending/confirmed)",
        });
      }

      const cancellationReason =
        typeof req.body?.cancellationReason === "string"
          ? req.body.cancellationReason.trim()
          : "";

      let refundAmount = 0;
      let refundSkipped: string | undefined;
      const wasPaid = booking.payment_status === "paid";

      if (wasPaid && booking.stripe_payment_intent_id) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
          });
          refundAmount =
            typeof refund.amount === "number"
              ? refund.amount / 100
              : booking.total_cost;
        } catch (stripeErr: unknown) {
          const msg =
            stripeErr instanceof Error
              ? stripeErr.message
              : "Stripe refund failed";
          console.log(stripeErr);
          return res.status(502).json({ message: msg });
        }
      } else if (wasPaid && !booking.stripe_payment_intent_id) {
        // Legacy bookings created before PI persistence — cancel without fake refund
        refundSkipped =
          "Cancelled without Stripe refund (no payment intent on file)";
      }

      const updateData: any = {
        status: "cancelled",
        updated_at: new Date().toISOString()
      };
      
      if (wasPaid && booking.stripe_payment_intent_id && refundAmount > 0) {
        updateData.payment_status = "refunded";
        updateData.refund_amount = refundAmount;
      } else if (wasPaid && !booking.stripe_payment_intent_id) {
        updateData.refund_amount = 0;
      }
      if (cancellationReason) {
        updateData.cancellation_reason = cancellationReason;
      }
      
      const { data: updatedBooking } = await supabase.from("bookings").update(updateData).eq("_id", booking._id).select("*").single();

      // Mirror create increments only when this booking had been counted as paid revenue
      if (wasPaid) {
        const { data: hotelToUpdate } = await supabase.from("hotels").select("total_bookings, total_revenue").eq("_id", booking.hotel_id).single();
        if (hotelToUpdate) {
            await supabase.from("hotels").update({
                total_bookings: (hotelToUpdate.total_bookings || 0) - 1,
                total_revenue: (hotelToUpdate.total_revenue || 0) - (booking.total_cost || 0)
            }).eq("_id", booking.hotel_id);
        }

        const { data: userToUpdate } = await supabase.from("users").select("total_bookings, total_spent").eq("_id", booking.user_id).single();
        if (userToUpdate) {
            await supabase.from("users").update({
                total_bookings: (userToUpdate.total_bookings || 0) - 1,
                total_spent: (userToUpdate.total_spent || 0) - (booking.total_cost || 0)
            }).eq("_id", booking.user_id);
        }
      }

      res.status(200).json({
        booking: updatedBooking,
        refundAmount,
        refundSkipped,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to cancel booking" });
    }
  }
);

// Get booking by ID
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, hotels(name, city, country, image_urls)")
      .eq("_id", req.params.id)
      .single();

    if (error || !booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const authz = await assertCanCancel(req, booking);
    if (authz.ok === false) {
      return res.status(authz.status).json({ message: authz.message });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to fetch booking" });
  }
});

// Update booking status (owner / admin only — product cancel uses POST /:id/cancel)
router.patch(
  "/:id/status",
  verifyToken,
  [
    body("status")
      .isIn(["pending", "confirmed", "cancelled", "completed", "refunded"])
      .withMessage("Invalid status"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { data: existing } = await supabase.from("bookings").select("hotel_id").eq("_id", req.params.id).single();
      if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const authz = await assertOwnerOrAdmin(req, existing.hotel_id);
      if (authz.ok === false) {
        return res.status(authz.status).json({ message: authz.message });
      }

      const { status, cancellationReason } = req.body;

      // Force Stripe/refund path — do not allow silent cancel via PATCH
      if (status === "cancelled" || status === "refunded") {
        return res.status(400).json({
          message: "Use POST /api/bookings/:id/cancel for cancel/refund",
        });
      }

      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (cancellationReason) {
        updateData.cancellation_reason = cancellationReason;
      }

      const { data: booking } = await supabase.from("bookings").update(updateData).eq("_id", req.params.id).select("*").single();

      res.status(200).json(booking);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update booking" });
    }
  }
);

// Update payment status (owner / admin only)
router.patch(
  "/:id/payment",
  verifyToken,
  [
    body("paymentStatus")
      .isIn(["pending", "paid", "failed", "refunded"])
      .withMessage("Invalid payment status"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { data: existing } = await supabase.from("bookings").select("hotel_id").eq("_id", req.params.id).single();
      if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const authz = await assertOwnerOrAdmin(req, existing.hotel_id);
      if (authz.ok === false) {
        return res.status(authz.status).json({ message: authz.message });
      }

      const { paymentStatus, paymentMethod } = req.body;

      const updateData: any = { payment_status: paymentStatus, updated_at: new Date().toISOString() };
      if (paymentMethod) {
        updateData.payment_method = paymentMethod;
      }

      const { data: booking } = await supabase.from("bookings").update(updateData).eq("_id", req.params.id).select("*").single();

      res.status(200).json(booking);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update payment status" });
    }
  }
);

// Delete booking (admin only)
router.delete(
  "/:id",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
  try {
    const { data: booking } = await supabase.from("bookings").select("*").eq("_id", req.params.id).single();
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    await supabase.from("bookings").delete().eq("_id", req.params.id);

    // Skip analytics decrement if cancel already adjusted totals
    const alreadyAdjusted =
      booking.status === "cancelled" ||
      booking.status === "refunded" ||
      booking.payment_status === "refunded";

    if (!alreadyAdjusted) {
        const { data: hotelToUpdate } = await supabase.from("hotels").select("total_bookings, total_revenue").eq("_id", booking.hotel_id).single();
        if (hotelToUpdate) {
            await supabase.from("hotels").update({
                total_bookings: (hotelToUpdate.total_bookings || 0) - 1,
                total_revenue: (hotelToUpdate.total_revenue || 0) - (booking.total_cost || 0)
            }).eq("_id", booking.hotel_id);
        }

        const { data: userToUpdate } = await supabase.from("users").select("total_bookings, total_spent").eq("_id", booking.user_id).single();
        if (userToUpdate) {
            await supabase.from("users").update({
                total_bookings: (userToUpdate.total_bookings || 0) - 1,
                total_spent: (userToUpdate.total_spent || 0) - (booking.total_cost || 0)
            }).eq("_id", booking.user_id);
        }
    }

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to delete booking" });
  }
});

export default router;
