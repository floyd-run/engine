import tseslint, { type ConfigArray } from "typescript-eslint";
import baseConfig from "./base.ts";

const libraryConfig: ConfigArray = tseslint.config(...baseConfig, {
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "no-console": "error",
  },
});

export default libraryConfig;