import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { type MeResponse, type UpdateMeRequest, updateMeRequestSchema } from "@repo/contracts";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { USER_REPOSITORY, type UserRepository } from "../domain/user.repository";
import { type User } from "../domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * HTTP only: parse, delegate, map. No business rule lives here — that is what makes the layering
 * worth its folder count.
 */
@Controller("me")
export class UsersController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  private toResponse(user: User): MeResponse {
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

  /**
   * The user was already resolved (and JIT-provisioned) by the global AuthGuard, so this is a pure
   * read with no extra query — the endpoint that proves authentication works end to end.
   */
  @Get()
  me(@CurrentUser() user: User): MeResponse {
    return this.toResponse(user);
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: User,
    @Body(zodPipe(updateMeRequestSchema)) body: UpdateMeRequest,
  ): Promise<MeResponse> {
    // The schema is `.strict()`, so a client that sends `role` or `status` gets a 422 rather than
    // having those fields quietly dropped here.
    const updated = await this.users.updateProfile(user.id, body);
    return this.toResponse(updated);
  }
}
