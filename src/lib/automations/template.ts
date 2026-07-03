// Tiny, dependency-free template rendering for automation configs.
// Deliberately not a general template engine: a fixed placeholder set, no
// expressions, no user-supplied code paths.

const PLACEHOLDER_PATTERN = /\{\{\s*(date|time|datetime)\s*\}\}/g;

export function renderTemplate(template: string, now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16);
  const values: Record<string, string> = {
    date,
    time,
    datetime: `${date} ${time}`,
  };
  return template.replace(PLACEHOLDER_PATTERN, (_, key: string) => values[key] ?? "");
}
