import "dotenv/config";
import bcrypt from "bcryptjs";
import { supabase } from "../lib/supabase";

const IMG = [
  "https://res.cloudinary.com/dlrbonrhc/image/upload/v1784916140/maaz-hotel-images/jsge19vds3fgsj6sals1.jpg", // Thames View
  "https://res.cloudinary.com/dlrbonrhc/image/upload/v1784916142/maaz-hotel-images/ugpg36qimghav9fx47zr.jpg", // Edinburgh Castle
  "https://res.cloudinary.com/dlrbonrhc/image/upload/v1784916142/maaz-hotel-images/yjtqo07ze6xvnxsupq31.jpg", // Quayside
];

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const daysAgo = (n: number) => daysFromNow(-n);

async function seed() {
  console.log("Wiping demo collections in Supabase...");

  // Since we have ON DELETE CASCADE for foreign keys, deleting users should wipe almost everything else, 
  // but let's be thorough and delete in order.
  await supabase.from("analytics").delete().neq("_id", "00000000-0000-0000-0000-000000000000"); // trick to delete all rows
  await supabase.from("reviews").delete().neq("_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("bookings").delete().neq("_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("hotels").delete().neq("_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("users").delete().neq("_id", "00000000-0000-0000-0000-000000000000");

  console.log("Seeding users (all schema fields)…");
  
  const hashedPassword = await bcrypt.hash("12345678", 8);

  const { data: admin, error: adminErr } = await supabase.from("users").insert([{
    email: "test@user.com",
    password: hashedPassword,
    first_name: "Test",
    last_name: "Admin",
    image: "https://i.pravatar.cc/150?u=admin",
    role: "admin",
    phone: "+44 20 7946 0001",
    address: {
      street: "10 Downing Street",
      city: "London",
      state: "England",
      country: "United Kingdom",
      zipCode: "SW1A 2AA",
    },
    preferences: {
      preferredDestinations: ["London", "Edinburgh", "Bath"],
      preferredHotelTypes: ["Boutique", "Luxury"],
      budgetRange: { min: 100, max: 400 },
    },
    total_bookings: 0,
    total_spent: 0,
    last_login: daysAgo(0),
    email_verified: true,
    is_active: true,
  }]).select("*").single();
  if (adminErr) throw adminErr;

  const { data: owner, error: ownerErr } = await supabase.from("users").insert([{
    email: "owner@hotel.com",
    password: hashedPassword,
    first_name: "Hotel",
    last_name: "Owner",
    image: "https://i.pravatar.cc/150?u=owner",
    role: "hotel_owner",
    phone: "+44 131 000 0002",
    address: {
      street: "42 Castle Wynd",
      city: "Edinburgh",
      state: "Scotland",
      country: "United Kingdom",
      zipCode: "EH1 2NG",
    },
    preferences: {
      preferredDestinations: ["Edinburgh", "Glasgow"],
      preferredHotelTypes: ["Boutique", "Family"],
      budgetRange: { min: 80, max: 250 },
    },
    total_bookings: 0,
    total_spent: 0,
    last_login: daysAgo(1),
    email_verified: true,
    is_active: true,
  }]).select("*").single();
  if (ownerErr) throw ownerErr;

  const { data: guest, error: guestErr } = await supabase.from("users").insert([{
    email: "guest@user.com",
    password: hashedPassword,
    first_name: "Guest",
    last_name: "Traveler",
    image: "https://i.pravatar.cc/150?u=guest",
    role: "user",
    phone: "+44 7700 900123",
    address: {
      street: "88 Quayside",
      city: "Liverpool",
      state: "England",
      country: "United Kingdom",
      zipCode: "L3 4AN",
    },
    preferences: {
      preferredDestinations: ["London", "Liverpool", "Manchester"],
      preferredHotelTypes: ["Budget", "Apartment"],
      budgetRange: { min: 60, max: 200 },
    },
    total_bookings: 0,
    total_spent: 0,
    last_login: daysAgo(2),
    email_verified: true,
    is_active: true,
  }]).select("*").single();
  if (guestErr) throw guestErr;

  console.log("Seeding hotels (all schema fields)…");
  const { data: hotelA, error: hotelAErr } = await supabase.from("hotels").insert([{
    user_id: owner._id,
    name: "Thames View Boutique",
    city: "London",
    country: "United Kingdom",
    description:
      "A refined riverside boutique hotel with contemporary rooms and easy access to central London.",
    type: ["Boutique", "Luxury"],
    adult_count: 2,
    child_count: 1,
    facilities: ["Free WiFi", "Parking", "Spa", "Restaurant"],
    price_per_night: 180,
    star_rating: 5,
    image_urls: [IMG[0]],
    location: {
      latitude: 51.5074,
      longitude: -0.1278,
      address: {
        street: "1 Embankment Place",
        city: "London",
        state: "England",
        country: "United Kingdom",
        zipCode: "WC2N 6NN",
      },
    },
    contact: {
      phone: "+44 20 0000 0001",
      email: "stay@thamesview.example",
      website: "https://thamesview.example",
    },
    policies: {
      checkInTime: "15:00",
      checkOutTime: "11:00",
      cancellationPolicy: "Free cancel 48h before check-in",
      petPolicy: "Pets welcome on request (£25/night)",
      smokingPolicy: "Non-smoking property",
    },
    amenities: {
      parking: true,
      wifi: true,
      pool: false,
      gym: true,
      spa: true,
      restaurant: true,
      bar: true,
      airportShuttle: false,
      businessCenter: true,
    },
    total_bookings: 0,
    total_revenue: 0,
    average_rating: 0,
    review_count: 0,
    occupancy_rate: 72,
    is_active: true,
    is_featured: true,
  }]).select("*").single();
  if (hotelAErr) throw hotelAErr;

  const { data: hotelB, error: hotelBErr } = await supabase.from("hotels").insert([{
    user_id: admin._id,
    name: "Edinburgh Castle Inn",
    city: "Edinburgh",
    country: "United Kingdom",
    description:
      "Historic comfort near the Royal Mile — ideal for leisure and short business trips.",
    type: ["Budget", "Family"],
    adult_count: 4,
    child_count: 2,
    facilities: ["Free WiFi", "Family Rooms", "Non-Smoking Rooms"],
    price_per_night: 95,
    star_rating: 3,
    image_urls: [IMG[1]],
    location: {
      latitude: 55.9533,
      longitude: -3.1883,
      address: {
        street: "15 Castlehill",
        city: "Edinburgh",
        state: "Scotland",
        country: "United Kingdom",
        zipCode: "EH1 2NG",
      },
    },
    contact: {
      phone: "+44 131 000 0003",
      email: "hello@castleinn.example",
      website: "https://castleinn.example",
    },
    policies: {
      checkInTime: "14:00",
      checkOutTime: "10:00",
      cancellationPolicy: "Free cancel 24h before check-in",
      petPolicy: "No pets",
      smokingPolicy: "Smoking area outdoors only",
    },
    amenities: {
      parking: false,
      wifi: true,
      pool: false,
      gym: false,
      spa: false,
      restaurant: true,
      bar: false,
      airportShuttle: true,
      businessCenter: false,
    },
    total_bookings: 0,
    total_revenue: 0,
    average_rating: 0,
    review_count: 0,
    occupancy_rate: 65,
    is_active: true,
    is_featured: false,
  }]).select("*").single();
  if (hotelBErr) throw hotelBErr;

  const { data: hotelC, error: hotelCErr } = await supabase.from("hotels").insert([{
    user_id: owner._id,
    name: "Quiet Quayside Suites",
    city: "Liverpool",
    country: "United Kingdom",
    description: "Spacious suites on the waterfront with kitchenettes.",
    type: ["Apartment"],
    adult_count: 3,
    child_count: 2,
    facilities: ["Free WiFi", "Parking", "Airport Shuttle", "Kitchenette"],
    price_per_night: 120,
    star_rating: 4,
    image_urls: [IMG[2]],
    location: {
      latitude: 53.4084,
      longitude: -2.9916,
      address: {
        street: "20 Princes Dock",
        city: "Liverpool",
        state: "England",
        country: "United Kingdom",
        zipCode: "L3 1DL",
      },
    },
    contact: {
      phone: "+44 151 000 0004",
      email: "stay@quayside.example",
      website: "https://quayside.example",
    },
    policies: {
      checkInTime: "16:00",
      checkOutTime: "11:00",
      cancellationPolicy: "Non-refundable within 7 days",
      petPolicy: "Small pets allowed",
      smokingPolicy: "Strictly non-smoking",
    },
    amenities: {
      parking: true,
      wifi: true,
      pool: false,
      gym: false,
      spa: false,
      restaurant: false,
      bar: false,
      airportShuttle: true,
      businessCenter: false,
    },
    total_bookings: 0,
    total_revenue: 0,
    average_rating: 0,
    review_count: 0,
    occupancy_rate: 40,
    is_active: false,
    is_featured: false,
  }]).select("*").single();
  if (hotelCErr) throw hotelCErr;

  console.log("Seeding bookings (status × payment_status matrix + all fields)…");
  const bookingSpecs = [
    {
      hotel_id: hotelA._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 1,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "card",
      special_requests: "High floor with river view if available",
      check_in: daysFromNow(14),
      check_out: daysFromNow(17),
      created_at: daysAgo(2),
      total_cost: 540,
      stripe_payment_intent_id: "pi_seed_upcoming_paid",
    },
    {
      hotel_id: hotelA._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 0,
      status: "pending",
      payment_status: "pending",
      payment_method: "card",
      special_requests: "Late check-in after 21:00",
      check_in: daysFromNow(30),
      check_out: daysFromNow(32),
      created_at: daysAgo(1),
      total_cost: 360,
    },
    {
      hotel_id: hotelB._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 0,
      status: "cancelled",
      payment_status: "refunded",
      payment_method: "card",
      special_requests: "",
      check_in: daysFromNow(10),
      check_out: daysFromNow(12),
      created_at: daysAgo(5),
      total_cost: 190,
      stripe_payment_intent_id: "pi_seed_cancelled_refunded",
      cancellation_reason: "Change of plans",
      refund_amount: 190,
    },
    {
      hotel_id: hotelB._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 3,
      child_count: 1,
      status: "cancelled",
      payment_status: "paid",
      payment_method: "card",
      special_requests: "Cot for toddler",
      check_in: daysFromNow(20),
      check_out: daysFromNow(22),
      created_at: daysAgo(8),
      total_cost: 190,
      cancellation_reason: "Legacy cancel without PI",
    },
    {
      hotel_id: hotelA._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 0,
      status: "completed",
      payment_status: "paid",
      payment_method: "card",
      special_requests: "Quiet room away from lift",
      check_in: daysAgo(20),
      check_out: daysAgo(17),
      created_at: daysAgo(40),
      total_cost: 540,
      stripe_payment_intent_id: "pi_seed_completed_paid",
    },
    {
      hotel_id: hotelB._id,
      user_id: admin._id,
      first_name: "Test",
      last_name: "Admin",
      email: "test@user.com",
      phone: "+44 20 7946 0001",
      adult_count: 1,
      child_count: 0,
      status: "completed",
      payment_status: "paid",
      payment_method: "card",
      special_requests: "Early check-in if possible",
      check_in: daysAgo(10),
      check_out: daysAgo(8),
      created_at: daysAgo(25),
      total_cost: 190,
      stripe_payment_intent_id: "pi_seed_admin_completed",
    },
    {
      hotel_id: hotelA._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 0,
      status: "refunded",
      payment_status: "refunded",
      payment_method: "card",
      special_requests: "",
      check_in: daysAgo(5),
      check_out: daysAgo(3),
      created_at: daysAgo(15),
      total_cost: 360,
      refund_amount: 360,
      stripe_payment_intent_id: "pi_seed_status_refunded",
      cancellation_reason: "Full refund issued",
    },
    {
      hotel_id: hotelC._id,
      user_id: guest._id,
      first_name: "Guest",
      last_name: "Traveler",
      email: "guest@user.com",
      phone: "+44 7700 900123",
      adult_count: 2,
      child_count: 1,
      status: "pending",
      payment_status: "failed",
      payment_method: "card",
      special_requests: "Accessible room",
      check_in: daysFromNow(7),
      check_out: daysFromNow(9),
      created_at: daysAgo(0),
      total_cost: 240,
    },
  ];

  const savedBookings = [];
  for (const spec of bookingSpecs) {
    const { data: b, error } = await supabase.from("bookings").insert([spec]).select("*").single();
    if (error) throw error;
    savedBookings.push(b);
  }

  const paidActive = savedBookings.filter(
    (b) =>
      b.payment_status === "paid" &&
      b.status !== "cancelled" &&
      b.status !== "refunded"
  );
  
  for (const hotel of [hotelA, hotelB, hotelC]) {
    const mine = paidActive.filter((b) => b.hotel_id === hotel._id);
    await supabase.from("hotels").update({
      total_bookings: mine.length,
      total_revenue: mine.reduce((s, b) => s + (b.total_cost || 0), 0)
    }).eq("_id", hotel._id);
  }

  console.log("Seeding reviews (all schema fields)…");
  const completed = savedBookings.filter((b) => b.status === "completed");
  if (completed[0]) {
    await supabase.from("reviews").insert([{
      user_id: completed[0].user_id,
      hotel_id: completed[0].hotel_id,
      booking_id: completed[0]._id,
      rating: 5,
      comment: "Wonderful stay — staff were exceptional and rooms spotless.",
      categories: {
        cleanliness: 5,
        service: 5,
        location: 5,
        value: 4,
        amenities: 5,
      },
      is_verified: true,
      helpful_count: 12,
    }]);
  }
  if (completed[1]) {
    await supabase.from("reviews").insert([{
      user_id: completed[1].user_id,
      hotel_id: completed[1].hotel_id,
      booking_id: completed[1]._id,
      rating: 4,
      comment: "Solid value near the attractions. Breakfast could be stronger.",
      categories: {
        cleanliness: 4,
        service: 4,
        location: 5,
        value: 4,
        amenities: 3,
      },
      is_verified: false,
      helpful_count: 3,
    }]);
  }

  for (const hotel of [hotelA, hotelB]) {
    const { data: reviews } = await supabase.from("reviews").select("rating").eq("hotel_id", hotel._id);
    if (reviews && reviews.length) {
      const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
      await supabase.from("hotels").update({
        review_count: reviews.length,
        average_rating: avg
      }).eq("_id", hotel._id);
    }
  }

  console.log("Seeding analytics snapshot (full metrics + breakdown)…");
  await supabase.from("analytics").insert([{
    date: new Date().toISOString(),
    metrics: {
      totalBookings: savedBookings.length,
      totalRevenue: paidActive.reduce((s, b) => s + (b.total_cost || 0), 0),
      totalUsers: 3,
      totalHotels: 3,
      averageBookingValue: 250,
      conversionRate: 62.5,
      cancellationRate: 25,
      averageRating: 4.5,
    },
    breakdown: {
      byStatus: {
        pending: 2,
        confirmed: 1,
        cancelled: 2,
        completed: 2,
        refunded: 1,
      },
      byPaymentStatus: {
        pending: 1,
        paid: 4,
        failed: 1,
        refunded: 2,
      },
      byDestination: [
        { city: "London", bookings: 4, revenue: 1800 },
        { city: "Edinburgh", bookings: 3, revenue: 570 },
        { city: "Liverpool", bookings: 1, revenue: 0 },
      ],
      byHotelType: [
        { type: "Boutique", bookings: 4, revenue: 1800 },
        { type: "Budget", bookings: 3, revenue: 570 },
        { type: "Apartment", bookings: 1, revenue: 0 },
      ],
    },
  }]);

  await supabase.from("users").update({
    total_bookings: paidActive.filter((b) => b.user_id === guest._id).length,
    total_spent: paidActive.filter((b) => b.user_id === guest._id).reduce((s, b) => s + (b.total_cost || 0), 0)
  }).eq("_id", guest._id);

  await supabase.from("users").update({
    total_bookings: paidActive.filter((b) => b.user_id === admin._id).length,
    total_spent: paidActive.filter((b) => b.user_id === admin._id).reduce((s, b) => s + (b.total_cost || 0), 0)
  }).eq("_id", admin._id);

  console.log("Seed complete.");
  console.log("  Admin login: test@user.com / 12345678 (role=admin)");
  console.log("  Owner login: owner@hotel.com / 12345678");
  console.log("  Guest login: guest@user.com / 12345678");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
