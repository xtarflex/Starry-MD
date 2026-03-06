export default {
    transform: {},
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: ['./tests/setup.js'],
    moduleFileExtensions: ['js', 'json', 'node']
};