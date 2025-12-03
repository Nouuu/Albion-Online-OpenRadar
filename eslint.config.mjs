import js from "@eslint/js";
import globals from "globals";

export default [
    // ESLint recommended rules
    js.configs.recommended,

    // Browser-side code (front-end)
    {
        files: ["scripts/**/*.js"],
        ignores: ["scripts/init-alpine.js"],
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
            "node_modules/**",
            "dist/**",
            "build/**",
            "*.min.js"
        ]
    }
];
