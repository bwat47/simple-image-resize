/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^api$': '<rootDir>/tests/__mocks__/api.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/manifest.json', '!src/index.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
};
