import { Type, Static } from "@sinclair/typebox";

export enum AssignCommentPrecision {
  /**
   * Will skip comments from the first to last assignment of the user
   */
  ALL,
  /*
   * Will skip comments assigned exactly during user assignment
   */
  EXACT,
  /*
   * Won't skip comments
   */
  NONE,
}

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Enum(AssignCommentPrecision, {
    default: AssignCommentPrecision.ALL,
    description:
      "Do not offer credit to comments posted by a user between the time they were first assigned and last unassigned from the task.",
    examples: [AssignCommentPrecision.ALL, AssignCommentPrecision.EXACT, AssignCommentPrecision.NONE],
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
