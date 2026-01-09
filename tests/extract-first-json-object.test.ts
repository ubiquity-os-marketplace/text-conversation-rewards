import { extractFirstJsonObject } from "../src/helpers/extract-first-json-object";

describe("extractFirstJsonObject", () => {
  it("extracts JSON when response contains braces inside strings", () => {
    const input = 'Here you go:\n```json\n{"note":"ends with brace: }","a":1}\n```\nThanks!';
    expect(extractFirstJsonObject(input)).toBe('{"note":"ends with brace: }","a":1}');
  });

  it("extracts the first complete JSON object from surrounding text", () => {
    const input = 'prefix {"a":{"b":2},"c":[1,2,3]} suffix';
    expect(extractFirstJsonObject(input)).toBe('{"a":{"b":2},"c":[1,2,3]}');
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractFirstJsonObject("no json here")).toThrow("No JSON object start '{' found");
  });

  it("throws when JSON object never closes", () => {
    expect(() => extractFirstJsonObject('{"a": 1')).toThrow("No complete JSON object found");
  });
});
