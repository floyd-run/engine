import tseslint, { type ConfigArray } from "typescript-eslint";
import baseConfig from "./base.ts";

const appConfig: ConfigArray = tseslint.config(...baseConfig, {
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "no-console": "warn",
  },
});

export default appConfig;
