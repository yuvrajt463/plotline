import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET = path.join(ROOT, "apps", "web", "public", "data", "manual-research.json");
const UPDATES = path.join(ROOT, "data", "manual-research-updates.json");

async function main() {
  const target = JSON.parse(await fs.readFile(TARGET, "utf8"));
  const updates = JSON.parse(await fs.readFile(UPDATES, "utf8"));
  target.generatedAt = new Date().toISOString();
  target.method = "Manual public-web research dump assembled from verified public sources. Run build-dashboard-research-dataset.mjs after paid/API enrichment to rebuild the final dashboard dataset.";

  for (const [state, cities] of Object.entries(updates.states || {})) {
    target.states[state] ||= {};
    for (const [city, payload] of Object.entries(cities)) {
      target.states[state][city] ||= {};
      for (const key of ["services", "rentals"]) {
        if (Array.isArray(payload[key])) {
          target.states[state][city][key] = dedupeByName(payload[key]);
        }
      }
    }
  }

  await fs.writeFile(TARGET, JSON.stringify(target, null, 2));
  console.log(`merged ${countCities(updates)} city packets into ${path.relative(ROOT, TARGET)}`);
}

function dedupeByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.name || item.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countCities(updates) {
  return Object.values(updates.states || {}).reduce((sum, cities) => sum + Object.keys(cities).length, 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
