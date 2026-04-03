/**
 * String sanitization utilities
 *
 * PostgreSQL text columns reject null bytes (0x00). These can appear when
 * users copy-paste text from PDFs, Word documents, or other rich sources.
 *
 * @module lib/shared/sanitize
 */

/**
 * Remove null bytes from a string.
 * PostgreSQL raises `invalid byte sequence for encoding "UTF8": 0x00`
 * when a text column receives a string containing \0.
 */
export function stripNullBytes(value: string): string {
    return value.replace(/\x00/g, "");
}

/**
 * Recursively strip null bytes from all string values in a plain object,
 * array, or primitive. Non-string values are returned as-is.
 */
export function sanitizeStrings<T>(value: T): T {
    if (typeof value === "string") {
        return stripNullBytes(value) as T;
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeStrings) as T;
    }
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = sanitizeStrings(v);
        }
        return result as T;
    }
    return value;
}
