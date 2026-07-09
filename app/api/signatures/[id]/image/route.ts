import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signatureRepository } from "@/lib/domains/signature/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    const userId = session?.user?.dbUserId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: "Signature not found" }, { status: 404 });
    }

    const signatureData = await signatureRepository.findSignatureDataOwnedById(
        id,
        userId
    );

    if (!signatureData) {
        return NextResponse.json({ error: "Signature not found" }, { status: 404 });
    }

    return new Response(Buffer.from(signatureData), {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=300",
        },
    });
}
