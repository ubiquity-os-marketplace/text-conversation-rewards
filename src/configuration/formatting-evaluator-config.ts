import { Static, Type } from "@sinclair/typebox";
import { CommentAssociation, CommentKind, CommentType } from "./comment-types";

export const commentType = Type.Union(
  Object.keys(CommentKind).flatMap((kind) =>
    Object.keys(CommentAssociation).map((association) => Type.Literal(`${kind}_${association}` as CommentType))
  )
);

const regexType = Type.Record(Type.String(), Type.Number(), { minProperties: 1 });

const htmlEntity = Type.Object({
  score: Type.Number(),
  stripTextContent: Type.Boolean({ default: false }),
});

/**
 * Attributed score per HTML entity
 */
const htmlType = Type.Record(Type.String(), htmlEntity, {
  default: {
    br: { score: 0, stripTextContent: false },
    code: { score: 5, stripTextContent: true },
    p: { score: 1, stripTextContent: false },
    em: { score: 0, stripTextContent: false },
    img: { score: 5, stripTextContent: false },
    strong: { score: 0, stripTextContent: false },
    blockquote: { score: 0, stripTextContent: true },
    h1: { score: 1, stripTextContent: false },
    h2: { score: 1, stripTextContent: false },
    h3: { score: 1, stripTextContent: false },
    h4: { score: 1, stripTextContent: false },
    h5: { score: 1, stripTextContent: false },
    h6: { score: 1, stripTextContent: false },
    a: { score: 5, stripTextContent: false },
    li: { score: 1, stripTextContent: false },
    ul: { score: 0, stripTextContent: false },
    td: { score: 1, stripTextContent: false },
    hr: { score: 0, stripTextContent: false },
    pre: { score: 0, stripTextContent: false },
    ol: { score: 0, stripTextContent: false },
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
