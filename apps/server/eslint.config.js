import app from "@floyd-run/eslint/app";

export default [
  ...app,
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["database/*", "infra/*", "operations/*", "config/*", "routes/*", "workers/*"],
              message: "domain/ must be pure — no imports from app infrastructure layers.",
            },
          ],
        },
      ],
    },
  },
];
