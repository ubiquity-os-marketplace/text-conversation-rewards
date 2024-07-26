import { commentEnum } from "../configuration/comment-types";

export function typeReplacer(key: string, value: string | number) {
  // Changes "type" to be human-readable
  if (key === "type" && typeof value === "number") {
    const typeNames: string[] = [];
    const types = Object.values(commentEnum) as number[];
    types.reverse().forEach((typeValue) => {
      if (value & typeValue) {
        typeNames.push(commentEnum[typeValue]);
      }
    });
    return typeNames.join("_");
  }
  return value;
}
