/**
 * Signature Domain – Public API
 *
 * @module lib/domains/signature
 */

export type {
    SignatureEntity,
    CreateSignatureInput,
    UpdateSignatureInput,
    SignatureHistoryItem,
    SignatureViewModel,
    SignaturePageState,
} from "./types";

export { signatureRepository } from "./repository";
export { signatureService } from "./service";
