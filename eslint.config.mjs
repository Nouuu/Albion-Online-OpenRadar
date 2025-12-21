import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

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
        plugins: {
            import: importPlugin
        },
        rules: {
            // Relaxed rules
            "no-case-declarations": "off",
            "no-prototype-builtins": "off",

            // Unused vars
            "no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],

            // Import checks
            "import/no-unresolved": "off", // Can't resolve without TS
            "import/named": "error",       // Catch named imports that don't exist
            "import/default": "error",     // Catch default imports issues
            "import/no-duplicates": "warn" // Warn on duplicate imports
        },
        settings: {
            "import/resolver": {
                node: {
                    extensions: [".js"]
                }
            }
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

    // Node.js tools/scripts (JS)
    {
        files: ["tools/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node
        },
        plugins: {
            import: importPlugin
        },
        rules: {
            "no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "import/no-duplicates": "warn"
        }
    },

    // Node.js tools/scripts (TS) - TypeScript parser
    {
        files: ["tools/**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node,
            parser: tseslint.parser,
            parserOptions: {
                project: false // Disable type-aware linting for speed
            }
        },
        plugins: {
            "@typescript-eslint": tseslint.plugin
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }]
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
