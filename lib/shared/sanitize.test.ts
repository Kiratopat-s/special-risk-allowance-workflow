import { describe, it, expect } from "vitest";
import { stripNullBytes, sanitizeStrings } from "./sanitize";

describe("stripNullBytes", () => {
  it("removes null bytes from string", () => {
    expect(stripNullBytes("hello\x00world")).toBe("helloworld");
  });

  it("removes multiple null bytes", () => {
    expect(stripNullBytes("\x00hello\x00world\x00")).toBe("helloworld");
  });

  it("returns string unchanged when no null bytes", () => {
    expect(stripNullBytes("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(stripNullBytes("")).toBe("");
  });
});

describe("sanitizeStrings", () => {
  it("strips null bytes from nested object strings", () => {
    const input = { name: "test\x00", nested: { value: "ok\x00" } };
    const result = sanitizeStrings(input);
    expect(result).toEqual({ name: "test", nested: { value: "ok" } });
  });

  it("strips null bytes from arrays", () => {
    const input = ["hello\x00", "world\x00"];
    const result = sanitizeStrings(input);
    expect(result).toEqual(["hello", "world"]);
  });

  it("leaves non-string values unchanged", () => {
    const date = new Date();
    const input = { count: 42, active: true, date, name: "test\x00" };
    const result = sanitizeStrings(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.date).toBe(date);
    expect(result.name).toBe("test");
  });

  it("handles null and undefined", () => {
    expect(sanitizeStrings(null)).toBe(null);
    expect(sanitizeStrings(undefined)).toBe(undefined);
  });
});
