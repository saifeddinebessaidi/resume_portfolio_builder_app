import { describe, expect, it } from "vitest";

import { type AppConfigService } from "../../config/app-config.service";
import { PasswordJwtVerifier } from "./password-jwt.verifier";

const config = (secret: string) =>
  ({ authJwtSecret: secret, authTokenTtlSeconds: 3600 }) as AppConfigService;

describe("PasswordJwtVerifier", () => {
  it("verifies the tokens it issues", async () => {
    const verifier = new PasswordJwtVerifier(config("a".repeat(40)));
    const { accessToken, expiresIn } = await verifier.issue({
      externalAuthId: "pwd_1",
      email: "a@example.com",
    });
    expect(expiresIn).toBe(3600);
    await expect(verifier.verify(accessToken)).resolves.toEqual({
      externalAuthId: "pwd_1",
      email: "a@example.com",
    });
  });

  it("rejects a token signed with another secret", async () => {
    const { accessToken } = await new PasswordJwtVerifier(config("a".repeat(40))).issue({
      externalAuthId: "pwd_1",
      email: "a@example.com",
    });
    await expect(
      new PasswordJwtVerifier(config("b".repeat(40))).verify(accessToken),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});
