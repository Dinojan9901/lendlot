export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "OWN_ITEM"
  | "INVALID";

/** An expected failure that is safe to show to the user. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const HTTP_STATUS: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  OWN_ITEM: 422,
  INVALID: 422,
};

/** Postgres SQLSTATE for "exclusion_violation". */
const EXCLUSION_VIOLATION = "23P01";
/** deadlock_detected and serialization_failure: safe to retry. */
const RETRYABLE = new Set(["40P01", "40001"]);

type PrismaAdapterError = {
  meta?: { driverAdapterError?: { cause?: { code?: string; message?: string } } };
};

/**
 * The original Postgres error behind a Prisma error. With Prisma's pg driver
 * adapter it is found at meta.driverAdapterError.cause.
 */
export function postgresError(error: unknown): { code?: string; message?: string } | undefined {
  return (error as PrismaAdapterError | null)?.meta?.driverAdapterError?.cause;
}

/** True when Postgres rejected a write because of the named exclusion constraint. */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  const cause = postgresError(error);
  return cause?.code === EXCLUSION_VIOLATION && (cause.message ?? "").includes(constraint);
}

/** Prisma's own code for "write conflict or deadlock, please retry". */
const PRISMA_WRITE_CONFLICT = "P2034";

/** True for transient concurrency errors where retrying the statement is safe. */
export function isRetryableConflict(error: unknown): boolean {
  return (
    (error as { code?: unknown } | null)?.code === PRISMA_WRITE_CONFLICT ||
    RETRYABLE.has(postgresError(error)?.code ?? "")
  );
}
