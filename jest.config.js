const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
})

const customJestConfig = {
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testEnvironment: 'jest-environment-jsdom',
    // The self-hosted Gitea runner renders full pages (AdminPage, Swagger) far slower than CI
    testTimeout: 20000,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['lcov', 'text', 'text-summary'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.stories.{ts,tsx}',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!src/**/__tests__/**',
        '!src/**/__mocks__/**'
    ],
    coverageThreshold: {
        global: {
            statements: 60,
            branches: 60,
            functions: 60,
            lines: 60,
        },
    },
    transformIgnorePatterns: [
        '/node_modules/(?!jose)'
    ],
    setupFiles: ['<rootDir>/src/test/setup.ts'],
    testPathIgnorePatterns: ['<rootDir>/e2e/'],
}

// next/jest prepends its own node_modules ignore pattern (which only exempts geist), and it
// swallows the jose exception above. jose is ESM-only, so add it to next's exemption.
module.exports = async () => {
    const config = await createJestConfig(customJestConfig)();
    config.transformIgnorePatterns = config.transformIgnorePatterns.map((pattern) =>
        pattern.replace('(geist)', '(geist|jose)')
    );
    return config;
}; 