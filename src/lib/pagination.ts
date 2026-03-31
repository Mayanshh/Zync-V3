export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

/**
 * Generates a Prisma-compatible pagination object.
 * Uses conditional spreading to satisfy 'exactOptionalPropertyTypes: true'.
 */
export function getPagination(cursor?: string, limit = 10) {
  const safeLimit = Math.min(limit, 50); // Security: Prevent massive DB scans

  return {
    take: safeLimit,
    orderBy: { createdAt: 'desc' as const },
    // 🔥 The Spread Fix: If no cursor, these keys literally do not exist in the object.
    ...(cursor && {
      skip: 1, // Skip the cursor itself to get the next set of results
      cursor: { id: cursor },
    }),
  };
}

/**
 * Standardizes the response for the frontend.
 * Ensures the 'nextCursor' is extracted safely.
 */
export function formatPaginatedResponse<T extends { id: string }>(
  data: T[], 
  limit: number
) {
  const hasMore = data.length === limit;
  // Use optional chaining to avoid "Object is possibly undefined"
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return {
    success: true,
    data,
    meta: {
      nextCursor,
      hasMore,
      count: data.length
    }
  };
}