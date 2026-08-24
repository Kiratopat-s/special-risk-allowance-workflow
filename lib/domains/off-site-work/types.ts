export interface ParticipantListItem {
  userId: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  position: string | null;
  positionShort?: string | null;
  positionLevel?: string | null;
  departmentId: string | null;
  departmentName: string | null;
}

export interface ResolvedParticipant {
  userId: string;
  employeeIdSnapshot: string | null;
  firstNameSnapshot: string;
  lastNameSnapshot: string;
  positionSnapshot: string | null;
  positionShortSnapshot: string | null;
  positionLevelSnapshot: string | null;
  departmentIdSnapshot: string | null;
  departmentNameSnapshot: string | null;
}

export interface OffSiteWorkEntity {
  id: string;
  innerRefDocumentId: string | null;
  startDate: Date;
  endDate: Date;
  objective: string | null;
  location: string | null;
  participants: ResolvedParticipant[];
  /** UI-friendly projection of the normalized participant rows. */
  participantList: ParticipantListItem[];
  postedAt: Date;
  postedByUserId: string;
  updatedAt: Date | null;
  deletedAt: Date | null;
  lockedAt: Date | null;
  originalFileId: string | null;
  supersedesId: string | null;
  leaderUserId: string | null;
  leaderEmpId: string | null;
  leaderFirstName: string | null;
  leaderLastName: string | null;
  leaderPosition: string | null;
  leaderEmail: string | null;
}

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
  leaderUser: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
    position: string | null;
  } | null;
}

export interface CreateOffSiteWorkInput {
  id: string;
  innerRefDocumentId?: string;
  startDate: Date | string;
  endDate: Date | string;
  objective?: string;
  location?: string;
  participantUserIds: string[];
  originalFileId?: string;
  supersedesId?: string | null;
  leaderUserId?: string | null;
  leaderEmpId?: string | null;
  leaderFirstName?: string | null;
  leaderLastName?: string | null;
  leaderPosition?: string | null;
  leaderEmail?: string | null;
}

export interface UpdateOffSiteWorkInput {
  innerRefDocumentId?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
  objective?: string | null;
  location?: string | null;
  participantUserIds?: string[];
  originalFileId?: string | null;
  leaderUserId?: string | null;
  leaderEmpId?: string | null;
  leaderFirstName?: string | null;
  leaderLastName?: string | null;
  leaderPosition?: string | null;
  leaderEmail?: string | null;
}

export interface OffSiteWorkFilterCriteria {
  search?: string;
  postedByUserId?: string;
  participantUserId?: string;
  startDateFrom?: Date | string;
  startDateTo?: Date | string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}
