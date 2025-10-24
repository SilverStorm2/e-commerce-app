/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "import/no-anonymous-default-export": "off",
  },
};
