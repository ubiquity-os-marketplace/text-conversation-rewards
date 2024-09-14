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

export function removeKeyFromObject<T extends Record<string, unknown>>(obj: T, keyToRemove: string): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => removeKeyFromObject(item, keyToRemove)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const newObj = {} as Record<string, unknown>;

    Object.keys(obj).forEach((key) => {
      if (key !== keyToRemove) {
        newObj[key] = removeKeyFromObject(obj[key] as T, keyToRemove);
      }
    });

    return newObj as T;
  }

  return obj;
}
