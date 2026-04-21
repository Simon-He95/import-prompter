// @ts-check
const antfu = require('@antfu/eslint-config').default

module.exports = antfu(
  {
    ignores: [],
  },
  {
    rules: {
      'ts/no-require-imports': 'off',
      'ts/no-var-requires': 'off',
    },
  },
)
