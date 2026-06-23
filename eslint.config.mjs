/**
 * ESLint flat config for chat-demo (Next.js / TypeScript).
 *
 * next/core-web-vitals is a flat config array and is spread directly -- no FlatCompat needed.
 * It already registers react, react-hooks, jsx-a11y, import, @next/next, and @typescript-eslint
 * plugins. Those plugins must not be re-registered here with different object references or ESLint
 * will error on conflicting plugin definitions. Rule overrides use the plugin namespace string keys
 * without touching plugin registration.
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config([
    {
        ignores: [
            'node_modules',
            '.next',
            'out',
            'build',
            'public/**',
            '**/*.d.ts',
            '**/*.stories.ts',
            '**/*.stories.tsx',
        ],
    },
    // next/core-web-vitals is already a flat config array; spread directly.
    // It brings: react, react-hooks, jsx-a11y, import, @next/next, @typescript-eslint plugins.
    ...nextCoreWebVitals,
    {
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        extends: [security.configs.recommended],
        plugins: {
            security,
            'unused-imports': unusedImports,
        },
        rules: {
            curly: 'error',
            'import/no-anonymous-default-export': 'off',
            'no-console': ['warn', { allow: ['warn', 'info', 'error', 'group'] }],
            'no-implicit-globals': 'error',
            'no-param-reassign': ['error', { props: false }],
            'no-shadow': 'warn',
            'no-undef': 'error',
            'no-underscore-dangle': 'off',
            'no-unreachable': 'warn',
            'no-unused-expressions': 'error',
            'no-useless-escape': 'off',
            'no-var': 'warn',
            'object-shorthand': ['error', 'always'],
            'prefer-const': 'warn',
            'security/detect-eval-with-expression': 'warn',
            'security/detect-non-literal-fs-filename': 'warn',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-object-injection': 'off',
            'security/detect-possible-timing-attacks': 'warn',
            'unused-imports/no-unused-imports': 'warn',
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            ecmaVersion: 'latest',
            parserOptions: {
                ecmaFeatures: { jsx: true },
                ecmaVersion: 'latest',
                project: ['./tsconfig.json'],
                sourceType: 'module',
            },
        },
        // Do NOT re-register react, react-hooks, or jsx-a11y here -- they are already
        // registered by nextCoreWebVitals above. Re-registering with different instances
        // causes ESLint to throw a conflicting plugin definition error.
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            '@typescript-eslint/ban-ts-comment': [
                'warn',
                { 'ts-ignore': 'allow-with-description' },
            ],
            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/consistent-type-imports': [
                'warn',
                { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
            ],
            '@typescript-eslint/no-empty-object-type': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-misused-promises': [
                'warn',
                { checksVoidReturn: { attributes: false } },
            ],
            '@typescript-eslint/no-require-imports': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/require-await': 'off',
            'no-undef': 'off',
            'jsx-a11y/anchor-is-valid': 'warn',
            'jsx-a11y/click-events-have-key-events': 'off',
            'jsx-a11y/iframe-has-title': 'off',
            'jsx-a11y/interactive-supports-focus': 'off',
            'jsx-a11y/no-autofocus': 'warn',
            'jsx-a11y/no-noninteractive-element-interactions': 'off',
            'jsx-a11y/no-static-element-interactions': 'off',
            'no-var': 'warn',
            'prefer-const': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
            'react-hooks/rules-of-hooks': 'warn',
            'react/display-name': 'warn',
            'react/forbid-dom-props': [
                'error',
                {
                    forbid: [
                        {
                            message:
                                'Use SCSS modules for static styles. For runtime-driven values, set a CSS custom property or add eslint-disable-next-line with justification.',
                            propName: 'style',
                        },
                    ],
                },
            ],
            'react/jsx-curly-brace-presence': ['error', 'never'],
            'react/no-unescaped-entities': 'warn',
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'unused-imports/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        files: [
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/tests/**',
            '**/*.test.ts',
            '**/*.test.tsx',
        ],
        languageOptions: {
            globals: { ...globals.vitest },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            'no-console': 'off',
            'security/detect-non-literal-regexp': 'off',
        },
    },
    {
        files: ['**/opengraph-image.tsx'],
        rules: {
            // Next.js ImageResponse only accepts inline styles.
            'react/forbid-dom-props': 'off',
        },
    },
    eslintConfigPrettier,
]);
