/**
 * Signature Domain – Service Layer
 *
 * @module lib/domains/signature/service
 */

import { signatureRepository } from "./repository";
import { success, error } from "@/lib/shared/types";
import type { Result } from "@/lib/shared/types";
import type {
    SignatureEntity,
    CreateSignatureInput,
    UpdateSignatureInput,
    SignatureViewModel,
    SignaturePageState,
} from "./types";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB

function toViewModel(sig: SignatureEntity): SignatureViewModel {
    return {
        id: sig.id,
        isActive: sig.isActive,
        activatedAt: sig.activatedAt,
        createdAt: sig.createdAt,
        updatedAt: sig.updatedAt,
        dataUrl: `data:image/png;base64,${Buffer.from(sig.signatureData).toString("base64")}`,
    };
}

function validateBuffer(buf: Buffer): Result<void> {
    if (!buf || buf.length === 0) {
        return error("Signature data is empty", "EMPTY_DATA");
    }
    if (buf.length > MAX_SIGNATURE_BYTES) {
        return error("Signature image is too large (max 2 MB)", "TOO_LARGE");
    }
    return success(undefined);
}

export const signatureService = {
    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    async getPageState(userId: string): Promise<Result<SignaturePageState>> {
        const history = await signatureRepository.findHistoryByUserId(userId);
        const viewModels = history.map(toViewModel);
        return success({
            active: viewModels.find((v) => v.isActive) ?? null,
            history: viewModels,
        });
    },

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    async create(
        userId: string,
        data: CreateSignatureInput
    ): Promise<Result<SignatureViewModel>> {
        const validation = validateBuffer(data.signatureData);
        if (!validation.success) return validation as Result<SignatureViewModel>;

        const entity = await signatureRepository.create(userId, data);
        return success(toViewModel(entity));
    },

    async update(
        signatureId: string,
        userId: string,
        data: UpdateSignatureInput
    ): Promise<Result<SignatureViewModel>> {
        const validation = validateBuffer(data.signatureData);
        if (!validation.success) return validation as Result<SignatureViewModel>;

        const existing = await signatureRepository.findOwnedById(signatureId, userId);
        if (!existing) {
            return error("Signature not found", "NOT_FOUND");
        }

        const entity = await signatureRepository.updateData(signatureId, data);
        return success(toViewModel(entity));
    },

    async activate(
        signatureId: string,
        userId: string
    ): Promise<Result<SignatureViewModel>> {
        const existing = await signatureRepository.findOwnedById(signatureId, userId);
        if (!existing) {
            return error("Signature not found", "NOT_FOUND");
        }
        if (existing.isActive) {
            return success(toViewModel(existing)); // already active, no-op
        }

        const entity = await signatureRepository.activate(signatureId, userId);
        return success(toViewModel(entity));
    },

    async softDelete(
        signatureId: string,
        userId: string
    ): Promise<Result<void>> {
        const existing = await signatureRepository.findOwnedById(signatureId, userId);
        if (!existing) {
            return error("Signature not found", "NOT_FOUND");
        }

        await signatureRepository.softDelete(signatureId);
        return success(undefined);
    },
};
