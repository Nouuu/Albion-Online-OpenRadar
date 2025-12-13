import js from "@eslint/js";
import globals from "globals";

export default [
    // ESLint recommended rules
    js.configs.recommended,

    // Browser-side code (front-end) - now in web/scripts/
    {
        files: ["web/scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser
            }
        },
        rules: {
            "no-case-declarations": "off",
            "no-prototype-builtins": "off"
        }
    },

    // Node.js tools/scripts
    {
        files: ["tools/**/*.js"],
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
            "web/scripts/init-alpine.js",
            "work/**/*",
            "tmp/**"
        ]
    }
];
