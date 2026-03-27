import { auth } from "@/lib/auth";
import { getMySignatureState } from "@/app/actions/user-signature";
import { SignatureClient } from "./signature-client";

export default async function SignaturePage() {
  const session = await auth();
  const result = await getMySignatureState();

  return (
    <SignatureClient
      initialState={result.success ? result.data : null}
      userName={session?.user?.name}
    />
  );
}
