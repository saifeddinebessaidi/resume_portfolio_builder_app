// Tailwind v4 is a PostCSS plugin and needs no tailwind.config.js — the theme lives in
// globals.css under @theme inline, matching the reference project's approach exactly rather
// than translating it into a JS config that would then drift.
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
