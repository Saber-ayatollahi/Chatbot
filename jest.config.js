module.exports = {
  "testEnvironment": "node",
  "collectCoverage": false,
  "testMatch": [
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js"
  ],
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setup.js"
  ],
  "verbose": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "testTimeout": 30000,
  "maxWorkers": "50%"
};