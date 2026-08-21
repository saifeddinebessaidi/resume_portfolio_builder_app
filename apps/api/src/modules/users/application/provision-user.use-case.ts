import { Inject, Injectable } from "@nestjs/common";

import { type User } from "../domain/user.entity";
import {
  USER_REPOSITORY,
  type ProvisionUserInput,
  type UserRepository,
} from "../domain/user.repository";

/** How long a resolved user is reused before the database is consulted again. */
const CACHE_TTL_MS = 60_000;
/** How stale `lastSeenAt` may get. Precision here buys nothing; writes cost a Neon connection. */
const LAST_SEEN_INTERVAL_MS = 60 * 60_000;

interface CacheEntry {
  user: User;
  cachedAt: number;
  lastSeenWrittenAt: number;
}

/**
 * Just-in-time provisioning: the first authenticated request from an identity creates its local
 * mirror. We never create users ourselves — the identity provider owns that event, and there is no
 * signup endpoint here.
 *
 * **Why the cache.** Without it the upsert runs on every authenticated request, which is one write
 * per request even for a user who has existed for months. On Neon's free tier that is a connection
 * and a WAL record for no information gained. A 60-second TTL keeps a suspension taking effect
 * within a minute, which is the right trade for an operation that is not urgent.
 *
 * In-process, so it is per-instance. Fine while the API runs as one instance; the phase 10 runbook
 * notes it as the first thing to move to Redis if that changes.
 *
 * It takes `ProvisionUserInput` — a domain type — rather than the auth port's `VerifiedIdentity`.
 * The two are structurally identical, but importing the latter would make this use case depend on
 * `infrastructure/auth/`, and the point of the layering is that application/ never reaches past its
 * own interfaces. The guard passes the identity across that boundary; nothing here knows a token
 * was involved.
 */
@Injectable()
export class ProvisionUserUseCase {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(identity: ProvisionUserInput): Promise<User> {
    const now = Date.now();
    const cached = this.cache.get(identity.externalAuthId);

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      // The email on the token wins if the provider's copy has changed — that is the one field
      // worth invalidating the cache for, since it is what the user sees in the UI.
      if (cached.user.email === identity.email) {
        await this.maybeTouchLastSeen(cached, now);
        return cached.user;
      }
    }

    const user = await this.users.provision(identity);

    this.cache.set(identity.externalAuthId, {
      user,
      cachedAt: now,
      lastSeenWrittenAt: cached?.lastSeenWrittenAt ?? 0,
    });

    const entry = this.cache.get(identity.externalAuthId);
    if (entry) await this.maybeTouchLastSeen(entry, now);

    return user;
  }

  /** Drops a user from the cache so the next request re-reads them — used after an admin write. */
  invalidate(externalAuthId: string): void {
    this.cache.delete(externalAuthId);
  }

  private async maybeTouchLastSeen(entry: CacheEntry, now: number): Promise<void> {
    if (now - entry.lastSeenWrittenAt < LAST_SEEN_INTERVAL_MS) return;

    entry.lastSeenWrittenAt = now;
    await this.users.touchLastSeen(entry.user.id, new Date(now));
  }
}
