import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Finding = {
  file: string;
  label: string;
};

const excludedDirectories = new Set([
  ".git",
  ".terraform",
  "coverage",
  "dist",
  "node_modules"
]);

const excludedFiles = new Set(["pnpm-lock.yaml"]);

const secretPatterns = [
  {
    label: "Slack token literal",
    pattern: new RegExp("xox" + "[baprs]-" + "[0-9A-Za-z-]+", "u")
  },
  {
    label: "Google API key literal",
    pattern: new RegExp("AIza" + "[0-9A-Za-z_-]+", "u")
  },
  {
    label: "service account JSON type marker",
    pattern: new RegExp("\"type\"\\s*:\\s*\"service_account\"", "u")
  },
  {
    label: "service account private key material",
    pattern: new RegExp("\"private_key\"\\s*:\\s*\"-----BEGIN PRIVATE KEY", "u")
  }
];

const loggerForbiddenFields = [
  "analysisText",
  "rawBody",
  "requestBody",
  "responseBody",
  "authorization",
  "slackSignature",
  "slackToken",
  "geminiApiKey",
  "geminiRawOutput"
];

const isLikelyBinary = (content: Buffer): boolean => content.includes(0);

const collectFiles = (directory: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(directory)) {
    if (excludedDirectories.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      collectFiles(path, files);
      continue;
    }

    if (stats.isFile() && !excludedFiles.has(entry)) {
      files.push(path);
    }
  }

  return files;
};

const findings: Finding[] = [];

for (const file of collectFiles(process.cwd())) {
  const content = readFileSync(file);
  if (isLikelyBinary(content)) {
    continue;
  }

  const text = content.toString("utf8");
  for (const { label, pattern } of secretPatterns) {
    if (pattern.test(text)) {
      findings.push({
        file: relative(process.cwd(), file),
        label
      });
    }
  }

  const relativeFile = relative(process.cwd(), file);
  if (relativeFile.startsWith("src/") || relativeFile.startsWith("scripts/")) {
    for (const call of extractLoggerCalls(text)) {
      for (const field of loggerForbiddenFields) {
        const pattern = new RegExp(`\\b${field}\\b`, "u");
        if (pattern.test(call)) {
          findings.push({
            file: relativeFile,
            label: `forbidden logger field: ${field}`
          });
        }
      }
    }
  }
}

function extractLoggerCalls(text: string): string[] {
  const calls: string[] = [];
  const loggerCallPattern = /logger\.(?:trace|debug|info|warn|error|fatal)\s*\(/gu;
  for (const match of text.matchAll(loggerCallPattern)) {
    const start = match.index;
    let depth = 0;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          calls.push(text.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return calls;
}

if (findings.length > 0) {
  console.error("Potential sensitive content found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.label}`);
  }
  process.exitCode = 1;
}
