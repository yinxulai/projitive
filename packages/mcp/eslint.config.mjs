import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["output/**", "node_modules/**", ".tmp/**", ".projitive/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      quotes: ["error", "single", { avoidEscape: true }],
      semi: ["error", "never"],
    },
  }
);
