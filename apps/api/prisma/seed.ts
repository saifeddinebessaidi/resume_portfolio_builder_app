/**
 * The real catalog: 3 categories, 9 plans, their entitlements and their marketing bullets,
 * transcribed from `../Original REACHY (2)/src/components/landing/pricing.tsx` and recorded in
 * docs/overview/04-business-rules.md.
 *
 * **Idempotent.** Everything is an upsert keyed on a stable business code, and entitlements
 * are reconciled (missing ones created, changed ones updated, removed ones deleted) rather
 * than blindly inserted. Running this twice changes nothing, which is what makes it safe to
 * run against any environment — including one that already has customers.
 *
 * Nothing here is invented. Where the source pricing page was self-contradictory the decision
 * is recorded in 04-business-rules.md and referenced at the relevant row below.
 */
import {
  BillingPeriod,
  CategoryCode,
  EntitlementKey,
  PrismaClient,
  ResetPeriod,
} from "@prisma/client";

const prisma = new PrismaClient();

/** TND. Prices are in millimes: TND has three decimals, so 25 TND is 25000. */
const CURRENCY = "TND";

interface EntitlementSeed {
  key: EntitlementKey;
  /** null = unlimited. 0 = explicitly denied. */
  limitValue: number | null;
  resetPeriod: ResetPeriod;
}

interface PlanSeed {
  code: string;
  name: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  priceMinor: number;
  badge: string | null;
  sortOrder: number;
  features: string[];
  entitlements: EntitlementSeed[];
}

interface CategorySeed {
  code: CategoryCode;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  plans: PlanSeed[];
}

// -----------------------------------------------------------------------------
// RESUME — CV Professionnel
//
// ⚠ Decision: TERM rather than MONTHLY on the 6- and 12-month plans. The bullet reads
// "18 CVs professionnels", full stop. 18 happens to equal 3 × 6, but we enforce 18 across the
// whole term because that is the literal promise and it lets a user who needs five CVs in one
// week have them. Switching to a monthly cadence is a one-row change:
// limitValue 3, resetPeriod MONTHLY.
//
// ⚠ CV plans get no HOSTING_DAYS entitlement: a PDF is not hosted. The FAQ's claim that
// hosting is included in every plan is inaccurate for CVs.
// -----------------------------------------------------------------------------
const resumeEntitlementsFor = (createQuota: number, reset: ResetPeriod): EntitlementSeed[] => [
  { key: EntitlementKey.PROJECT_CREATE_QUOTA, limitValue: createQuota, resetPeriod: reset },
  { key: EntitlementKey.REVISION_PER_PROJECT, limitValue: 1, resetPeriod: ResetPeriod.NONE },
  { key: EntitlementKey.EXPORT_PER_PROJECT, limitValue: 1, resetPeriod: ResetPeriod.NONE },
];

/**
 * PORTFOLIO and PORTFOLIO_PRO share this shape.
 *
 * CUSTOM_SLUG with limitValue 1 is a boolean flag expressed as a limit — the entitlement
 * engine treats "limit >= 1 and not consumed" as allowed. Keeping flags and counts in one
 * table means one lookup mechanism instead of two.
 */
const portfolioEntitlementsFor = (revisions: number, hostingDays: number): EntitlementSeed[] => [
  { key: EntitlementKey.PROJECT_CREATE_QUOTA, limitValue: 1, resetPeriod: ResetPeriod.TERM },
  {
    key: EntitlementKey.REVISION_PER_PROJECT,
    limitValue: revisions,
    resetPeriod: ResetPeriod.NONE,
  },
  { key: EntitlementKey.PUBLICATION_SLOT, limitValue: 1, resetPeriod: ResetPeriod.TERM },
  { key: EntitlementKey.CUSTOM_SLUG, limitValue: 1, resetPeriod: ResetPeriod.NONE },
  { key: EntitlementKey.HOSTING_DAYS, limitValue: hostingDays, resetPeriod: ResetPeriod.NONE },
  /**
   * Seeded identically on both PORTFOLIO and PORTFOLIO_PRO so raising it for Pro is one
   * UPDATE. See open question 2 — Pro is currently a price-identical clone.
   */
  { key: EntitlementKey.ASSET_STORAGE_MB, limitValue: 200, resetPeriod: ResetPeriod.NONE },
];

const portfolioPlans = (prefix: string, proLabel: boolean): PlanSeed[] => {
  const label = proLabel ? " Pro" : "";
  return [
    {
      code: `${prefix}_1M`,
      name: "1 Mois",
      billingPeriod: BillingPeriod.MONTHLY,
      durationDays: 30,
      priceMinor: 25_000,
      badge: null,
      sortOrder: 1,
      features: [
        `1 portfolio artistique${label} (1 création + 1 modification)`,
        "Lien externe personnalisé",
        "Hosting inclus (1 mois)",
      ],
      entitlements: portfolioEntitlementsFor(1, 30),
    },
    {
      code: `${prefix}_6M`,
      name: "6 Mois",
      billingPeriod: BillingPeriod.SEMIANNUAL,
      durationDays: 180,
      priceMinor: 135_000,
      badge: "-10%",
      sortOrder: 2,
      features: [
        "Profitez de -10%",
        `1 portfolio${label} (1 création + 3 modifications)`,
        "Lien externe personnalisé",
        "Hosting inclus (6 mois)",
      ],
      entitlements: portfolioEntitlementsFor(3, 180),
    },
    {
      code: `${prefix}_12M`,
      name: "1 An",
      billingPeriod: BillingPeriod.ANNUAL,
      durationDays: 365,
      priceMinor: 270_000,
      badge: "-10%",
      sortOrder: 3,
      features: [
        "Profitez de -10%",
        `1 portfolio${label} (1 création + 6 modifications)`,
        "Lien externe personnalisé",
        "Hosting inclus (12 mois)",
      ],
      entitlements: portfolioEntitlementsFor(6, 365),
    },
  ];
};

const CATALOG: CategorySeed[] = [
  {
    code: CategoryCode.RESUME,
    name: "CV Professionnel",
    slug: "resume",
    description: "Créez un CV professionnel et téléchargez-le en PDF.",
    sortOrder: 1,
    plans: [
      {
        code: "RESUME_1M",
        name: "1 Mois",
        billingPeriod: BillingPeriod.MONTHLY,
        durationDays: 30,
        priceMinor: 25_000,
        badge: null,
        sortOrder: 1,
        features: [
          "3 CVs professionnels",
          "3 créations de CV + 1 modification par CV",
          "1 téléchargement par CV",
        ],
        entitlements: resumeEntitlementsFor(3, ResetPeriod.MONTHLY),
      },
      {
        code: "RESUME_6M",
        name: "6 Mois",
        billingPeriod: BillingPeriod.SEMIANNUAL,
        durationDays: 180,
        priceMinor: 135_000,
        badge: "Best Value",
        sortOrder: 2,
        features: [
          "18 CVs professionnels (dont 2 CVs GRATUITS)",
          "18 créations + 1 modification par CV",
          "1 téléchargement par CV",
        ],
        entitlements: resumeEntitlementsFor(18, ResetPeriod.TERM),
      },
      {
        code: "RESUME_12M",
        name: "1 An",
        billingPeriod: BillingPeriod.ANNUAL,
        durationDays: 365,
        priceMinor: 270_000,
        badge: "Pro",
        sortOrder: 3,
        features: [
          "36 CVs professionnels (dont 4 CVs GRATUITS)",
          "36 créations + 1 modification par CV",
          "1 téléchargement par CV",
        ],
        entitlements: resumeEntitlementsFor(36, ResetPeriod.TERM),
      },
    ],
  },
  {
    code: CategoryCode.PORTFOLIO,
    name: "Portfolio Artistique",
    slug: "portfolio",
    description: "Publiez un portfolio artistique avec un lien public personnalisé.",
    sortOrder: 2,
    plans: portfolioPlans("PORTFOLIO", false),
  },
  {
    code: CategoryCode.PORTFOLIO_PRO,
    name: "Portfolio Artistique Pro",
    slug: "portfolio-pro",
    description: "Portfolio artistique avec fonctions avancées.",
    sortOrder: 3,
    /**
     * ⚠ Knowingly a placeholder: identical to PORTFOLIO in every respect, because the source
     * pricing page advertises identical features at an identical price. Pro must differ before
     * launch or be removed from the pricing page. Every candidate differentiator is pure data —
     * more revisions, higher storage, more publication slots, a higher price.
     */
    plans: portfolioPlans("PORTFOLIO_PRO", true),
  },
];

/**
 * Reconciles the child rows of a plan rather than only inserting them.
 *
 * A create-only seed drifts the moment a limit changes in this file: the old row stays and the
 * new one is added, and the entitlement lookup then finds two rows for one key. Deleting what
 * is no longer declared is what makes re-running this against an existing database correct
 * rather than merely safe.
 */
async function reconcileEntitlements(planId: string, declared: EntitlementSeed[]): Promise<void> {
  for (const e of declared) {
    await prisma.planEntitlement.upsert({
      where: { planId_key: { planId, key: e.key } },
      create: { planId, ...e },
      update: { limitValue: e.limitValue, resetPeriod: e.resetPeriod },
    });
  }

  await prisma.planEntitlement.deleteMany({
    where: { planId, key: { notIn: declared.map((e) => e.key) } },
  });
}

/**
 * Features have no natural business key (the label IS the content), so they are replaced
 * wholesale. Safe because nothing references a PlanFeature row by id.
 */
async function reconcileFeatures(planId: string, labels: string[]): Promise<void> {
  await prisma.planFeature.deleteMany({ where: { planId } });
  await prisma.planFeature.createMany({
    data: labels.map((label, i) => ({ planId, label, sortOrder: i + 1 })),
  });
}

async function main(): Promise<void> {
  console.log("Seeding catalog…\n");

  let categoryCount = 0;
  let planCount = 0;
  let entitlementCount = 0;
  let featureCount = 0;

  for (const c of CATALOG) {
    const category = await prisma.productCategory.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      update: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
      },
    });
    categoryCount++;
    console.log(`  ${c.code}`);

    for (const p of c.plans) {
      const plan = await prisma.plan.upsert({
        where: { code: p.code },
        create: {
          code: p.code,
          categoryId: category.id,
          name: p.name,
          billingPeriod: p.billingPeriod,
          durationDays: p.durationDays,
          priceMinor: p.priceMinor,
          currency: CURRENCY,
          badge: p.badge,
          sortOrder: p.sortOrder,
          isActive: true,
        },
        update: {
          // categoryId is intentionally NOT updated: moving a plan between categories would
          // orphan every subscription metered against it.
          name: p.name,
          billingPeriod: p.billingPeriod,
          durationDays: p.durationDays,
          priceMinor: p.priceMinor,
          currency: CURRENCY,
          badge: p.badge,
          sortOrder: p.sortOrder,
        },
      });
      planCount++;

      await reconcileEntitlements(plan.id, p.entitlements);
      await reconcileFeatures(plan.id, p.features);
      entitlementCount += p.entitlements.length;
      featureCount += p.features.length;

      const price = (p.priceMinor / 1000).toFixed(0);
      console.log(
        `    ${p.code.padEnd(20)} ${price.padStart(3)} TND  ` +
          `${String(p.durationDays).padStart(3)}d  ` +
          `${p.entitlements.length} entitlements, ${p.features.length} features`,
      );
    }
  }

  console.log(
    `\nSeeded ${categoryCount} categories, ${planCount} plans, ` +
      `${entitlementCount} entitlements, ${featureCount} features.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
