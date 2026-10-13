import { defineConfig, globalIgnores } from "eslint/config";
import nextVitalsBase from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const nextVitals = nextVitalsBase.map((entry, index) =>
  index === 0
    ? {
        ...entry,
        rules: {
          ...entry.rules,
          // SonarQube alignment: enforced locally, not only in CI.
          "jsx-a11y/media-has-caption": "error",
        },
      }
    : entry,
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "node_modules/**",
    ".netlify/**",
    "test-results/**",
    "path/**",
  ]),
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["jest.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
