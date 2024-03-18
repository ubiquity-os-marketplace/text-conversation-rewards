const { config } = require("dotenv");
config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.warn("GITHUB_TOKEN is not set");
}
process.argv = ["path/to/node", "path/to/script", `--auth`, `${GITHUB_TOKEN}`];

/** @type {import('jest').Config} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
