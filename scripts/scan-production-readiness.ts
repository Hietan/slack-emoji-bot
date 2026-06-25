import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

type Finding = {
  file: string;
  label: string;
};

const targetPaths = [
  ".github/workflows",
  "Dockerfile",
  "infra",
  "scripts",
  "slack",
  "src"
];

const excludedDirectories = new Set([".terraform", "dist", "node_modules"]);
const excludedFiles = new Set([basename(import.meta.filename)]);

const incompletePatterns = [
  {
    label: "incomplete marker",
    pattern: new RegExp("\\b(?:TO" + "DO|FIX" + "ME|HA" + "CK|X" + "XX)\\b", "u")
  },
  {
    label: "not implemented placeholder",
    pattern: new RegExp("not" + "\\s+" + "implemented", "iu")
  },
  {
    label: "placeholder throw",
    pattern: new RegExp("throw\\s+new\\s+Error\\s*\\([^)]*(?:TO" + "DO|not" + "\\s+" + "implemented)", "iu")
  }
];

const isLikelyBinary = (content: Buffer): boolean => content.includes(0);

const collectFiles = (path: string, files: string[] = []): string[] => {
  const stats = statSync(path);
  if (stats.isFile()) {
    if (!excludedFiles.has(basename(path))) {
      files.push(path);
    }
    return files;
  }

  for (const entry of readdirSync(path)) {
    if (excludedDirectories.has(entry)) {
      continue;
    }
    collectFiles(join(path, entry), files);
  }

  return files;
};

const findings: Finding[] = [];

for (const targetPath of targetPaths) {
  for (const file of collectFiles(targetPath)) {
    const content = readFileSync(file);
    if (isLikelyBinary(content)) {
      continue;
    }

    const text = content.toString("utf8");
    for (const { label, pattern } of incompletePatterns) {
      if (pattern.test(text)) {
        findings.push({
          file: relative(process.cwd(), file),
          label
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Production readiness scan found incomplete code markers:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.label}`);
  }
  process.exitCode = 1;
}
