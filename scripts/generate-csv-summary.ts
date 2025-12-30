import { createObjectCsvWriter } from "csv-writer";
import fs from "fs/promises";
import path from "path";
import { commentEnum } from "../src/configuration/comment-types";
import { GithubCommentScore, Result, ReviewScore } from "../src/types/results";

type UserResultData = Result[string];

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

type BaseCsvRecordData = Omit<CsvRecord, "ItemType" | "ItemID" | "ItemURL" | "Reward" | "CommentType">;

const resultsDir = path.join(process.cwd(), "results");
const outputCsvPath = path.join(resultsDir, "rewards_summary.csv");
const invalidIssuesFilename = "invalid-issues.json";

async function readResultsDirectory(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter((file) => file.endsWith(".json") && file !== invalidIssuesFilename);
  } catch (error) {
    console.error(`Error reading results directory ${dirPath}:`, error);
    process.exit(1);
  }
}

function parseFilename(filename: string): { organization: string; repository: string; issueNumber: string } | null {
  const filenameWithoutExt = filename.slice(0, -".json".length);
  const parts = filenameWithoutExt.split("_");

  if (parts.length < 3) {
    console.warn(`Skipping file with unexpected name format: ${filename}`);
    return null;
  }

  const issueNumber = parts.pop();
  const repository = parts.pop();
  const organization = parts.join("_");

  if (!organization || !repository || !issueNumber) {
    console.warn(`Skipping file with incomplete name parts: ${filename}`);
    return null;
  }

  return { organization, repository, issueNumber };
}

async function readAndParseJsonFile(filePath: string): Promise<Result | null> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent) as Result;
  } catch (error) {
    console.error(`Error reading or parsing JSON file ${path.basename(filePath)}:`, error);
    return null;
  }
}

function extractTaskRecord(userData: UserResultData, baseRecord: BaseCsvRecordData): CsvRecord | null {
  if (!userData.task) {
    return null;
  }
  return {
    ...baseRecord,
    ItemType: "Task",
    ItemID: null,
    ItemURL: null,
    Reward: userData.task.reward,
    CommentType: null,
  };
}

function extractCommentRecords(userData: UserResultData, baseRecord: BaseCsvRecordData): CsvRecord[] {
  if (!userData.comments) {
    return [];
  }
  return userData.comments.map((comment: GithubCommentScore) => ({
    ...baseRecord,
    ItemType: "Comment",
    ItemID: comment.id,
    ItemURL: comment.url,
    Reward: comment.score?.reward ?? 0,
    CommentType: commentEnum[comment.commentType] ?? null,
  }));
}

function extractReviewRecords(userData: UserResultData, baseRecord: BaseCsvRecordData): CsvRecord[] {
  const reviewRecords: CsvRecord[] = [];
  if (!userData.reviewRewards) {
    return reviewRecords;
  }

  for (const reviewReward of userData.reviewRewards) {
    if (reviewReward.reviews) {
      for (const review of reviewReward.reviews as ReviewScore[]) {
        reviewRecords.push({
          ...baseRecord,
          ItemType: "Review",
          ItemID: review.reviewId,
          ItemURL: reviewReward.url,
          Reward: review.reward,
          CommentType: null,
        });
      }
    }
  }
  return reviewRecords;
}

async function writeCsvOutput(filePath: string, records: CsvRecord[]): Promise<void> {
  if (records.length === 0) {
    console.log("No data found to write to CSV.");
    return;
  }

  const csvWriter = createObjectCsvWriter({
    path: filePath,
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
    console.log(`CSV summary successfully generated at ${filePath}`);
  } catch (error) {
    console.error("Error writing CSV file:", error);
    process.exit(1);
  }
}

async function generateCsvSummary() {
  const allRecords: CsvRecord[] = [];
  const jsonFiles = await readResultsDirectory(resultsDir);

  for (const file of jsonFiles) {
    const fileMetadata = parseFilename(file);
    if (!fileMetadata) {
      continue;
    }

    const filePath = path.join(resultsDir, file);
    const data: Result | null = await readAndParseJsonFile(filePath);
    if (!data) {
      continue;
    }

    for (const username of Object.keys(data)) {
      const userData: UserResultData = data[username];
      const baseRecord = {
        Organization: fileMetadata.organization,
        Repository: fileMetadata.repository,
        IssueNumber: fileMetadata.issueNumber,
        Username: username,
        UserID: userData.userId,
      };

      const taskRecord = extractTaskRecord(userData, baseRecord);
      if (taskRecord) {
        allRecords.push(taskRecord);
      }

      const commentRecords = extractCommentRecords(userData, baseRecord);
      allRecords.push(...commentRecords);

      const reviewRecords = extractReviewRecords(userData, baseRecord);
      allRecords.push(...reviewRecords);
    }
  }

  await writeCsvOutput(outputCsvPath, allRecords);
}

generateCsvSummary().catch(console.error);
