import Decimal from "decimal.js";
import { AllComments, Relevances } from "../types/content-evaluator-module-type";

export type SpecializedEvaluationDimension = {
  key: string;
  weight: number;
  instruction: string;
};

export type SpecializedPrompt = {
  key: string;
  weight: number;
  prompt: string;
};

export type SpecializedScores = {
  key: string;
  weight: number;
  scores: Relevances;
};

export const DEFAULT_SPECIALIZED_EVALUATIONS: SpecializedEvaluationDimension[] = [
  {
    key: "relevance",
    weight: 0.5,
    instruction: "Rank from 0 to 1 how relevant each comment is to solving the issue specification.",
  },
  {
    key: "helpfulness",
    weight: 0.3,
    instruction:
      "Rank from 0 to 1 how helpful each comment is for answering contributor questions, clarifying blockers, or guiding implementation.",
  },
  {
    key: "research",
    weight: 0.2,
    instruction:
      "Rank from 0 to 1 how useful each comment is for adding research, technical insights, or project-specific context.",
  },
];

export function buildSpecializedIssuePrompts({
  specification,
  username,
  allComments,
  dimensions = DEFAULT_SPECIALIZED_EVALUATIONS,
}: {
  specification: string;
  username: string;
  allComments: AllComments;
  dimensions?: SpecializedEvaluationDimension[];
}): SpecializedPrompt[] {
  if (!specification?.length) {
    throw new Error("Issue specification comment is missing or empty");
  }
  const targetComments = allComments.filter((comment) => comment.author === username);
  if (!targetComments.length) {
    throw new Error(`No comments found for user ${username}`);
  }
  const sortedComments = [...allComments].sort((a, b) => Number(a.id) - Number(b.id));
  const allCommentsMap = sortedComments.map((value) => `${value.id} - ${value.author}: "${value.comment}"`);
  const targetCommentIds = targetComments.map((value) => value.id).join(", ");
  const exampleOutput = targetComments.map((comment) => `"${comment.id}": <score>`).join(", ");

  return normalizeDimensions(dimensions).map((dimension) => ({
    key: dimension.key,
    weight: dimension.weight,
    prompt: `
      CRITICAL REQUIREMENT: YOUR RESPONSE MUST BE RAW JSON ONLY - NO BACKTICKS, NO CODE BLOCKS, NO MARKDOWN.

      ${dimension.instruction}
      Focus exclusively on comments authored by ${username}. Their comment IDs are: ${targetCommentIds}.

      Issue specification:
      ${specification}

      All comments in chronological order:
      ${allCommentsMap.join("\n")}

      Scoring rules:
      - 0: The comment does not satisfy this evaluation dimension.
      - 0.5: The comment partially satisfies this evaluation dimension.
      - 1: The comment strongly satisfies this evaluation dimension.
      - Ignore quoted text beginning with '>' and evaluate only the commenter's original contribution.
      - Return every target comment exactly once.

      Return only a JSON object mapping each target comment ID to a raw float between 0 and 1.
      Example Output Format (for format only — not content): {${exampleOutput}}

      YOUR RESPONSE MUST CONTAIN ONLY THE RAW JSON OBJECT WITH NO FORMATTING, NO EXPLANATION, NO BACKTICKS, NO CODE BLOCKS.
    `,
  }));
}

export function combineSpecializedScores(evaluations: SpecializedScores[], requiredCommentIds: number[]): Relevances {
  const dimensions = normalizeDimensions(evaluations);
  const totalWeight = dimensions.reduce((total, dimension) => total.add(dimension.weight), new Decimal(0));
  if (totalWeight.lte(0)) {
    throw new Error("At least one specialized evaluation weight must be greater than zero");
  }

  return requiredCommentIds.reduce<Relevances>((acc, commentId) => {
    const weightedScore = dimensions.reduce((total, dimension) => {
      const score = dimension.scores[String(commentId)];
      if (typeof score !== "number") {
        throw new Error(`Missing ${dimension.key} score for comment ${commentId}`);
      }
      return total.add(new Decimal(clampScore(score)).mul(dimension.weight));
    }, new Decimal(0));

    acc[String(commentId)] = weightedScore.div(totalWeight).toDecimalPlaces(3).toNumber();
    return acc;
  }, {});
}

function normalizeDimensions<T extends { key: string; weight: number }>(dimensions: T[]): T[] {
  if (!dimensions.length) {
    throw new Error("At least one specialized evaluation dimension is required");
  }
  return dimensions.map((dimension) => {
    if (!dimension.key.trim()) {
      throw new Error("Specialized evaluation dimension key is required");
    }
    if (!Number.isFinite(dimension.weight) || dimension.weight < 0) {
      throw new Error(`Invalid specialized evaluation weight for ${dimension.key}`);
    }
    return dimension;
  });
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.min(1, Math.max(0, score));
}
