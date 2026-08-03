import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["src/*/target/**"]
  },
  {
    files: ["src/**/*.mts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended
    ]
  }
);
