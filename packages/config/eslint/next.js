// ESLint config for apps/web (Next.js App Router). Extends the shared base.
//
// @next/eslint-plugin-next is wired in by phase 3 step 01, alongside the Next major the app
// is actually generated with — pinning a Next plugin version before apps/web exists only
// creates a version to reconcile later.
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import base from "./base.js";

export default tseslint.config(
  ...base,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Ground rule 7 (docs/README.md): every user-facing string lives in
      // apps/web/src/messages/fr.ts. The linter cannot see inline French text, so this is
      // reviewed by hand — the rule below only catches the mechanical half.
      "@typescript-eslint/no-misused-promises": [
        "error",
        // onClick={async () => …} is idiomatic React and not a real misuse.
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
);
