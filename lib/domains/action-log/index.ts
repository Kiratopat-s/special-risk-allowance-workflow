/**
 * Action Log Domain - Public API
 * 
 * Exports all public types and services from the Action Log domain
 * 
 * @module lib/domains/action-log
 */

// Types
export type {
    ActionLogEntity,
    ActionLogWithDetails,
    CreateActionLogInput,
    ActionLogFilterCriteria,
    ActionLogSummary,
} from "./types";

// Repository (for advanced use cases only)
export { actionLogRepository } from "./repository";

// Service (primary API)
export { actionLogService } from "./service";
