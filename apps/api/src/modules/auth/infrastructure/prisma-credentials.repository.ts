import { Injectable } from "@nestjs/common";
import { Prisma, type User as UserRow } from "@prisma/client";

import { type CredentialsRepository } from "../domain/credentials";
import { EmailTakenError } from "../../../common/errors/errors";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type User } from "../../users/domain/user.entity";

const toDomain = (row: UserRow): User => ({
  id: row.id,
  externalAuthId: row.externalAuthId,
  email: row.email,
  fullName: row.fullName,
  locale: row.locale,
  role: row.role,
  status: row.status,
  createdAt: row.createdAt,
  lastSeenAt: row.lastSeenAt,
});

/** The only code that reads or writes `passwordHash`. */
@Injectable()
export class PrismaCredentialsRepository implements CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<{ user: User; passwordHash: string | null } | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    });
    return row ? { user: toDomain(row), passwordHash: row.passwordHash } : null;
  }

  async create(input: {
    email: string;
    fullName: string | null;
    passwordHash: string;
    externalAuthId: string;
  }): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash: input.passwordHash,
          externalAuthId: input.externalAuthId,
          // Never from the request: every signup is a plain, active user.
          role: "USER",
          status: "ACTIVE",
        },
      });
      return toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new EmailTakenError();
      }
      throw error;
    }
  }
}
