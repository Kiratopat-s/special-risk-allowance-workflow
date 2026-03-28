/**
 * Shared Pagination Type
 *
 * Standard server-side pagination metadata returned by repository `findMany` calls.
 *
 * @module lib/shared/types/pagination
 */

export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}
