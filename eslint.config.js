import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import-x";
import solid from "eslint-plugin-solid";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@typescript-eslint": ts,
      solid: solid,
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: "./tsconfig.json",
      },
      globals: {
        // Browser globals
        localStorage: "readonly",
        sessionStorage: "readonly",
        indexedDB: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        // Add any other browser globals you use
      },
    },
    settings: {
      "import/parsers": {
        [tsParser]: [".ts", ".tsx", ".d.ts"],
      },
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      "solid/no-destructure": "error",
      "solid/reactivity": "error",
      "solid/no-react-deps": "error",
      "solid/prefer-for": "warn",
      "solid/style-prop": "warn",

      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];
