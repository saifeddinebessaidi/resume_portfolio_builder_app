// Shared ESLint flat config. Every package extends this one, directly or through
// eslint/nest.js or eslint/next.js.
//
// Two deliberate choices:
//   * recommendedTypeChecked — type-aware rules, which is where the value is (unsafe `any`
//     flow, floating promises). It requires a tsconfig, hence `projectService: true`.
//   * eslint-plugin-prettier LAST — formatting violations surface as lint errors, so
//     `pnpm verify` is one gate instead of "lint passed but format didn't".
import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Paths no package should ever lint. */
export const sharedIgnores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/coverage/**",
  "**/generated/**",
  "**/*.gen.ts",
  // reference-only project, never linted by this workspace
  "Original REACHY (2)/**",
];

export default tseslint.config(
  { ignores: sharedIgnores },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Resolves the nearest tsconfig per file — no explicit `project` array to keep in
        // sync as directories are added.
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      // Ground rule 6 (docs/README.md): no `any`. Use `unknown` and narrow with a Zod parse.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      // Unhandled promises are the failure mode that reaches production silently.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],

      // Mirrors noUnusedLocals / noUnusedParameters in tsconfig; `_`-prefixed args opt out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // Config and script files are plain JS, run in Node, and have no type information.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },

  // Must stay last: it turns off every stylistic rule that would fight Prettier and adds
  // `prettier/prettier` as an error.
  prettierRecommended,
);
