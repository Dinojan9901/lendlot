import { beforeEach, describe, expect, it, vi } from "vitest";

// Deadlocks between concurrent inserts are timing-dependent, so the retry
// logic is tested deterministically here with a mocked Prisma client.
const db = vi.hoisted(() => ({
  item: { findFirst: vi.fn() },
  booking: { create: vi.fn() },
}));
vi.mock("./db", () => ({ prisma: db }));

const { createBooking } = await import("./bookings");
const { DomainError } = await import("./errors");

const pgError = (code: string, message = "") => ({
  name: "PrismaClientKnownRequestError",
  meta: { driverAdapterError: { cause: { code, message } } },
});

const input = { itemId: "item_1", renterId: "user_1", startDate: "2026-11-01", endDate: "2026-11-02" };

describe("createBooking error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.item.findFirst.mockResolvedValue({ id: "item_1", ownerId: "owner_1", dailyPriceCents: 1000 });
  });

  it("retries after a deadlock and then succeeds", async () => {
    db.booking.create.mockRejectedValueOnce(pgError("40P01")).mockResolvedValueOnce({ id: "b1" });
    await expect(createBooking(input)).resolves.toEqual({ id: "b1" });
    expect(db.booking.create).toHaveBeenCalledTimes(2);
  });

  it("turns an exclusion violation after a retry into CONFLICT", async () => {
    db.booking.create
      .mockRejectedValueOnce(pgError("40P01"))
      .mockRejectedValueOnce(pgError("23P01", 'violates exclusion constraint "booking_no_overlap"'));
    const error = await createBooking(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DomainError);
    expect((error as InstanceType<typeof DomainError>).code).toBe("CONFLICT");
  });

  it("gives up after three deadlocks instead of looping forever", async () => {
    db.booking.create.mockRejectedValue(pgError("40P01"));
    await expect(createBooking(input)).rejects.toMatchObject({ meta: expect.anything() });
    expect(db.booking.create).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated errors", async () => {
    db.booking.create.mockRejectedValue(pgError("23503"));
    await expect(createBooking(input)).rejects.toBeDefined();
    expect(db.booking.create).toHaveBeenCalledTimes(1);
  });

  it("charges the server-computed price, never a client value", async () => {
    db.booking.create.mockResolvedValue({ id: "b1" });
    await createBooking(input);
    expect(db.booking.create.mock.calls[0][0].data.totalCents).toBe(2000);
  });
});
