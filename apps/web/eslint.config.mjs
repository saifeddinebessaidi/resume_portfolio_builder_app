import next from "@repo/config/eslint/next";
import tseslint from "typescript-eslint";

export default tseslint.config(...next, {
  // next.config.ts and postcss.config.mjs sit outside tsconfig's `include` — they are Next's own
  // build inputs, not application source — so the type-aware rules have no project for them.
  // Next validates next.config.ts itself at build time.
  ignores: [".next/**", "next-env.d.ts", "next.config.ts", "postcss.config.mjs"],
});
