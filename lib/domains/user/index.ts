/**
 * User Domain - Public API
 * 
 * Exports all public types and services from the User domain
 * 
 * @module lib/domains/user
 */

// Types
export type {
    UserEntity,
    UserWithDepartment,
    KeycloakUserProfile,
    CreateUserInput,
    UpdateUserInput,
    UserFilterCriteria,
} from "./types";

// Repository (for advanced use cases only)
export { userRepository } from "./repository";

// Service (primary API)
export { userService } from "./service";
