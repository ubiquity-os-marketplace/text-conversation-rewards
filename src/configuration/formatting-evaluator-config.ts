import { Static, Type } from "@sinclair/typebox";
import { CommentAssociation, CommentKind, CommentType } from "./comment-types";

export const commentType = Type.Union(
  Object.keys(CommentKind).flatMap((kind) =>
    Object.keys(CommentAssociation).map((association) => Type.Literal(`${kind}_${association}` as CommentType))
  )
);

const regexType = Type.Record(Type.String(), Type.Number(), { minProperties: 1 });

/**
 * Attributed score per HTML entity
 */
const htmlType = Type.Record(Type.String(), Type.Number(), {
  default: {
    br: 0,
    code: 1,
    p: 1,
    em: 0,
    img: 1,
    strong: 0,
    blockquote: 0,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    a: 1,
    li: 1,
    ul: 1,
    td: 1,
    hr: 0,
    pre: 0,
    ol: 0,
  },
});

const rewardsType = Type.Object(
  {
    html: htmlType,
    regex: regexType,
  },
  { default: {} }
);

export const formattingEvaluatorConfigurationType = Type.Object(
  {
    /**
     * Multipliers applied to different parts of the comment body content
     */
    multipliers: Type.Array(
      Type.Object({
        role: Type.Array(commentType, { minItems: 1 }),
        multiplier: Type.Number(),
        rewards: rewardsType,
      }),
      {
        minItems: 1,
        default: [
          {
            role: ["ISSUE_SPECIFICATION"],
            multiplier: 1,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
          {
            role: ["ISSUE_AUTHOR"],
            multiplier: 1,
            rewards: { regex: { "\\b\\w+\\b": 0.2 } },
          },
          {
            role: ["ISSUE_ASSIGNEE"],
            multiplier: 0,
            rewards: { regex: { "\\b\\w+\\b": 0 } },
          },
          {
            role: ["ISSUE_COLLABORATOR"],
            multiplier: 1,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
          {
            role: ["ISSUE_CONTRIBUTOR"],
            multiplier: 0.25,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
          {
            role: ["PULL_SPECIFICATION"],
            multiplier: 0,
            rewards: { regex: { "\\b\\w+\\b": 0 } },
          },
          {
            role: ["PULL_AUTHOR"],
            multiplier: 2,
            rewards: { regex: { "\\b\\w+\\b": 0.2 } },
          },
          {
            role: ["PULL_ASSIGNEE"],
            multiplier: 1,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
          {
            role: ["PULL_COLLABORATOR"],
            multiplier: 1,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
          {
            role: ["PULL_CONTRIBUTOR"],
            multiplier: 0.25,
            rewards: { regex: { "\\b\\w+\\b": 0.1 } },
          },
        ],
      }
    ),
    wordCountExponent: Type.Number({ default: 0.85 }),
  },
  { default: {} }
);

export type FormattingEvaluatorConfiguration = Static<typeof formattingEvaluatorConfigurationType>;
