/** @type {import("lint-staged").Config} */
module.exports = {
  "*.{js,jsx,ts,tsx,cjs,mjs,cts,mts}": [
    "eslint --max-warnings=0 --fix",
    "prettier --write --ignore-unknown --no-error-on-unmatched-pattern",
  ],
  "*.{json,md,mdx,yml,yaml,css,scss}": [
    "prettier --write --ignore-unknown --no-error-on-unmatched-pattern",
  ],
};
