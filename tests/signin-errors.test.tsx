// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { signIn } from "next-auth/react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignInClient } from "@/app/auth/signin/signin-client";
import SignInPage from "@/app/auth/signin/page";
import { EMPLOYEE_ID_ALREADY_LINKED, EMPLOYEE_ID_ALREADY_LINKED_MESSAGE } from "@/lib/domains/user/errors";

afterEach(cleanup);

it("shows the specific employee binding warning and lets the user sign in with another account", async () => {
  render(<SignInClient callbackUrl="/dashboard" error={EMPLOYEE_ID_ALREADY_LINKED} />);
  expect(screen.getByRole("alert").textContent).toBe(EMPLOYEE_ID_ALREADY_LINKED_MESSAGE);

  await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบด้วย Keycloak" }));
  expect(signIn).toHaveBeenCalledWith("keycloak", { callbackUrl: "/dashboard" }, { prompt: "login" });
});

it.each(["AccessDenied", "Configuration", "unknown@example.test"])("keeps other auth failures generic (%s)", (error) => {
  render(<SignInClient callbackUrl="/dashboard" error={error} />);
  expect(screen.getByRole("alert").textContent).toContain("ไม่สามารถ");
  expect(screen.getByRole("alert").textContent).not.toContain("ผูกใช้งาน");
  expect(screen.getByRole("alert").textContent).not.toContain(error);
});

it("keeps normal sign-in without a warning or forced login prompt", async () => {
  render(<SignInClient callbackUrl="/profile" />);
  expect(screen.queryByRole("alert")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบด้วย Keycloak" }));
  expect(signIn).toHaveBeenCalledWith("keycloak", { callbackUrl: "/profile" }, undefined);
});

it("does not hide a rejected sign-in behind a previously active session", async () => {
  vi.mocked(auth).mockResolvedValue({ user: { dbUserId: "previous-user" } } as never);
  const page = await SignInPage({ searchParams: Promise.resolve({ error: EMPLOYEE_ID_ALREADY_LINKED }) });
  render(page);
  expect(redirect).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe(EMPLOYEE_ID_ALREADY_LINKED_MESSAGE);
});
