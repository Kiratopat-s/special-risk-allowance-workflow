/**
 * Signature Domain – Repository Layer
 *
 * @module lib/domains/signature/repository
 */

import { prisma } from "@/lib/db";
import type {
    SignatureEntity,
    SignatureHistoryItem,
    CreateSignatureInput,
    UpdateSignatureInput,
} from "./types";

const signatureHistorySelect = {
    id: true,
    isActive: true,
    activatedAt: true,
    createdAt: true,
    updatedAt: true,
} as const;

export const signatureRepository = {
    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /** The single active (non-deleted) signature for a user, or null. */
    async findActiveByUserId(userId: string): Promise<SignatureEntity | null> {
        return prisma.signature.findFirst({
            where: { userId, isActive: true, deletedAt: null },
        });
    },

    /**
     * All non-deleted signatures for a user, newest first.
     * Does NOT include the binary payload – use findSignatureDataOwnedById for that.
     */
    async findHistoryByUserId(userId: string): Promise<SignatureHistoryItem[]> {
        return prisma.signature.findMany({
            where: { userId, deletedAt: null },
            select: signatureHistorySelect,
            orderBy: { createdAt: "desc" },
        });
    },

    /** Find a non-deleted signature by id that belongs to the given user. */
    async findOwnedById(
        id: string,
        userId: string
    ): Promise<SignatureEntity | null> {
        return prisma.signature.findFirst({
            where: { id, userId, deletedAt: null },
        });
    },

    /** Return only the binary payload for an owned, non-deleted signature. */
    async findSignatureDataOwnedById(
        id: string,
        userId: string
    ): Promise<Uint8Array | null> {
        const result = await prisma.signature.findFirst({
            where: { id, userId, deletedAt: null },
            select: { signatureData: true },
        });
        return (result?.signatureData as Uint8Array | undefined) ?? null;
    },

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Create a new signature record and atomically set it as active,
     * deactivating any previous active record for the same user.
     */
    async create(
        userId: string,
        data: CreateSignatureInput
    ): Promise<SignatureEntity> {
        return prisma.$transaction(async (tx) => {
            await tx.signature.updateMany({
                where: { userId, isActive: true, deletedAt: null },
                data: { isActive: false },
            });

            return tx.signature.create({
                data: {
                    userId,
                    signatureData: new Uint8Array(data.signatureData),
                    isActive: true,
                    activatedAt: new Date(),
                },
            });
        });
    },

    /** Replace the binary data of an existing signature record. */
    async updateData(
        id: string,
        data: UpdateSignatureInput
    ): Promise<SignatureEntity> {
        return prisma.signature.update({
            where: { id },
            data: { signatureData: new Uint8Array(data.signatureData) },
        });
    },

    /**
     * Set a specific signature as active, deactivating all other non-deleted
     * records for the same user – in a single transaction.
     */
    async activate(id: string, userId: string): Promise<SignatureEntity> {
        return prisma.$transaction(async (tx) => {
            await tx.signature.updateMany({
                where: { userId, isActive: true, deletedAt: null },
                data: { isActive: false },
            });

            return tx.signature.update({
                where: { id },
                data: { isActive: true, activatedAt: new Date() },
            });
        });
    },

    /** Soft-delete: sets deletedAt and clears isActive so it never appears as active. */
    async softDelete(id: string): Promise<SignatureEntity> {
        return prisma.signature.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    },
};
