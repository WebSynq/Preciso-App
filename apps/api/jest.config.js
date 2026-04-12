/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '@preciso/schemas': '<rootDir>/../../packages/schemas/dist/index.js',
    '@preciso/types': '<rootDir>/../../packages/types/dist/index.js',
    '@preciso/utils': '<rootDir>/../../packages/utils/dist/index.js',
  },
};
