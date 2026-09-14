"use client";

import { useState, useTransition } from "react";
import { runServerAction } from "@/lib/deployment/client";
import { DEPLOYMENT_VERSION } from "@/lib/deployment/version";
import { saveFixture } from "./action";

export default function DeploymentFixture() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <main className="mx-auto max-w-xl space-y-5 p-8">
      <h1 className="text-2xl font-bold">Deployment recovery validation</h1>
      <p>Browser build: {DEPLOYMENT_VERSION}</p>
      <label className="block">Draft text
        <input className="mt-2 block w-full rounded border p-3" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button className="rounded bg-purple-800 px-4 py-2 text-white" disabled={pending} onClick={() => startTransition(async () => {
        const result = await runServerAction(() => saveFixture(value));
        if (result === undefined) return;
        setSaved(JSON.stringify(result));
        setValue("");
      })}>Submit fixture</button>
      <output className="block">{saved || "No submission"}</output>
    </main>
  );
}
