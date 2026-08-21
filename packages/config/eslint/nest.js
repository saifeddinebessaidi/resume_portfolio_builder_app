// ESLint config for apps/api (NestJS). Extends the shared base and adds the rules that
// encode the architectural ground rules from docs/overview/02-architecture.md.
import globals from "globals";
import tseslint from "typescript-eslint";

import base from "./base.js";

export default tseslint.config(
  ...base,

  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Decorators legitimately sit on classes with no other members, and Nest's
      // constructor-injected fields are assigned by the DI container.
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],

      // Nest handlers are `async` by convention even when the body has no await.
      "@typescript-eslint/require-await": "off",

      // Interfaces used as DI tokens are often empty at first.
      "@typescript-eslint/no-empty-interface": "off",
    },
  },

  {
    // ADR: Prisma types must not leave infrastructure/. Map to a domain entity at the boundary.
    // The domain/application zone rule (no @nestjs/* or infrastructure/ imports from
    // domain/ and application/) is added in phase 2 step 01, once those directories exist.
    files: ["src/**/*.ts"],
    ignores: ["src/**/infrastructure/**", "src/**/prisma/**", "prisma/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Prisma types must not leave infrastructure/. Map to a domain entity at the boundary.",
            },
          ],
        },
      ],
    },
  },

  {
    // Tests may reach for the database client and stub types freely.
    files: ["**/*.spec.ts", "**/*.e2e-spec.ts", "test/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  {
    // Prisma seeds and the verification scripts are standalone CLI programs, not part of the
    // running application: they import the client directly and their output IS their user
    // interface, so `no-console` and the layering rules do not apply to them.
    files: ["prisma/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-console": "off",
    },
  },
);
