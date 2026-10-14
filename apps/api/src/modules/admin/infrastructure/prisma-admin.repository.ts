import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";
import {
  type AccessFeature,
  type AccessOverride,
  type AdminListOrdersQuery,
  type AdminListUsersQuery,
  type AdminMetricsOverview,
  type AdminOrder,
  type AdminPlan,
  type AdminUserListItem,
  type Currency,
  type EntitlementKey,
  type EntitlementOverride,
  type Money,
  type PageResponse,
  type UserRole,
  type UserStatus,
} from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { amountExclTax, totalTax } from "../../billing/domain/order.entity";
import { cursorWhere, decodeCursor, paginate } from "../../../common/pagination/cursor";
import {
  type AccessOverrideState,
  type AdminReadModel,
  type AdminRepository,
  type EntitlementOverrideState,
} from "../domain/admin.repository";
import { type Tx } from "../../subscriptions/domain/subscription.repository";
import { type User } from "../../users/domain/user.entity";

const DAY_MS = 86_400_000;

/** Narrows the opaque `Tx` back to Prisma at the boundary, or falls back to the base client. */
function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

const USER_SUMMARY = { select: { id: true, email: true, fullName: true } } as const;

const ORDER_INCLUDE = {
  category: { select: { code: true } },
  user: USER_SUMMARY,
  payments: { orderBy: { occurredAt: "asc" } },
} as const satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** `@db.Char(3)` arrives blank-padded; trimmed for the same reason as in the billing repositories. */
const currencyOf = (raw: string): Currency => raw.trim() as Currency;

function toAdminOrder(row: OrderRow): AdminOrder {
  const currency = currencyOf(row.currency);
  const order = { amountMinor: row.amountMinor, taxRateBp: row.taxRateBp };

  return {
    id: row.id,
    status: row.status,
    categoryCode: row.category.code,
    planCode: row.planCodeSnapshot,
    // The snapshot holds the code; a historical financial record does not get the live plan's label.
    planName: row.planCodeSnapshot,
    amount: { amountMinor: row.amountMinor, currency },
    taxRateBp: row.taxRateBp,
    amountExclTax: { amountMinor: amountExclTax(order), currency },
    taxAmount: { amountMinor: totalTax(order), currency },
    invoiceNumber: row.invoiceNumber,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: row.user,
    payments: row.payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      provider: p.provider,
      status: p.status,
      amount: { amountMinor: p.amountMinor, currency: currencyOf(p.currency) },
      providerRef: p.providerRef,
      occurredAt: p.occurredAt.toISOString(),
    })),
  };
}

function toMoneyList(rows: { currency: string; _sum: { amountMinor: number | null } }[]): Money[] {
  return rows.map((r) => ({
    amountMinor: r._sum.amountMinor ?? 0,
    currency: currencyOf(r.currency),
  }));
}

@Injectable()
export class PrismaAdminReadModel implements AdminReadModel {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: AdminListUsersQuery, now: Date): Promise<PageResponse<AdminUserListItem>> {
    const filters: Prisma.UserWhereInput[] = [{ deletedAt: null }];
    if (query.role) filters.push({ role: query.role });
    if (query.status) filters.push({ status: query.status });
    if (query.q) {
      filters.push({
        OR: [
          { email: { contains: query.q, mode: "insensitive" } },
          { fullName: { contains: query.q, mode: "insensitive" } },
        ],
      });
    }
    // AND-ed rather than spread: both the search and the cursor are an OR at the top level.
    const after = cursorWhere(decodeCursor(query.cursor));
    if (after) filters.push(after);

    const rows = await this.prisma.user.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      include: {
        subscriptions: {
          where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
          select: { category: { select: { code: true } } },
        },
        accessOverrides: { where: { enabled: false }, select: { feature: true } },
      },
    });

    const page = paginate(rows, query.limit);

    return {
      nextCursor: page.nextCursor,
      items: page.items.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        locale: u.locale,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
        activeCategories: u.subscriptions.map((s) => s.category.code),
        disabledFeatures: u.accessOverrides.map((o) => o.feature),
      })),
    };
  }

  async listOrders(query: AdminListOrdersQuery): Promise<PageResponse<AdminOrder>> {
    const filters: Prisma.OrderWhereInput[] = [];
    if (query.status) filters.push({ status: query.status });
    if (query.userId) filters.push({ userId: query.userId });
    if (query.provider) filters.push({ payments: { some: { provider: query.provider } } });
    const after = cursorWhere(decodeCursor(query.cursor));
    if (after) filters.push(after);

    const rows = await this.prisma.order.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      include: ORDER_INCLUDE,
    });

    const page = paginate(rows, query.limit);
    return { items: page.items.map(toAdminOrder), nextCursor: page.nextCursor };
  }

  async ordersForUser(userId: string): Promise<AdminOrder[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: ORDER_INCLUDE,
    });
    return rows.map(toAdminOrder);
  }

  async accessOverridesFor(userId: string): Promise<AccessOverride[]> {
    const rows = await this.prisma.userAccessOverride.findMany({
      where: { userId },
      orderBy: { feature: "asc" },
      include: { updatedBy: USER_SUMMARY },
    });

    return rows.map((r) => ({
      feature: r.feature,
      enabled: r.enabled,
      reason: r.reason,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async entitlementOverridesFor(userId: string): Promise<EntitlementOverride[]> {
    const rows = await this.prisma.userEntitlementOverride.findMany({
      where: { userId },
      orderBy: [{ categoryId: "asc" }, { key: "asc" }],
      include: { updatedBy: USER_SUMMARY, category: { select: { code: true } } },
    });

    return rows.map((r) => ({
      categoryCode: r.category.code,
      key: r.key,
      limitValue: r.limitValue,
      reason: r.reason,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async plans(now: Date): Promise<AdminPlan[]> {
    const rows = await this.prisma.plan.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: { select: { code: true } },
        entitlements: { orderBy: { key: "asc" } },
        features: { orderBy: { sortOrder: "asc" } },
        _count: {
          select: {
            subscriptions: {
              where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
            },
          },
        },
      },
    });

    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      categoryCode: p.category.code,
      billingPeriod: p.billingPeriod,
      durationDays: p.durationDays,
      price: { amountMinor: p.priceMinor, currency: currencyOf(p.currency) },
      badge: p.badge,
      sortOrder: p.sortOrder,
      features: p.features.map((f) => ({ label: f.label, sortOrder: f.sortOrder })),
      entitlements: p.entitlements.map((e) => ({
        key: e.key,
        limitValue: e.limitValue,
        resetPeriod: e.resetPeriod,
      })),
      isActive: p.isActive,
      activeSubscriptions: p._count.subscriptions,
    }));
  }

  async metricsOverview(now: Date): Promise<AdminMetricsOverview> {
    const since7d = new Date(now.getTime() - 7 * DAY_MS);
    const since30d = new Date(now.getTime() - 30 * DAY_MS);
    const live = { deletedAt: null };

    const [total, new7d, new30d, suspended, activeByCategory, categories, rev30d, revAll, pending] =
      await Promise.all([
        this.prisma.user.count({ where: live }),
        this.prisma.user.count({ where: { ...live, createdAt: { gte: since7d } } }),
        this.prisma.user.count({ where: { ...live, createdAt: { gte: since30d } } }),
        this.prisma.user.count({ where: { ...live, status: "SUSPENDED" } }),
        this.prisma.subscription.groupBy({
          by: ["categoryId"],
          where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
          _count: { _all: true },
        }),
        this.prisma.productCategory.findMany({
          orderBy: { sortOrder: "asc" },
          select: { id: true, code: true },
        }),
        // Revenue is PAID orders only. Manual grants have no order, so they never count — which is
        // the point: a comp is not revenue. A refunded order leaves PAID and drops out too.
        this.prisma.order.groupBy({
          by: ["currency"],
          where: { status: "PAID", paidAt: { gte: since30d } },
          _sum: { amountMinor: true },
        }),
        this.prisma.order.groupBy({
          by: ["currency"],
          where: { status: "PAID" },
          _sum: { amountMinor: true },
        }),
        this.prisma.order.count({ where: { status: "PENDING" } }),
      ]);

    const counts = new Map(activeByCategory.map((r) => [r.categoryId, r._count._all]));

    return {
      users: { total, new7d, new30d, suspended },
      activeSubscriptions: categories.map((c) => ({
        categoryCode: c.code,
        count: counts.get(c.id) ?? 0,
      })),
      revenue: { last30d: toMoneyList(rev30d), allTime: toMoneyList(revAll) },
      pendingOrders: pending,
    };
  }
}

@Injectable()
export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockAdminRoster(tx: Tx): Promise<void> {
    // `$executeRaw`, not `$queryRaw`: the function returns void — see PrismaProjectCounter.
    await client(this.prisma, tx)
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-roster'))`;
  }

  async countActiveAdmins(tx: Tx): Promise<number> {
    return client(this.prisma, tx).user.count({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    });
  }

  async updateUser(
    tx: Tx,
    id: string,
    patch: { role?: UserRole; status?: UserStatus },
  ): Promise<User> {
    const row = await client(this.prisma, tx).user.update({
      where: { id },
      data: {
        ...(patch.role ? { role: patch.role } : {}),
        ...(patch.status ? { status: patch.status } : {}),
      },
    });

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

  async findAccessOverride(
    tx: Tx,
    userId: string,
    feature: AccessFeature,
  ): Promise<AccessOverrideState | null> {
    return client(this.prisma, tx).userAccessOverride.findUnique({
      where: { userId_feature: { userId, feature } },
      select: { enabled: true, reason: true },
    });
  }

  async upsertAccessOverride(
    tx: Tx,
    input: {
      userId: string;
      feature: AccessFeature;
      enabled: boolean;
      reason: string;
      actorId: string;
    },
  ): Promise<void> {
    const data = { enabled: input.enabled, reason: input.reason, updatedById: input.actorId };
    await client(this.prisma, tx).userAccessOverride.upsert({
      where: { userId_feature: { userId: input.userId, feature: input.feature } },
      create: { userId: input.userId, feature: input.feature, ...data },
      update: data,
    });
  }

  async deleteAccessOverride(tx: Tx, userId: string, feature: AccessFeature): Promise<void> {
    // deleteMany, so resetting a feature that has no override is a no-op rather than a P2025.
    await client(this.prisma, tx).userAccessOverride.deleteMany({ where: { userId, feature } });
  }

  async findEntitlementOverride(
    tx: Tx,
    userId: string,
    categoryId: string,
    key: EntitlementKey,
  ): Promise<EntitlementOverrideState | null> {
    return client(this.prisma, tx).userEntitlementOverride.findUnique({
      where: { userId_categoryId_key: { userId, categoryId, key } },
      select: { limitValue: true, reason: true },
    });
  }

  async upsertEntitlementOverride(
    tx: Tx,
    input: {
      userId: string;
      categoryId: string;
      key: EntitlementKey;
      limitValue: number | null;
      reason: string;
      actorId: string;
    },
  ): Promise<void> {
    const data = { limitValue: input.limitValue, reason: input.reason, updatedById: input.actorId };
    await client(this.prisma, tx).userEntitlementOverride.upsert({
      where: {
        userId_categoryId_key: {
          userId: input.userId,
          categoryId: input.categoryId,
          key: input.key,
        },
      },
      create: { userId: input.userId, categoryId: input.categoryId, key: input.key, ...data },
      update: data,
    });
  }

  async deleteEntitlementOverride(
    tx: Tx,
    userId: string,
    categoryId: string,
    key: EntitlementKey,
  ): Promise<void> {
    await client(this.prisma, tx).userEntitlementOverride.deleteMany({
      where: { userId, categoryId, key },
    });
  }

  async cancelSubscription(tx: Tx, id: string, at: Date): Promise<boolean> {
    const result = await client(this.prisma, tx).subscription.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "CANCELED", canceledAt: at },
    });
    return result.count > 0;
  }

  async setSubscriptionEndsAt(tx: Tx, id: string, endsAt: Date): Promise<void> {
    await client(this.prisma, tx).subscription.update({ where: { id }, data: { endsAt } });
  }

  async findSubscriptionIdByOrder(tx: Tx, orderId: string): Promise<string | null> {
    const row = await client(this.prisma, tx).subscription.findUnique({
      where: { orderId },
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
