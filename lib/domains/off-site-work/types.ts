/**
 * OffSiteWork Domain - Entity Types
 *
 * Pure domain types for OffSiteWork entity
 *
 * @module lib/domains/off-site-work/types
 */

/**
 * Core OffSiteWork entity interface
 */
export interface OffSiteWorkEntity {
  id: string;
  innerRefDocumentId: string | null;
  startDate: Date;
  endDate: Date;
  objective: string | null;
  location: string | null;
  employeeList: unknown | null;
  postedAt: Date;
  postedByUserId: string;
  updatedAt: Date | null;
  deletedAt: Date | null;
  originalFileId: string | null;
}

/**
 * OffSiteWork with user and file relations
 */
export interface OffSiteWorkWithRelations extends OffSiteWorkEntity {
  postedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string | null;
  };
  originalFile: {
    id: string;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
  } | null;
}

/**
 * Data required to create an off-site work record
 */
export interface CreateOffSiteWorkInput {
  id: string;
  innerRefDocumentId?: string;
  startDate: Date | string;
  endDate: Date | string;
  objective?: string;
  location?: string;
  employeeList?: unknown;
  originalFileId?: string;
}

/**
 * Data required to update an off-site work record
 */
export interface UpdateOffSiteWorkInput {
  innerRefDocumentId?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
  objective?: string | null;
  location?: string | null;
  employeeList?: unknown | null;
  originalFileId?: string | null;
}

/**
 * OffSiteWork filter criteria
 */
export interface OffSiteWorkFilterCriteria {
  search?: string;
  postedByUserId?: string;
  startDateFrom?: Date | string;
  startDateTo?: Date | string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}
