/**
 * Shared Types - Common Result Types
 * 
 * Generic result types for consistent API responses across domains
 * 
 * @module lib/shared/types/result
 */

/**
 * Success result type
 */
export type SuccessResult<T> = {
    success: true;
    data: T;
    message?: string;
};

/**
 * Error result type
 */
export type ErrorResult = {
    success: false;
    error: string;
    code?: string;
    details?: Record<string, string[]>;
};

/**
 * Combined result type for operations
 */
export type Result<T> = SuccessResult<T> | ErrorResult;

/**
 * Paginated result type
 */
export type PaginatedResult<T> = {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
};

/**
 * Helper function to create success result
 */
export const success = <T>(data: T, message?: string): SuccessResult<T> => ({
    success: true,
    data,
    message,
});

/**
 * Helper function to create error result
 */
export const error = (
    errorMessage: string,
    code?: string,
    details?: Record<string, string[]>
): ErrorResult => ({
    success: false,
    error: errorMessage,
    code,
    details,
});
