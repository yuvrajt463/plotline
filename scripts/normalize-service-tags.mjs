import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_FILES = [
  "apps/web/public/data/manual-research.json",
  "apps/web/public/data/final-market-research.json",
  "apps/web/public/data/al-free-research.json",
  "apps/web/public/data/ga-free-research.json"
];

const SERVICE_TAGS = ["HVAC", "Electrical", "Plumbing", "Pest"];

let taggedRecords = 0;
const counts = new Map([...SERVICE_TAGS, "Other"].map((tag) => [tag, 0]));

for (const relativePath of DATA_FILES) {
  const filePath = path.join(ROOT, relativePath);
  const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
  const fileCounts = { records: 0 };
  visit(payload, fileCounts);
  if (fileCounts.records > 0) {
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(`${relativePath}: tagged ${fileCounts.records} service records`);
}

console.log(
  `Total tagged ${taggedRecords} service records: ${[...counts.entries()]
    .map(([tag, count]) => `${tag}=${count}`)
    .join(", ")}`
);

function visit(node, fileCounts) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, fileCounts);
    return;
  }

  if (Array.isArray(node.services)) {
    for (const service of node.services) tagService(service, fileCounts);
  }

  if (node.type === "services" && Array.isArray(node.items)) {
    for (const service of node.items) tagService(service, fileCounts);
  }

  for (const value of Object.values(node)) visit(value, fileCounts);
}

function tagService(service, fileCounts) {
  if (!service || typeof service !== "object") return;
  const tags = inferServiceTags(service);
  service.serviceTags = tags;
  taggedRecords += 1;
  fileCounts.records += 1;
  for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
}

function inferServiceTags(service) {
  const existing = normalizeExistingTags(service.serviceTags);
  const text = [
    service.name,
    service.category,
    service.evidence,
    service.evidenceNote,
    service.description,
    service.type,
    service.sourceUrl,
    service.website,
    service.tags?.name,
    service.tags?.description,
    service.tags?.shop,
    service.tags?.office
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags = new Set(existing);
  if (/\b(hvac|h\.?v\.?a\.?c\.?|heating|cooling|air conditioning|air-conditioning|a\/c|ac repair|furnace|heat pump|refrigeration)\b/i.test(text)) {
    tags.add("HVAC");
  }
  if (/\b(electric|electrical|electrician|lighting|generator|panel|ev charger)\b/i.test(text)) {
    tags.add("Electrical");
  }
  if (/\b(plumb\w*|sewer|drain|water heater|septic)\b/i.test(text)) {
    tags.add("Plumbing");
  }
  if (/\b(pest|termite|exterminat\w*|mosquito|rodent|wildlife|bed bug|bug control|ant control)\b/i.test(text)) {
    tags.add("Pest");
  }

  const ordered = SERVICE_TAGS.filter((tag) => tags.has(tag));
  return ordered.length ? ordered : ["Other"];
}

function normalizeExistingTags(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,/|]+/) : [];
  const tags = new Set();
  for (const raw of values) {
    const text = String(raw).trim().toLowerCase();
    if (!text) continue;
    if (text.includes("hvac") || text.includes("heating") || text.includes("cooling")) tags.add("HVAC");
    if (text.includes("electric")) tags.add("Electrical");
    if (text.includes("plumb")) tags.add("Plumbing");
    if (text.includes("pest") || text.includes("termite")) tags.add("Pest");
    if (text === "other") tags.add("Other");
  }
  return tags;
}
