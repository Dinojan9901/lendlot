import { NextResponse, type NextRequest } from "next/server";
import { parseCatalogueParams } from "@/lib/validation";
import { getCatalogue } from "@/server/catalog";

/** GET /api/items?q=&category=&page= — the public catalogue as JSON. */
export async function GET(request: NextRequest) {
  const params = parseCatalogueParams(Object.fromEntries(request.nextUrl.searchParams));
  const result = await getCatalogue(params);
  return NextResponse.json(result);
}
