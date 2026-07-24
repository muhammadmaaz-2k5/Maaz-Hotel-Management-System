-- Run this in your Supabase SQL Editor

-- 1. Create Users Table
CREATE TABLE users (
    _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    image TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'hotel_owner')),
    phone TEXT,
    address JSONB,
    preferences JSONB,
    total_bookings INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Hotels Table
CREATE TABLE hotels (
    _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT[] NOT NULL,
    adult_count INTEGER NOT NULL,
    child_count INTEGER NOT NULL,
    facilities TEXT[] NOT NULL,
    price_per_night NUMERIC NOT NULL,
    star_rating INTEGER NOT NULL,
    image_urls TEXT[] NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location JSONB,
    contact JSONB,
    policies JSONB,
    amenities JSONB,
    total_bookings INTEGER DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    average_rating NUMERIC DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    occupancy_rate NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    upcoming_bookings INTEGER DEFAULT 0,
    completed_bookings INTEGER DEFAULT 0,
    cancelled_bookings INTEGER DEFAULT 0
);

-- 3. Create Bookings Table
CREATE TABLE bookings (
    _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hotels(_id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    adult_count INTEGER NOT NULL,
    child_count INTEGER NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,
    total_cost NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'refunded')),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method TEXT,
    special_requests TEXT,
    cancellation_reason TEXT,
    refund_amount NUMERIC,
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Reviews Table
CREATE TABLE reviews (
    _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES hotels(_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    categories JSONB NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $DO$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$DO$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. Create Analytics Table
CREATE TABLE analytics (
    _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metrics JSONB NOT NULL,
    breakdown JSONB NOT NULL
);
