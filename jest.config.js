module.exports = {
  "testEnvironment": "node",
  "collectCoverage": true,
  "coverageThreshold": {
    "global": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  },
  "testMatch": [
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js"
  ],
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setup.js"
  ],
  "collectCoverageFrom": [
    "services/**/*.js",
    "knowledge/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
    "!**/tests/**"
  ],
  "verbose": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "testTimeout": 30000,
  "maxWorkers": "50%"
};