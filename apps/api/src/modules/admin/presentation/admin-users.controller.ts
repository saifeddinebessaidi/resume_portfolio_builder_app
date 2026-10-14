import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  type AdminListUsersQuery,
  type AdminListUsersResponse,
  type AdminReasonRequest,
  type AdminUpdateUserRequest,
  type AdminUserDetail,
  type AccessFeature,
  CATEGORY_CODES,
  type CategoryCode,
  type EntitlementKey,
  type MeResponse,
  type SetAccessOverrideRequest,
  type SetEntitlementOverrideRequest,
  adminAccessParamSchema,
  adminEntitlementOverrideParamSchema,
  adminListUsersQuerySchema,
  adminReasonRequestSchema,
  adminUpdateUserRequestSchema,
  adminUserIdParamSchema,
  setAccessOverrideRequestSchema,
  setEntitlementOverrideRequestSchema,
} from "@repo/contracts";

import { AccessOverridesUseCase } from "../application/access-overrides.use-case";
import { ADMIN_READ_MODEL, type AdminReadModel } from "../domain/admin.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { GetAdminUserUseCase } from "../application/get-admin-user.use-case";
import { RequestContext } from "../../../common/context/request-context";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { UpdateUserUseCase } from "../application/update-user.use-case";
import {
  toCategoryEntitlementsResponse,
  toSubscriptionResponse,
} from "../../subscriptions/presentation/subscriptions.controller";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

export function toMeResponse(user: User): MeResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    locale: user.locale,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}

@Controller("admin/users")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class AdminUsersController {
  constructor(
    @Inject(ADMIN_READ_MODEL) private readonly read: AdminReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getUser: GetAdminUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly overrides: AccessOverridesUseCase,
  ) {}

  @Get()
  async list(
    @Query(zodPipe(adminListUsersQuerySchema)) query: AdminListUsersQuery,
  ): Promise<AdminListUsersResponse> {
    return this.read.listUsers(query, this.clock.now());
  }

  @Get(":id")
  async detail(
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
  ): Promise<AdminUserDetail> {
    const state = await this.getUser.execute(params.id);

    return {
      user: toMeResponse(state.user),
      subscriptions: state.subscriptions.map((s) =>
        toSubscriptionResponse(s.subscription, s.planName),
      ),
      orders: state.orders,
      entitlements: CATEGORY_CODES.map((code) =>
        toCategoryEntitlementsResponse(code, state.entitlements.get(code)),
      ),
      accessOverrides: state.accessOverrides,
      entitlementOverrides: state.entitlementOverrides,
    };
  }

  @Patch(":id")
  async update(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(adminUpdateUserRequestSchema)) body: AdminUpdateUserRequest,
  ): Promise<MeResponse> {
    const updated = await this.updateUser.execute({
      actorUserId: admin.id,
      targetUserId: params.id,
      role: body.role,
      status: body.status,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
    return toMeResponse(updated);
  }

  @Put(":id/access/:feature")
  @HttpCode(204)
  async setAccess(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminAccessParamSchema)) params: { id: string; feature: AccessFeature },
    @Body(zodPipe(setAccessOverrideRequestSchema)) body: SetAccessOverrideRequest,
  ): Promise<void> {
    await this.overrides.setFeature({
      actorUserId: admin.id,
      userId: params.id,
      feature: params.feature,
      enabled: body.enabled,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Put(":id/entitlement-overrides")
  @HttpCode(204)
  async setLimit(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(setEntitlementOverrideRequestSchema)) body: SetEntitlementOverrideRequest,
  ): Promise<void> {
    await this.overrides.setLimit({
      actorUserId: admin.id,
      userId: params.id,
      categoryCode: body.categoryCode,
      key: body.key,
      limitValue: body.limitValue,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Delete(":id/entitlement-overrides/:category/:key")
  @HttpCode(204)
  async clearLimit(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminEntitlementOverrideParamSchema))
    params: { id: string; category: CategoryCode; key: EntitlementKey },
    @Body(zodPipe(adminReasonRequestSchema)) body: AdminReasonRequest,
  ): Promise<void> {
    await this.overrides.clearLimit({
      actorUserId: admin.id,
      userId: params.id,
      categoryCode: params.category,
      key: params.key,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }
}
