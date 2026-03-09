import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";

export const commandSchema = T.Object({
  name: T.Literal("finish", {
    examples: ["/finish"],
    description: "Forcefully close the task and generate rewards.",
  }),
  parameters: T.Object({}),
});

export type Command = StaticDecode<typeof commandSchema>;
