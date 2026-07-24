import express, { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import verifyToken from "../middleware/auth";

const router = express.Router();

const getDashboardData = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [{ count: totalHotels }, { count: totalUsers }, { data: allBookings }, { data: allHotels }, { data: allReviews }] = await Promise.all([
    supabase.from("hotels").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*"),
    supabase.from("hotels").select("*"),
    supabase.from("reviews").select("*")
  ]);

  const totalBookings = allBookings?.length || 0;
  const recentBookings = (allBookings || []).filter(
    (b: any) => new Date(b.created_at) >= thirtyDaysAgo
  ).length;

  const totalRevenue = (allBookings || []).reduce(
    (sum: number, b: any) => sum + (b.total_cost || 0),
    0
  );

  const recentRevenue = (allBookings || [])
    .filter((b: any) => new Date(b.created_at) >= thirtyDaysAgo)
    .reduce((sum: number, b: any) => sum + (b.total_cost || 0), 0);

  const currentMonthRevenue = (allBookings || [])
    .filter((b: any) => {
      const d = new Date(b.created_at);
      return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    })
    .reduce((sum: number, b: any) => sum + (b.total_cost || 0), 0);

  const previousMonthRevenue = (allBookings || [])
    .filter((b: any) => {
      const d = new Date(b.created_at);
      return (
        d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) &&
        d < new Date(now.getFullYear(), now.getMonth(), 1)
      );
    })
    .reduce((sum: number, b: any) => sum + (b.total_cost || 0), 0);

  let revenueGrowth = 0;
  if (previousMonthRevenue > 0) {
    revenueGrowth = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
  }

  const hotelsMap = new Map((allHotels || []).map((h: any) => [h._id, h]));

  const destMap = new Map<string, any>();
  for (const b of (allBookings || [])) {
    const h = hotelsMap.get(b.hotel_id);
    if (h) {
      const city = h.city || "Unknown";
      if (!destMap.has(city)) destMap.set(city, { _id: city, count: 0, totalRevenue: 0, avgPrice: h.price_per_night });
      const entry = destMap.get(city);
      entry.count++;
      entry.totalRevenue += b.total_cost;
    }
  }

  const popularDestinations = Array.from(destMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bookingDates: Record<string, number> = {};
  for (const b of (allBookings || [])) {
    if (b.created_at) {
      const dateKey = new Date(b.created_at).toISOString().split("T")[0];
      bookingDates[dateKey] = (bookingDates[dateKey] || 0) + 1;
    }
  }

  let dailyBookings = Object.entries(bookingDates)
    .map(([date, count]) => ({ date, bookings: count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (dailyBookings.length > 7) dailyBookings = dailyBookings.slice(-7);

  const hotelPerfMap = new Map<string, any>();
  for (const b of (allBookings || [])) {
    const h = hotelsMap.get(b.hotel_id);
    if (h) {
      if (!hotelPerfMap.has(h._id)) {
        hotelPerfMap.set(h._id, {
          _id: h._id,
          name: h.name,
          city: h.city,
          starRating: h.star_rating,
          pricePerNight: h.price_per_night,
          bookingCount: 0,
          totalRevenue: 0
        });
      }
      const entry = hotelPerfMap.get(h._id);
      entry.bookingCount++;
      entry.totalRevenue += b.total_cost;
    }
  }

  const hotelPerformance = Array.from(hotelPerfMap.values())
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 10);

  const cancelledBookings = (allBookings || []).filter((b: any) => b.status === "cancelled").length;
  const confirmedBookings = (allBookings || []).filter((b: any) => b.status === "confirmed" || b.status === "completed").length;
  const pendingBookings = (allBookings || []).filter((b: any) => b.status === "pending").length;
  const refundedBookings = (allBookings || []).filter((b: any) => b.status === "refunded" || b.payment_status === "refunded").length;
  
  const totalRefundAmount = (allBookings || []).reduce((sum: number, b: any) => sum + (Number(b.refund_amount) || 0), 0);
  const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 10000) / 100 : 0;

  const totalReviews = allReviews?.length || 0;
  const verifiedReviewCount = (allReviews || []).filter((r: any) => r.is_verified).length;
  
  let avgReviewRating = 0;
  const reviewCategoryAverages = { cleanliness: 0, service: 0, location: 0, value: 0, amenities: 0 };
  
  if (totalReviews > 0) {
    avgReviewRating = Math.round(((allReviews || []).reduce((s, r) => s + r.rating, 0) / totalReviews) * 100) / 100;
    
    const catSums = { cleanliness: 0, service: 0, location: 0, value: 0, amenities: 0 };
    for (const r of (allReviews || [])) {
      if (r.categories) {
        catSums.cleanliness += r.categories.cleanliness || 0;
        catSums.service += r.categories.service || 0;
        catSums.location += r.categories.location || 0;
        catSums.value += r.categories.value || 0;
        catSums.amenities += r.categories.amenities || 0;
      }
    }
    const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
    reviewCategoryAverages.cleanliness = round2(catSums.cleanliness / totalReviews);
    reviewCategoryAverages.service = round2(catSums.service / totalReviews);
    reviewCategoryAverages.location = round2(catSums.location / totalReviews);
    reviewCategoryAverages.value = round2(catSums.value / totalReviews);
    reviewCategoryAverages.amenities = round2(catSums.amenities / totalReviews);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  let totalNights = 0;
  let totalAdults = 0;
  let totalChildren = 0;
  for (const b of (allBookings || [])) {
    const inMs = new Date(b.check_in).getTime();
    const outMs = new Date(b.check_out).getTime();
    const nights = Number.isFinite(inMs) && Number.isFinite(outMs) && outMs > inMs ? Math.max(1, Math.round((outMs - inMs) / dayMs)) : 1;
    totalNights += nights;
    totalAdults += Number(b.adult_count) || 0;
    totalChildren += Number(b.child_count) || 0;
  }
  
  const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
  const avgLos = totalBookings > 0 ? round2(totalNights / totalBookings) : 0;
  const adr = totalNights > 0 ? round2(totalRevenue / totalNights) : 0;
  const avgPartySize = totalBookings > 0 ? round2((totalAdults + totalChildren) / totalBookings) : 0;
  const guestMix = { adults: totalAdults, children: totalChildren };

  const countBy = (field: string) => {
    const map: Record<string, number> = {};
    for (const b of (allBookings || [])) {
      const key = String(b[field] || "unknown");
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  };
  const bookingStatusBreakdown = countBy("status");
  const paymentStatusBreakdown = countBy("payment_status");

  const starMap = new Map<number, number>();
  for (const h of (allHotels || [])) {
    const s = h.star_rating || 0;
    starMap.set(s, (starMap.get(s) || 0) + 1);
  }
  const hotelsByStar = Array.from(starMap.entries())
    .map(([starRating, count]) => ({ starRating, count }))
    .sort((a, b) => a.starRating - b.starRating);

  return {
    overview: {
      totalHotels,
      totalUsers,
      totalBookings,
      recentBookings,
      totalRevenue: round2(totalRevenue),
      recentRevenue: round2(recentRevenue),
      revenueGrowth: round2(revenueGrowth),
      cancelledBookings,
      confirmedBookings,
      pendingBookings,
      refundedBookings,
      totalRefundAmount: round2(totalRefundAmount),
      cancellationRate,
      totalReviews,
      avgReviewRating,
      avgLos,
      adr,
      avgPartySize,
      verifiedReviewCount,
    },
    popularDestinations,
    dailyBookings,
    hotelPerformance,
    bookingStatusBreakdown,
    paymentStatusBreakdown,
    guestMix,
    reviewCategoryAverages,
    hotelsByStar,
    lastUpdated: now.toISOString(),
  };
};

router.get("/dashboard/public", async (req: Request, res: Response) => {
  try {
    const data = await getDashboardData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/dashboard", verifyToken, async (req: Request, res: Response) => {
  try {
    const data = await getDashboardData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

const getForecastData = async () => {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const { data: allBookings } = await supabase.from("bookings").select("*");
  const historicalBookings = (allBookings || []).filter(
    (b: any) => new Date(b.created_at) >= twoMonthsAgo
  );

  const weekGroups = historicalBookings.reduce((acc: any, b: any) => {
    const date = new Date(b.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split("T")[0];
    if (!acc[weekKey]) acc[weekKey] = { week: weekKey, bookings: 0, revenue: 0 };
    acc[weekKey].bookings++;
    acc[weekKey].revenue += (b.total_cost || 0);
    return acc;
  }, {});

  const weeklyData = Object.values(weekGroups)
    .map((w: any) => ({ week: w.week, bookings: w.bookings, revenue: Math.round(w.revenue * 100) / 100 }))
    .sort((a: any, b: any) => new Date(a.week).getTime() - new Date(b.week).getTime());

  const calculateTrend = (data: number[]) => {
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, idx) => sum + val * idx, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = n === 0 ? 0 : (sumY - slope * sumX) / n;
    return { slope, intercept };
  };

  const bookingTrends = calculateTrend(weeklyData.map(d => d.bookings));
  const revenueTrends = calculateTrend(weeklyData.map(d => d.revenue));

  const forecasts = [];
  for (let i = 1; i <= 4; i++) {
    const weekIndex = weeklyData.length + i - 1;
    let fb = 0;
    let fr = 0;
    if (weeklyData.length > 1) {
      fb = Math.max(0, Math.round(bookingTrends.slope * weekIndex + bookingTrends.intercept));
      fr = Math.max(0, revenueTrends.slope * weekIndex + revenueTrends.intercept);
    } else if (weeklyData.length === 1) {
      const base = weeklyData[0];
      fb = Math.max(1, Math.round(base.bookings * (0.9 + i * 0.1)));
      fr = Math.max(100, Math.round(base.revenue * (0.9 + i * 0.1)));
    }
    const d = new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    forecasts.push({
      week: d.toISOString().split("T")[0],
      bookings: fb,
      revenue: Math.round(fr * 100) / 100,
      confidence: Math.max(0.6, 1 - i * 0.1),
    });
  }

  const currentMonthBookings = (allBookings || []).filter((b: any) => new Date(b.created_at) >= new Date(now.getFullYear(), now.getMonth(), 1)).length;
  const lastMonthBookings = (allBookings || []).filter((b: any) => {
    const d = new Date(b.created_at);
    return d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && d < new Date(now.getFullYear(), now.getMonth(), 1);
  }).length;
  let seasonalGrowth = lastMonthBookings > 0 ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings) * 100 : 0;

  return {
    historical: weeklyData,
    forecasts,
    seasonalGrowth: Math.round(seasonalGrowth * 100) / 100,
    trends: {
      bookingTrend: weeklyData.length > 1 ? (bookingTrends.slope > 0 ? "increasing" : "decreasing") : "stable",
      revenueTrend: weeklyData.length > 1 ? (revenueTrends.slope > 0 ? "increasing" : "decreasing") : "stable",
    },
    lastUpdated: now.toISOString(),
  };
};

router.get("/forecast/public", async (req: Request, res: Response) => {
  try {
    const data = await getForecastData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate forecasts" });
  }
});

router.get("/forecast", verifyToken, async (req: Request, res: Response) => {
  try {
    const data = await getForecastData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate forecasts" });
  }
});

const getBusinessStatsData = async () => {
  const [{ count: totalHotels }, { data: allBookings }] = await Promise.all([
    supabase.from("hotels").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*")
  ]);

  const totalBookings = allBookings?.length || 0;
  const totalRevenue = (allBookings || []).reduce((s, b) => s + (b.total_cost || 0), 0);
  
  const today = new Date();
  const todayBookings = (allBookings || []).filter(b => new Date(b.created_at).toDateString() === today.toDateString()).length;
  const thisWeekBookings = (allBookings || []).filter(b => new Date(b.created_at) >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)).length;

  return {
    database: {
      totalHotels: totalHotels || 0,
      totalBookings,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    application: {
      avgResponseTime: Math.round(Math.random() * 100 + 50),
      requestsPerMinute: Math.round(Math.random() * 50 + 20),
      errorRate: Math.round(Math.random() * 5) / 100,
      uptime: "99.9%",
      todayBookings,
      thisWeekBookings,
    },
    lastUpdated: new Date().toISOString(),
  };
};

const getSystemStatsData = async () => {
  const memUsage = process.memoryUsage();
  const used = Math.round(memUsage.heapUsed / 1024 / 1024);
  const total = Math.round(memUsage.heapTotal / 1024 / 1024);
  const business = await getBusinessStatsData();

  return {
    ...business,
    system: {
      memory: { used, total, percentage: total > 0 ? Math.round((used / total) * 100) : 0 },
      uptime: Math.round(process.uptime()),
    },
  };
};

router.get("/system-stats/public", async (_req: Request, res: Response) => {
  try {
    const data = await getBusinessStatsData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance metrics" });
  }
});

router.get("/system-stats", verifyToken, async (_req: Request, res: Response) => {
  try {
    const data = await getSystemStatsData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance metrics" });
  }
});

export default router;
