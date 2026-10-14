import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

import { type PasswordHasher } from "../domain/credentials";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

// N=2^15, r=8, p=1: OWASP's scrypt baseline. ~32MB per hash, so maxmem is raised above Node's 32MB default.
const N = 32_768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 64 * 1024 * 1024;

/**
 * scrypt from `node:crypto` rather than bcrypt/argon2 packages: no native build step, and nothing
 * for Railway's devDependency pruning to strip. Parameters are stored in the hash so they can be
 * raised later without invalidating existing passwords.
 *
 * Format: `scrypt$N$r$p$saltB64$hashB64`.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
    return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;

    const expected = Buffer.from(hashB64, "base64");
    const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });

    return key.length === expected.length && timingSafeEqual(key, expected);
  }
}
