import express, { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import verifyToken from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";

const router = express.Router();

/** Build a snapshot payload from live DB aggregates */
const buildLiveSnapshot = async () => {
  const [{ count: totalHotels }, { count: totalUsers }, { data: allBookings }, { data: reviews }] = await Promise.all([
    supabase.from("hotels").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("status, payment_status, total_cost, hotel_id"),
    supabase.from("reviews").select("rating"),
  ]);

  const totalBookings = allBookings?.length || 0;
  const totalRevenue = (allBookings || []).reduce(
    (sum, b) => sum + (b.total_cost || 0),
    0
  );

  const byStatus = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    refunded: 0,
  };
  const byPaymentStatus = {
    pending: 0,
    paid: 0,
    failed: 0,
    refunded: 0,
  };

  for (const b of (allBookings || [])) {
    const s = (b.status || "pending") as keyof typeof byStatus;
    if (s in byStatus) byStatus[s] += 1;
    const p = (b.payment_status || "pending") as keyof typeof byPaymentStatus;
    if (p in byPaymentStatus) byPaymentStatus[p] += 1;
  }

  const cancelledCount = byStatus.cancelled + byStatus.refunded;
  const cancellationRate =
    totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0;
  const averageBookingValue =
    totalBookings > 0 ? totalRevenue / totalBookings : 0;
  
  let averageRating = 0;
  if (reviews && reviews.length > 0) {
    const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    averageRating = Math.round((sum / reviews.length) * 10) / 10;
  }

  // Fetch hotels for destination and type breakdown
  const { data: hotels } = await supabase.from("hotels").select("_id, city, type, total_bookings, total_revenue");
  const hotelsMap = new Map((hotels || []).map(h => [h._id, h]));

  // Destination breakdown (top cities via hotel lookup)
  const destMap = new Map<string, { bookings: number, revenue: number }>();
  for (const b of (allBookings || [])) {
    const h = hotelsMap.get(b.hotel_id);
    if (h) {
      const city = h.city || "Unknown";
      const stats = destMap.get(city) || { bookings: 0, revenue: 0 };
      stats.bookings += 1;
      stats.revenue += (b.total_cost || 0);
      destMap.set(city, stats);
    }
  }

  const destAgg = Array.from(destMap.entries())
    .map(([city, stats]) => ({ city, bookings: stats.bookings, revenue: stats.revenue }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);

  // Type breakdown
  const typeMap = new Map<string, { bookings: number, revenue: number }>();
  for (const h of (hotels || [])) {
    const types = h.type || [];
    for (const type of types) {
      const stats = typeMap.get(type) || { bookings: 0, revenue: 0 };
      stats.bookings += (h.total_bookings || 0);
      stats.revenue += (h.total_revenue || 0);
      typeMap.set(type, stats);
    }
  }

  const typeAgg = Array.from(typeMap.entries())
    .map(([type, stats]) => ({ type, bookings: stats.bookings, revenue: stats.revenue }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);


  return {
    date: new Date().toISOString(),
    metrics: {
      totalBookings,
      totalRevenue,
      totalUsers: totalUsers || 0,
      totalHotels: totalHotels || 0,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      conversionRate: 0,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      averageRating,
    },
    breakdown: {
      byStatus,
      byPaymentStatus,
      byDestination: destAgg,
      byHotelType: typeAgg,
    },
  };
};

/**
 * List recent business-insights rollups (admin).
 * Mounted under /api/business-insights — avoids /analytics path (ad-blockers).
 * GET /api/business-insights/rollups
 */
router.get(
  "/rollups",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 50);
      const { data: snapshots, error } = await supabase
        .from("analytics")
        .select("*")
        .order("date", { ascending: false })
        .limit(limit);

      if (error) throw error;
      res.json(snapshots);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch business insights rollups" });
    }
  }
);

/**
 * Capture a live rollup into Analytics model (admin).
 * POST /api/business-insights/rollups
 */
router.post(
  "/rollups",
  verifyToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const payload = await buildLiveSnapshot();
      const { data: snapshot, error } = await supabase.from("analytics").insert([payload]).select("*").single();
      if (error) throw error;
      res.status(201).json(snapshot);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to create business insights rollup" });
    }
  }
);

export default router;
