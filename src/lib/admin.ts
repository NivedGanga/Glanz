import { NextRequest } from "next/server";
import { safeEqual } from "./auth";
export function requireAdmin(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN;
  const actual = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !actual || !safeEqual(expected, actual)) throw new Error("FORBIDDEN");
  return "admin";
}
