import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";

// Shared browser globals for front-end code
const browserGlobals = {
    ...globals.browser,
    // CDN-loaded libraries (declared in base.gohtml)
    lucide: "readonly",
    htmx: "readonly",
    // App globals exposed in base.gohtml
    CATEGORIES: "readonly",
    settingsSync: "readonly",
    ResourcesHelper: "readonly",
    logger: "readonly"
};

export default [
    // ESLint recommended rules
    js.configs.recommended,

    // Browser-side code (front-end) - JS files in web/scripts/
    {
        files: ["web/scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: browserGlobals
        },
        rules: {
            "no-case-declarations": "off",
            "no-prototype-builtins": "off",
            "no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }]
        }
    },

    // Go HTML templates - JavaScript linting inside <script> tags
    {
        files: ["internal/templates/**/*.gohtml"],
        plugins: { html },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...browserGlobals,
                // Page init functions (defined in templates)
                applyEnemyPreset: "readonly",
                applyResourcePreset: "readonly"
            }
        },
        rules: {
            "no-case-declarations": "off",
            "no-prototype-builtins": "off",
            "no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_|Page$|appData|Preset$"
            }]
        },
        settings: {
            "html/html-extensions": [".gohtml"],
            "html/indent": "+4",
            "html/report-bad-indent": "off"
        }
    },

    // Node.js tools/scripts
    {
        files: ["tools/**/*.js", "tools/**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node
            }
        }
    },

    // Ignore patterns
    {
        ignores: [
            "*.cjs",
            "*.min.js",
            ".venv/**/*",
            "build/**",
            "dist/**",
            "node_modules/**",
            "work/**/*",
            "tmp/**",
            "internal/templates/layouts/content.gohtml",
            "web/scripts/vendors/**"
        ]
    }
];
