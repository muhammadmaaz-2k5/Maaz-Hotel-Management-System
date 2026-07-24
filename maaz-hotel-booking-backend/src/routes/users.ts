import express, { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { check, validationResult } from "express-validator";
import verifyToken from "../middleware/auth";
import requireAdmin from "../middleware/requireAdmin";
import { authCookieOptions } from "../lib/cookie-options";

const router = express.Router();

router.get("/me", verifyToken, async (req: Request, res: Response) => {
  const userId = req.userId;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("email, first_name, last_name, role, is_active") // Exclude password
      .eq("_id", userId)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
  }
});

/**
 * Admin: list users (no passwords).
 * GET /api/users
 */
router.get(
  "/",
  verifyToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("email, first_name, last_name, role, is_active, total_bookings, total_spent, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      res.json(users);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to fetch users" });
    }
  }
);

/**
 * Admin: update user role.
 * PATCH /api/users/:id/role
 * Body: { role: "user" | "admin" | "hotel_owner" }
 */
router.patch(
  "/:id/role",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    const allowed = ["user", "admin", "hotel_owner"] as const;
    const role = req.body?.role;
    if (!allowed.includes(role)) {
      return res.status(400).json({
        message: `role must be one of: ${allowed.join(", ")}`,
      });
    }

    try {
      if (req.params.id === req.userId && role !== "admin") {
        return res.status(400).json({
          message: "Cannot demote your own admin role",
        });
      }

      const { data: user, error } = await supabase
        .from("users")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("_id", req.params.id)
        .select("email, first_name, last_name, role, is_active")
        .single();

      if (error || !user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Unable to update role" });
    }
  }
);

router.post(
  "/register",
  [
    check("firstName", "First Name is required").isString(),
    check("lastName", "Last Name is required").isString(),
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("_id")
        .eq("email", req.body.email)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 8);

      const { data: newUser, error } = await supabase
        .from("users")
        .insert([{
          email: req.body.email,
          first_name: req.body.firstName,
          last_name: req.body.lastName,
          password: hashedPassword
        }])
        .select("_id")
        .single();

      if (error || !newUser) {
        throw error || new Error("Failed to create user");
      }

      const token = jwt.sign(
        { userId: newUser._id },
        process.env.JWT_SECRET_KEY as string,
        {
          expiresIn: "1d",
        }
      );

      res.cookie("auth_token", token, authCookieOptions());
      return res.status(200).send({ message: "User registered OK" });
    } catch (error) {
      console.log(error);
      res.status(500).send({ message: "Something went wrong" });
    }
  }
);

export default router;
