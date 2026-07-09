/**
 * Signature Domain – Entity Types
 *
 * @module lib/domains/signature/types
 */

import type { Signature } from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------------------
// Core entity
// ---------------------------------------------------------------------------

export type SignatureEntity = Signature;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSignatureInput {
    /** Raw PNG bytes exported from the canvas */
    signatureData: Buffer;
}

export interface UpdateSignatureInput {
    signatureData: Buffer;
}

// ---------------------------------------------------------------------------
// Lightweight history item (for list views – no binary payload)
// ---------------------------------------------------------------------------

export interface SignatureHistoryItem {
    id: string;
    isActive: boolean;
    activatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Lightweight list item returned to pages (no binary/base64 payload)
// ---------------------------------------------------------------------------

export interface SignatureListItem extends SignatureHistoryItem {
    /** Authenticated route that streams the PNG bytes for this signature. */
    imageUrl: string;
}

// ---------------------------------------------------------------------------
// View model returned to the client (base64 data URL instead of raw bytes)
// ---------------------------------------------------------------------------

export interface SignatureViewModel {
    id: string;
    isActive: boolean;
    activatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
    /** data:image/png;base64,… ready to use in <img src> */
    dataUrl: string;
}

// ---------------------------------------------------------------------------
// Page state returned by getMySignatureState action
// ---------------------------------------------------------------------------

export interface SignaturePageState {
    active: SignatureListItem | null;
    history: SignatureListItem[];
}
