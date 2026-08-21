import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Required: `@repo/contracts` ships compiled CommonJS plus its TypeScript sources, and without
   * this Next refuses to parse a workspace package. This is the most common monorepo setup failure
   * and costs an hour if hit blind.
   */
  transpilePackages: ["@repo/contracts"],

  reactStrictMode: true,

  /** No reason to advertise the framework and its version to every visitor. */
  poweredByHeader: false,

  typedRoutes: true,
};

export default nextConfig;
