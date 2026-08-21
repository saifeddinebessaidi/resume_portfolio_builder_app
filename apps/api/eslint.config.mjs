import nest from "@repo/config/eslint/nest";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...nest,

  { ignores: ["dist/**", "prisma/migrations/**"] },

  {
    /**
     * Ground rule 1 (docs/README.md): "The domain layer imports nothing from a framework. No
     * `@nestjs/*`, no Prisma types, no HTTP concepts in `modules/*&#47;domain/`."
     *
     * Scoped to domain/ only, deliberately. Use cases in application/ ARE `@Injectable` classes
     * with constructor injection — that is what makes the repository-interface pattern practical
     * rather than ceremonial (02-architecture.md), and the architecture document's own use-case
     * examples are written that way. What application/ may not do is reach past its interfaces to
     * a concrete adapter; that half is the next block.
     */
    files: ["src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*", "@nestjs/**"],
              message:
                "The domain layer imports nothing from a framework. Put the NestJS wiring in the use case, the module file, or infrastructure/.",
            },
          ],
        },
      ],
    },
  },

  {
    /**
     * The inward-only dependency rule. Neither inner layer may depend on Prisma, on HTTP, or on a
     * concrete adapter: a use case that needs something from the outside world declares a port
     * interface in domain/ and lets presentation/ bind the implementation.
     */
    files: ["src/modules/*/domain/**/*.ts", "src/modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@prisma/client/*"],
              message:
                "Prisma types must not leave infrastructure/. Map to a domain entity at the boundary.",
            },
            {
              group: ["fastify", "fastify/*", "**/infrastructure/**", "**/*.controller"],
              message:
                "The inner layers must not depend on infrastructure or HTTP. Invert the dependency with a port interface in domain/.",
            },
          ],
        },
      ],
    },
  },
);
