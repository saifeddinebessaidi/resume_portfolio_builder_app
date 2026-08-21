import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";

export interface HealthReport {
  status: "ok" | "degraded";
  database: boolean;
  uptime: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const db = await this.prisma.ping();

    return {
      status: db.ok ? "ok" : "degraded",
      database: db.ok,
      uptime: Math.round(process.uptime()),
    };
  }
}
