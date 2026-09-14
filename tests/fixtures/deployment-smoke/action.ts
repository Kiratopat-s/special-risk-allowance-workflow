"use server";

import { DEPLOYMENT_VERSION } from "@/lib/deployment/version";

let submissions = 0;

// Included only in the disposable validation image, never a normal app build.
export async function saveFixture(value: string) {
  submissions++;
  return { value, version: DEPLOYMENT_VERSION, submissions };
}
