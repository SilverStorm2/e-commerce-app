/** @type {import("lint-staged").Config} */
module.exports = {
  "*.{js,jsx,ts,tsx}": [
    "eslint --max-warnings=0 --fix",
    "prettier --write --ignore-unknown --no-error-on-unmatched-pattern",
  ],
  "*.{json,md,css,scss}": [
    "prettier --write --ignore-unknown --no-error-on-unmatched-pattern",
  ],
};
