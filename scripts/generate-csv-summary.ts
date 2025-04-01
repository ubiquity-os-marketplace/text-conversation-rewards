import { createObjectCsvWriter } from "csv-writer";
import fs from "fs/promises";
import path from "path";

interface CommentScore {
  reward: number;
  [key: string]: any;
}

interface Comment {
  id: number;
  content: string;
  url: string;
  commentType: string;
  score: CommentScore;
  [key: string]: any;
}

interface Review {
  reviewId: number;
  reward: number;
  [key: string]: any;
}

interface ReviewReward {
  reviews?: Review[];
  url: string;
  [key: string]: any;
}

interface Task {
  reward: number;
  multiplier: number;
  [key: string]: any;
}

interface UserData {
  userId: number;
  total: number;
  task?: Task;
  comments?: Comment[];
  reviewRewards?: ReviewReward[];
  [key: string]: any;
}

interface ResultData {
  [username: string]: UserData;
}

interface CsvRecord {
  Organization: string;
  Repository: string;
  IssueNumber: string;
  Username: string;
  UserID: number;
  ItemType: "Task" | "Comment" | "Review";
  ItemID: number | string | null;
  ItemURL: string | null;
  Reward: number | null;
  CommentType: string | null;
}

const resultsDir = path.join(process.cwd(), "results");
const outputCsvPath = path.join(resultsDir, "rewards_summary.csv");

async function generateCsvSummary() {
  const records: CsvRecord[] = [];
  let files: string[];

  try {
    files = await fs.readdir(resultsDir);
  } catch (error) {
    console.error(`Error reading results directory ${resultsDir}:`, error);
    process.exit(1);
  }

  const jsonFiles = files.filter((file) => file.endsWith(".json") && file !== "invalid-issues.json");

  for (const file of jsonFiles) {
    const filePath = path.join(resultsDir, file);
    const filenameParts = file.replace(".json", "").split("_");

    if (filenameParts.length < 3) {
      console.warn(`Skipping file with unexpected name format: ${file}`);
      continue;
    }

    const issueNumber = filenameParts.pop() || "";
    const repository = filenameParts.pop() || "";
    const organization = filenameParts.join("_"); // Handle org names with underscores

    let fileContent: string;
    let data: ResultData;

    try {
      fileContent = await fs.readFile(filePath, "utf-8");
      data = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading or parsing JSON file ${file}:`, error);
      continue;
    }

    for (const username in data) {
      const userData = data[username];
      const baseRecord = {
        Organization: organization,
        Repository: repository,
        IssueNumber: issueNumber,
        Username: username,
        UserID: userData.userId,
      };

      if (userData.task) {
        records.push({
          ...baseRecord,
          ItemType: "Task",
          ItemID: null,
          ItemURL: null, // Task URL isn't directly in this structure
          Reward: userData.task.reward,
          CommentType: null,
        });
      }

      if (userData.comments) {
        for (const comment of userData.comments) {
          records.push({
            ...baseRecord,
            ItemType: "Comment",
            ItemID: comment.id,
            ItemURL: comment.url,
            Reward: comment.score?.reward ?? 0,
            CommentType: comment.commentType,
          });
        }
      }

      if (userData.reviewRewards) {
        for (const reviewReward of userData.reviewRewards) {
          if (reviewReward.reviews) {
            for (const review of reviewReward.reviews) {
              records.push({
                ...baseRecord,
                ItemType: "Review",
                ItemID: review.reviewId,
                ItemURL: reviewReward.url, // URL is on the parent object
                Reward: review.reward,
                CommentType: null,
              });
            }
          }
        }
      }
    }
  }

  if (records.length === 0) {
    console.log("No data found to write to CSV.");
    return;
  }

  const csvWriter = createObjectCsvWriter({
    path: outputCsvPath,
    header: [
      { id: "Organization", title: "Organization" },
      { id: "Repository", title: "Repository" },
      { id: "IssueNumber", title: "IssueNumber" },
      { id: "Username", title: "Username" },
      { id: "UserID", title: "UserID" },
      { id: "ItemType", title: "ItemType" },
      { id: "ItemID", title: "ItemID" },
      { id: "ItemURL", title: "ItemURL" },
      { id: "Reward", title: "Reward" },
      { id: "CommentType", title: "CommentType" },
    ],
  });

  try {
    await csvWriter.writeRecords(records);
    console.log(`CSV summary successfully generated at ${outputCsvPath}`);
  } catch (error) {
    console.error("Error writing CSV file:", error);
    process.exit(1);
  }
}

generateCsvSummary();
