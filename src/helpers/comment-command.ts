const SLASH_COMMAND_REGEX = /^\/[A-Za-z][\w-]*(?:\s|$)/;

export function isSlashCommandComment(body: string | null | undefined): boolean {
  return SLASH_COMMAND_REGEX.test(body?.trimStart() ?? "");
}
