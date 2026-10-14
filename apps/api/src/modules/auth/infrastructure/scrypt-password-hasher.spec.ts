import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./scrypt-password-hasher";

const hasher = new ScryptPasswordHasher();

describe("ScryptPasswordHasher", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hasher.hash("correct horse battery");
    expect(stored.startsWith("scrypt$32768$8$1$")).toBe(true);
    await expect(hasher.verify("correct horse battery", stored)).resolves.toBe(true);
    await expect(hasher.verify("correct horse batterY", stored)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("same password")).not.toBe(await hasher.hash("same password"));
  });

  it("returns false for a malformed stored hash instead of throwing", async () => {
    await expect(hasher.verify("x", "not-a-hash")).resolves.toBe(false);
  });
});
