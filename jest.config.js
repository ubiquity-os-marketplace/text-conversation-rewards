const { config } = require("dotenv");

config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
process.argv = ["path/to/node", "path/to/script", `--auth`, `${GITHUB_TOKEN}`, "--open-ai", `${OPENAI_API_KEY}`];

/** @type {import('jest').Config} */
module.exports = {
  transform: {
    "^.+\\.tsx?$": "babel-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
