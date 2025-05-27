import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: ["app/generated/**"], // Ignore Prisma generated files
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ⬇️ Put custom overrides after the presets
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // or use warn with patterns
    },
  },
];
