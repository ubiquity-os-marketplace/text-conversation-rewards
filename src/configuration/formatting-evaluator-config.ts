import { Static, TLiteral, TUnion, Type } from "@sinclair/typebox";
import { CommentAssociation, CommentKind, CommentType } from "./comment-types";

type IntoStringLiteralUnion<T> = { [K in keyof T]: T[K] extends string ? TLiteral<T[K]> : never };

function stringLiteralUnion<T extends string[]>(values: [...T]): TUnion<IntoStringLiteralUnion<T>> {
  const literals = values.map((value) => Type.Literal(value));
  return Type.Union(literals) as TUnion<IntoStringLiteralUnion<T>>;
}

export const commentType = stringLiteralUnion(
  Object.keys(CommentKind).flatMap((kind) =>
    Object.keys(CommentAssociation).map((association) => `${kind}_${association}`)
  ) as CommentType[]
);

export const wordRegex = /\b\w+\b/;
export const urlRegex = /https?:\/\/\S+/g;

const htmlEntity = Type.Object({
  score: Type.Number(),
  countWords: Type.Boolean({ default: true }),
});

/**
 * Attributed score per HTML entity
 */
const htmlType = Type.Record(Type.String(), htmlEntity, {
  default: {
    br: { score: 0, countWords: true },
    code: { score: 5, countWords: false },
    p: { score: 0, countWords: true },
    em: { score: 0, countWords: true },
    img: { score: 5, countWords: true },
    strong: { score: 0, countWords: false },
    blockquote: { score: 0, countWords: false },
    h1: { score: 1, countWords: true },
    h2: { score: 1, countWords: true },
    h3: { score: 1, countWords: true },
    h4: { score: 1, countWords: true },
    h5: { score: 1, countWords: true },
    h6: { score: 1, countWords: true },
    a: { score: 5, countWords: true },
    li: { score: 0.5, countWords: true },
    ul: { score: 1, countWords: true },
    td: { score: 0, countWords: true },
    hr: { score: 0, countWords: true },
    pre: { score: 0, countWords: false },
    ol: { score: 1, countWords: true },
  },
});

const rewardsType = Type.Object(
  {
    html: htmlType,
    wordValue: Type.Number({ default: 0.1 }),
  },
  { default: {} }
);

export const formattingEvaluatorConfigurationType = Type.Object(
  {
    /**
     * Multipliers applied to different parts of the comment body content
     */
    multipliers: Type.Transform(
      Type.Array(
        Type.Object({
          role: Type.Array(commentType, { minItems: 1 }),
          multiplier: Type.Number(),
          rewards: rewardsType,
        }),
        {
          default: [
            {
              role: ["ISSUE_SPECIFICATION"],
              multiplier: 1,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["ISSUE_AUTHOR"],
              multiplier: 1,
              rewards: { wordValue: 0.2, html: htmlType.default },
            },
            {
              role: ["ISSUE_ASSIGNEE"],
              multiplier: 1,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["ISSUE_COLLABORATOR"],
              multiplier: 1,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["ISSUE_CONTRIBUTOR"],
              multiplier: 0.25,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["PULL_SPECIFICATION"],
              multiplier: 0,
              rewards: { wordValue: 0, html: htmlType.default },
            },
            {
              role: ["PULL_AUTHOR"],
              multiplier: 0,
              rewards: { wordValue: 0.2, html: htmlType.default },
            },
            {
              role: ["PULL_ASSIGNEE"],
              multiplier: 1,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["PULL_COLLABORATOR"],
              multiplier: 1,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
            {
              role: ["PULL_CONTRIBUTOR"],
              multiplier: 0.25,
              rewards: { wordValue: 0.1, html: htmlType.default },
            },
          ],
        }
      )
    )
      .Decode((value) => {
        const resultMap = new Map();
        for (const item of value) {
          for (const role of item.role) {
            if (!resultMap.has(role)) {
              resultMap.set(role, { ...item, role: [role] });
            }
          }
        }
        return Array.from(resultMap.values());
      })
      .Encode((value) => {
        return value;
      }),
    wordCountExponent: Type.Number({ default: 0.85 }),
  },
  { default: {} }
);

export type FormattingEvaluatorConfiguration = Static<typeof formattingEvaluatorConfigurationType>;
