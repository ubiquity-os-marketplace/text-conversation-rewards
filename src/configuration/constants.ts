import { config } from "dotenv";

config();
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log("GITHUB_TOKEN", GITHUB_TOKEN);
