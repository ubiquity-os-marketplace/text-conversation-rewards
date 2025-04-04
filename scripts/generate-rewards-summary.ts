import fs from "fs/promises";
import path from "path";

interface UserRewardData {
  total: number;
}

interface RewardFileContent {
  [username: string]: UserRewardData;
}

type UserTotals = { [username: string]: number };

async function readAndParseJsonFile(filePath: string): Promise<RewardFileContent | null> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    if (!fileContent.trim()) {
      console.warn(`Skipping empty file: ${path.basename(filePath)}`);
      return null;
    }
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading or parsing file ${path.basename(filePath)}:`, error);
    return null;
  }
}

function aggregateUserData(data: RewardFileContent, userTotals: UserTotals): void {
  Object.keys(data).forEach((username) => {
    const userData = data[username];
    if (userData && typeof userData.total === "number") {
      userTotals[username] = (userTotals[username] || 0) + userData.total;
    } else {
      console.warn(`Invalid or missing 'total' for user ${username}`);
    }
  });
}

function generateMarkdownTable(userTotals: UserTotals): string {
  let markdownContent = "# Aggregated Rewards Summary\n\n";
  markdownContent += "| User | Total Reward |\n";
  markdownContent += "|------|--------------|\n";

  // Sort users by total reward in descending order
  const sortedUsers = Object.keys(userTotals).sort((a, b) => userTotals[b] - userTotals[a]);

  if (sortedUsers.length === 0) {
    markdownContent += "| *No users found* | *N/A* |\n";
  } else {
    for (const user of sortedUsers) {
      markdownContent += `| ${user} | ${userTotals[user].toFixed(2)} |\n`;
    }
  }
  return markdownContent;
}

async function writeSummaryFile(outputFile: string, content: string): Promise<void> {
  try {
    await fs.writeFile(outputFile, content);
    console.log(`Successfully generated rewards summary at: ${outputFile}`);
  } catch (error) {
    console.error(`Failed to write summary file ${outputFile}:`, error);
    throw error;
  }
}

async function main() {
  const resultsDir = path.join(process.cwd(), "results");
  const outputFile = path.join(process.cwd(), "rewards-summary.md");
  const userTotals: UserTotals = {};

  console.log(`Reading files from: ${resultsDir}`);

  try {
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    if (jsonFiles.length === 0) {
      console.warn("No JSON files found in the results directory.");
      await writeSummaryFile(outputFile, "# Aggregated Rewards Summary\n\nNo reward data found.\n");
      return;
    }

    console.log(`Found ${jsonFiles.length} JSON files to process.`);

    for (const file of jsonFiles) {
      const filePath = path.join(resultsDir, file);
      console.log(`Processing file: ${file}`);
      const data = await readAndParseJsonFile(filePath);
      if (data) {
        aggregateUserData(data, userTotals);
      }
    }

    const markdownContent = generateMarkdownTable(userTotals);
    await writeSummaryFile(outputFile, markdownContent);
  } catch (error) {
    console.error("Error generating rewards summary:", error);
    try {
      await fs.writeFile(outputFile, `# Aggregated Rewards Summary\n\nError generating summary. Please check logs.\n`);
    } catch (writeError) {
      console.error("Failed to write error state to markdown file:", writeError);
    }
  }
}

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error("Script execution failed:", error);
    process.exit(1);
  }
})();
