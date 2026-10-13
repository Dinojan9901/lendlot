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

type PrismaAdapterError = {
  meta?: { driverAdapterError?: { cause?: { code?: string; message?: string } } };
};

/**
 * True when Postgres rejected a write because of the named exclusion
 * constraint. With Prisma's pg driver adapter the original Postgres error
 * (SQLSTATE + message) is found at meta.driverAdapterError.cause.
 */
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  const cause = (error as PrismaAdapterError | null)?.meta?.driverAdapterError?.cause;
  return cause?.code === EXCLUSION_VIOLATION && (cause.message ?? "").includes(constraint);
}
