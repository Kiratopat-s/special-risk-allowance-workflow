/**
 * OffSiteWork Domain - Public API
 *
 * Exports all public types and services from the OffSiteWork domain
 *
 * @module lib/domains/off-site-work
 */

// Types
export type {
  ParticipantListItem,
  OffSiteWorkEntity,
  OffSiteWorkWithRelations,
  CreateOffSiteWorkInput,
  UpdateOffSiteWorkInput,
  OffSiteWorkFilterCriteria,
} from "./types";

// Repository (for advanced use cases only)
export { offSiteWorkRepository } from "./repository";

// Service (primary API)
export { offSiteWorkService } from "./service";
