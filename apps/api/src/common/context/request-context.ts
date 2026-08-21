import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request state that logging and analytics need but that no function should have to accept
 * as a parameter.
 *
 * Without this, either every signature in the call chain grows a `ctx` argument — including
 * repository methods that have no business knowing about HTTP — or logs and analytics rows lose
 * their correlation to the request that produced them.
 */
export interface RequestStore {
  requestId: string;
  userId?: string;
  /** Present only where it is needed: the analytics IP hash. Never logged raw. */
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

/**
 * Returned outside any request (a cron job, a boot-time call, a unit test) so callers never
 * have to null-check. `requestId: "-"` is deliberately not a valid id, which makes such log
 * lines easy to spot.
 */
const OUTSIDE_REQUEST: RequestStore = { requestId: "-" };

export const RequestContext = {
  run<T>(store: RequestStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  get(): RequestStore {
    return storage.getStore() ?? OUTSIDE_REQUEST;
  },

  get requestId(): string {
    return RequestContext.get().requestId;
  },

  get userId(): string | undefined {
    return storage.getStore()?.userId;
  },

  /**
   * Called by the auth guard once the token has been verified and the local user resolved.
   * Mutating the existing store rather than re-running is what lets the guard enrich a context
   * the middleware already created.
   */
  setUserId(userId: string): void {
    const store = storage.getStore();
    if (store) store.userId = userId;
  },
} as const;
