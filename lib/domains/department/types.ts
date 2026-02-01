/**
 * Department Domain - Entity Types
 * 
 * Pure domain types for Department entity
 * 
 * @module lib/domains/department/types
 */

/**
 * Core Department entity interface
 */
export interface DepartmentEntity {
    id: string;
    name: string;
    shortName: string | null;
    description: string | null;
    parentId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Department with hierarchy information
 */
export interface DepartmentWithHierarchy extends DepartmentEntity {
    parent: {
        id: string;
        name: string;
        shortName: string | null;
    } | null;
    children: {
        id: string;
        name: string;
        shortName: string | null;
    }[];
    _count?: {
        users: number;
    };
}

/**
 * Department tree node for hierarchical display
 */
export interface DepartmentTreeNode extends DepartmentEntity {
    children: DepartmentTreeNode[];
    userCount: number;
}

/**
 * Data required to create a department
 */
export interface CreateDepartmentInput {
    name: string;
    shortName?: string;
    description?: string;
    parentId?: string;
}

/**
 * Data required to update a department
 */
export interface UpdateDepartmentInput {
    name?: string;
    shortName?: string;
    description?: string;
    parentId?: string | null;
    isActive?: boolean;
}

/**
 * Department filter criteria
 */
export interface DepartmentFilterCriteria {
    search?: string;
    isActive?: boolean;
    parentId?: string | null;
    page?: number;
    pageSize?: number;
}
