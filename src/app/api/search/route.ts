import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guarded } from "../../../lib/http";
import { search } from "../../../lib/search";
const query = z.object({
  districtId: z.string().uuid(), eventStart: z.string(), returnEnd: z.string(),
  keyword: z.string().max(120).optional(), categoryId: z.string().uuid().optional(),
  size: z.string().optional(), colour: z.string().optional(),
  priceMaxPaise: z.coerce.number().int().nonnegative().optional(),
  ratingMin: z.coerce.number().min(0).max(5).optional(),
  maxDistanceKm: z.coerce.number().positive().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});
export async function GET(req: NextRequest) {
  return guarded("customer.search", async () => {
    const input = query.parse(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json({ results: await search(input) });
  });
}
