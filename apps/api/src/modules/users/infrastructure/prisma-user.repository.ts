import { Injectable } from "@nestjs/common";
import { type User as PrismaUser } from "@prisma/client";

import { NotFoundError } from "../../../common/errors/errors";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type User } from "../domain/user.entity";
import {
  type ProvisionUserInput,
  type UpdateProfileInput,
  type UserRepository,
} from "../domain/user.repository";

/**
 * The Prisma implementation of `UserRepository`.
 *
 * This is the boundary: Prisma row types come in, domain entities go out. Nothing above this file
 * knows Prisma exists, which is why `domain/` and `application/` can be unit-tested with an
 * in-memory fake and why replacing Prisma would touch this file and not the use cases.
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The mapping boundary: a Prisma row in, a domain entity out.
   *
   * The enum fields need no cast because Prisma generates the same string-union values the
   * contract declares — and the parity check in step 03 is what keeps that true.
   */
  private toDomain(row: PrismaUser): User {
    return {
      id: row.id,
      externalAuthId: row.externalAuthId,
      email: row.email,
      fullName: row.fullName,
      locale: row.locale,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
    };
  }

  async provision(input: ProvisionUserInput): Promise<User> {
    const row = await this.prisma.user.upsert({
      where: { externalAuthId: input.externalAuthId },
      create: {
        externalAuthId: input.externalAuthId,
        email: input.email,
        // Hardcoded, not taken from the identity: there is no code path from a token claim to a
        // role or to an un-suspension.
        role: "USER",
        status: "ACTIVE",
      },
      // `role` and `status` are deliberately absent. A returning user's privileges and any
      // suspension survive every subsequent login.
      update: { email: input.email },
    });

    return this.toDomain(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByExternalAuthId(externalAuthId: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { externalAuthId, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User> {
    // `deletedAt: null` in the filter, not just the id: a soft-deleted user must not be editable.
    // updateMany would silently no-op, so the row is read first and the absence reported honestly.
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError();

    const row = await this.prisma.user.update({
      where: { id },
      data: {
        // `exactOptionalPropertyTypes` makes the distinction real: an absent `fullName` leaves it
        // alone, an explicit `null` clears it. That is what PATCH semantics require.
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
      },
    });

    return this.toDomain(row);
  }

  async touchLastSeen(id: string, at: Date): Promise<void> {
    // updateMany rather than update: if the row has since been soft-deleted this must not throw,
    // because a liveness timestamp is never worth failing a request over.
    await this.prisma.user.updateMany({ where: { id }, data: { lastSeenAt: at } });
  }
}
