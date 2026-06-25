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
}

if (findings.length > 0) {
  console.error("Potential sensitive content found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.label}`);
  }
  process.exitCode = 1;
}
