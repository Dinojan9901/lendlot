import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEMS_TAG, itemTag } from "@/server/catalog";
import { handleRouteError, jsonError, readJson, validationError } from "@/server/http";
import { getItemById } from "@/server/items";
import { setListingActive } from "@/server/listings";
import { getCurrentUser } from "@/server/session";

/** GET /api/items/:id — one active item. */
export async function GET(_request: Request, { params }: RouteContext<"/api/items/[id]">) {
  const { id } = await params;
  const item = await getItemById(id);
  if (!item) return jsonError(404, "Item not found");
  return NextResponse.json(item);
}

const patchSchema = z.object({ isActive: z.boolean() }).strict();

/** PATCH /api/items/:id { isActive } — owner (or admin) hides/shows a listing. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/items/[id]">) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in required");

  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const { id } = await params;
  try {
    const item = await setListingActive(user, id, parsed.data.isActive);
    revalidateTag(itemTag(item.slug), "max");
    revalidateTag(ITEMS_TAG, "max");
    return NextResponse.json({ id: item.id, isActive: item.isActive });
  } catch (error) {
    return handleRouteError(error);
  }
}
