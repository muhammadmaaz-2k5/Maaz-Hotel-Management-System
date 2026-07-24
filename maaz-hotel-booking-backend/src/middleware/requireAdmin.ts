import { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase";

/**
 * Requires verifyToken first. Loads User.role from DB (JWT has userId only).
 */
const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { data: user } = await supabase.from("users").select("role").eq("_id", req.userId).single();
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Unable to verify admin" });
  }
};

export default requireAdmin;
