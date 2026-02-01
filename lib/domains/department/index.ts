/**
 * Department Domain - Public API
 * 
 * Exports all public types and services from the Department domain
 * 
 * @module lib/domains/department
 */

// Types
export type {
    DepartmentEntity,
    DepartmentWithHierarchy,
    DepartmentTreeNode,
    CreateDepartmentInput,
    UpdateDepartmentInput,
    DepartmentFilterCriteria,
} from "./types";

// Repository (for advanced use cases only)
export { departmentRepository } from "./repository";

// Service (primary API)
export { departmentService } from "./service";
