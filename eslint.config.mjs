import js from "@eslint/js";
import globals from "globals";

export default [
    // ESLint recommended rules
    js.configs.recommended,

    // Browser-side code (front-end)
    {
        files: ["scripts/**/*.js"],
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

    // Node.js code (back-end)
    {
        files: [
            "app.js",
            "server-scripts/**/*.js",
            "scripts-shell/*.js"
        ],
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
            "scripts/init-alpine.js",
            "work/**/*"
        ]
    }
];
