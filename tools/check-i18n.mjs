import fs from "node:fs";
import path from "node:path";

const translations = JSON.parse(fs.readFileSync("lang/en.json", "utf8"));
const dottedRootKeys = Object.keys(translations).filter((key) => key.includes("."));

if (dottedRootKeys.length) {
  throw new Error(`Found dotted top-level localization keys:\n${dottedRootKeys.join("\n")}`);
}

const roots = ["templates", "module"];
const files = ["star-frontiers.mjs"];
const refs = new Set();

for (const root of roots) {
  collectFiles(root, files);
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const [ref] of text.matchAll(/STARFRONTIERS\.[A-Za-z0-9.]+/g)) {
    if (ref.endsWith(".")) continue;
    refs.add(ref);
  }
}

const missing = [...refs].filter((ref) => !hasPath(translations, ref));

if (missing.length) {
  throw new Error(`Missing localization keys:\n${missing.sort().join("\n")}`);
}

console.log("localization references ok");

function collectFiles(root, files) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
}

function hasPath(object, ref) {
  let cursor = object;
  for (const part of ref.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return false;
    cursor = cursor[part];
  }
  return true;
}
