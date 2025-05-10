import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const finishCommandSchema = T.Object({
  name: T.Literal("finish"),
  parameters: T.Object({}),
});

export type Command = StaticDecode<typeof finishCommandSchema>;
