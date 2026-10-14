/**
 * Sets (or resets) the password of an EXISTING account, for AUTH_PROVIDER=password.
 *
 * Accounts created through dev sign-in or Supabase have no password. Sign-up refuses their email
 * (it is taken), so this is how an existing admin gets one:
 *
 *   pnpm --filter @repo/api set-password admin@example.com
 *
 * The password is read from the PASSWORD env var or prompted for, never from argv, so it does not
 * land in shell history.
 */
import { createInterface } from "node:readline/promises";

import { PrismaClient } from "@prisma/client";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@repo/contracts";
import { config as loadDotenv } from "dotenv";

import { ScryptPasswordHasher } from "../src/modules/auth/infrastructure/scrypt-password-hasher";

loadDotenv();

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: set-password <email>");

  let password = process.env.PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("New password: ");
    rl.close();
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    });
    if (!user) throw new Error(`No account for ${email}.`);

    const passwordHash = await new ScryptPasswordHasher().hash(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    console.log(`Password set for ${user.email} (${user.role}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
