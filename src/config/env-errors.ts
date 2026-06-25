import type { ZodError } from "zod";

export function configError(prefix: string, issues: readonly string[]): Error {
  return new Error(`${prefix}: ${issues.join("; ")}`);
}

export function zodConfigIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const key = issue.path.join(".") || "environment";
    return `${key}: ${issue.message}`;
  });
}
