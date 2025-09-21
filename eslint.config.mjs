import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";

const customGlobals = {
  naver: "readonly",
  formatJibun: "readonly",
  calculatePolygonCenter: "readonly",
  ParcelColorStorage: "readonly",
  CONFIG: "readonly",
  loadExistingParcelData: "readonly",
  currentColor: "writable",
  map: "readonly",
  clearAllSearchResults: "readonly",
  ColorPaletteManager: "readonly",
  MemoMarkerManager: "readonly",
  SupabaseManager: "readonly",
  SearchModeManager: "readonly",
  GoogleAuth: "readonly",
  google: "readonly"
};

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".claude/**",
      ".specify/**",
      "AGENTS.md",
      "CLAUDE.md",
      "package-lock.json",
      "public/css/**",
      "public/js/advanced-backup-manager.js",
      "public/js/app-init.js",
      "public/js/app-manager-optimized.js",
      "public/js/auth.js",
      "public/js/backup-manager.js",
      "public/js/backup-ui.js",
      "public/js/calendar.js",
      "public/js/debug-save-system.js",
      "public/js/log-config.js",
      "public/js/map.js",
      "public/js/supabase-adapter.js",
      "public/js/supabase-config.js",
      "public/js/utils.js",
      "public/js/parcel-manager.js",
      "public/js/parcel-save-fix.js",
      "public/js/parcel.backup.js",
      "public/js/mode-click-handler.js",
      "public/js/sheets.js",
      "public/js/realtime-autosave.js"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...customGlobals
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }]
    }
  },
  {
    files: [
      "tests/**/*.{js,ts,jsx,tsx}",
      "dev-tools/tests/**/*.{js,ts,jsx,tsx}",
      "**/*.spec.{js,ts,jsx,tsx}",
      "complete-e2e-test.js",
      "extended-30min-test.spec.js",
      "tests/**/*.js"
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        test: "readonly",
        expect: "readonly",
        describe: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        DataPersistenceManager: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off"
    }
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    extends: [json.configs.recommended]
  },
  {
    files: ["**/*.md"],
    language: "markdown/commonmark",
    extends: [markdown.configs.recommended],
    rules: {
      "markdown/no-missing-label-refs": "off",
      "markdown/no-multiple-h1": "off",
      "markdown/fenced-code-language": "off"
    }
  }
]);
