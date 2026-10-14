-- CreateEnum
CREATE TYPE "AccessFeature" AS ENUM ('RESUME', 'PORTFOLIO', 'PORTFOLIO_PRO', 'AI_GENERATION', 'EXPORT', 'PUBLISH');

-- CreateTable
CREATE TABLE "UserAccessOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "AccessFeature" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEntitlementOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" "EntitlementKey" NOT NULL,
    "limitValue" INTEGER,
    "reason" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessOverride_userId_feature_key" ON "UserAccessOverride"("userId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlementOverride_userId_categoryId_key_key" ON "UserEntitlementOverride"("userId", "categoryId", "key");

-- AddForeignKey
ALTER TABLE "UserAccessOverride" ADD CONSTRAINT "UserAccessOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessOverride" ADD CONSTRAINT "UserAccessOverride_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntitlementOverride" ADD CONSTRAINT "UserEntitlementOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntitlementOverride" ADD CONSTRAINT "UserEntitlementOverride_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntitlementOverride" ADD CONSTRAINT "UserEntitlementOverride_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
