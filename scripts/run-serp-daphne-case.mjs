import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV = path.join(ROOT, ".env");
const PLAN = path.join(ROOT, "data", "serp-2-call-smoke-test-plan.json");
const RAW_DIR = path.join(ROOT, "data", "raw", "serpapi", isoDate());
const EXTRACTION_OUT = path.join(ROOT, "data", "serp-daphne-case-extraction.json");
const UPDATES = path.join(ROOT, "data", "manual-research-updates.json");

const SERVICE_WORDS = [
  "hvac",
  "heating",
  "air",
  "cooling",
  "plumb",
  "electric",
  "pest",
  "termite",
  "roof",
  "lawn",
  "landscape"
];

const RENTAL_WORDS = [
  "apartment",
  "apartments",
  "rent",
  "rental",
  "property management",
  "homes",
  "community",
  "townhomes"
];

async function main() {
  const env = await readEnv();
  const apiKey = env.SERPAPI_KEY || env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY or SERP_API_KEY is missing from .env");
  }

  const plan = JSON.parse(await fs.readFile(PLAN, "utf8"));
  const calls = plan.calls.slice(0, 2);
  if (calls.length !== 2) {
    throw new Error(`Expected 2 Daphne test calls, found ${calls.length}`);
  }

  await fs.mkdir(RAW_DIR, { recursive: true });

  const rawResponses = [];
  for (const call of calls) {
    const rawPath = path.join(RAW_DIR, `${call.id}.json`);
    const payload = await readRawIfPresent(rawPath) || await runSerpCall(call, apiKey);
    await fs.writeFile(rawPath, `${JSON.stringify(payload, null, 2)}\n`);
    rawResponses.push({ call, payload, rawPath: path.relative(ROOT, rawPath) });
  }

  const extracted = normalizeResponses(rawResponses);
  await fs.writeFile(EXTRACTION_OUT, `${JSON.stringify(extracted, null, 2)}\n`);
  await appendToManualUpdates(extracted);

  console.log(`ran ${rawResponses.length} SerpAPI calls for Daphne`);
  console.log(`saved raw responses in ${path.relative(ROOT, RAW_DIR)}`);
  console.log(`extracted ${extracted.services.length} service candidates and ${extracted.rentals.length} rental candidates`);
  console.log(`wrote normalized extraction to ${path.relative(ROOT, EXTRACTION_OUT)}`);
  console.log(`appended candidates to ${path.relative(ROOT, UPDATES)}`);
}

async function runSerpCall(call, apiKey) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(call.serpapiParams || {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  params.set("api_key", apiKey);

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: {
      "accept": "application/json"
    }
  });

  const body = await response.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`SerpAPI returned non-JSON for ${call.id}: HTTP ${response.status}`);
  }

  if (!response.ok || json.error) {
    throw new Error(`SerpAPI failed for ${call.id}: ${json.error || `HTTP ${response.status}`}`);
  }

  return json;
}

function normalizeResponses(rawResponses) {
  const services = [];
  const rentals = [];
  const diagnostics = [];

  for (const { call, payload, rawPath } of rawResponses) {
    diagnostics.push({
      callId: call.id,
      engine: call.engine,
      rawPath,
      localResults: Array.isArray(payload.local_results) ? payload.local_results.length : 0,
      organicResults: Array.isArray(payload.organic_results) ? payload.organic_results.length : 0,
      searchInformation: payload.search_information || null
    });

    if (call.layer === "services") {
      services.push(...extractServices(call, payload, rawPath));
    }

    if (call.layer === "rentals") {
      rentals.push(...extractRentals(call, payload, rawPath));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "SerpAPI actual two-call Daphne case",
    callsRun: rawResponses.map(({ call, rawPath }) => ({
      id: call.id,
      layer: call.layer,
      engine: call.engine,
      query: call.query,
      rawPath
    })),
    insertTargets: {
      services: "data/manual-research-updates.json -> states.AL.Daphne.services",
      rentals: "data/manual-research-updates.json -> states.AL.Daphne.rentals",
      dashboardDump: "apps/web/public/data/manual-research.json after merge script"
    },
    diagnostics,
    services: dedupeRecords(services),
    rentals: dedupeRecords(rentals)
  };
}

function extractServices(call, payload, rawPath) {
  const local = Array.isArray(payload.local_results) ? payload.local_results : [];
  const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];

  const localRecords = local.map((item, index) => {
    const name = cleanTitle(item.title || item.name || `Serp service result ${index + 1}`);
    return {
      id: `serp-daphne-al-service-${slug(name)}`,
      name,
      category: inferServiceCategory([item.type, item.description, item.snippet, name].join(" ")),
      marketClass: inferMarketClass(name),
      address: item.address || null,
      sourceUrl: item.links?.website || item.website || item.link || item.place_id_search || null,
      evidence: compactEvidence([
        "SerpAPI Google Local result for the Daphne service query.",
        item.type ? `Type: ${item.type}.` : "",
        item.address ? `Address: ${item.address}.` : "",
        item.rating ? `Rating shown: ${item.rating}.` : "",
        item.reviews ? `Reviews shown: ${item.reviews}.` : ""
      ]),
      source: "SerpAPI Google Local",
      rawPath,
      serpCallId: call.id
    };
  });

  const organicRecords = organic
    .filter((item) => containsAny(`${item.title || ""} ${item.snippet || ""}`, SERVICE_WORDS))
    .map((item, index) => {
      const name = cleanTitle(item.title || `Serp service source ${index + 1}`);
      return {
        id: `serp-daphne-al-service-source-${slug(name)}`,
        name,
        category: inferServiceCategory(`${item.title || ""} ${item.snippet || ""}`),
        marketClass: inferMarketClass(name),
        address: null,
        sourceUrl: item.link || null,
        evidence: compactEvidence([
          "SerpAPI organic result for the Daphne service query.",
          item.snippet ? trimSentence(item.snippet) : ""
        ]),
        source: "SerpAPI organic",
        rawPath,
        serpCallId: call.id
      };
    });

  return [...localRecords, ...organicRecords].filter((record) => record.sourceUrl);
}

function extractRentals(call, payload, rawPath) {
  const organic = Array.isArray(payload.organic_results) ? payload.organic_results : [];
  const local = Array.isArray(payload.local_results) ? payload.local_results : [];

  const organicRecords = organic
    .filter((item) => containsAny(`${item.title || ""} ${item.snippet || ""}`, RENTAL_WORDS))
    .map((item, index) => {
      const name = cleanRentalName(item.title || `Serp rental source ${index + 1}`);
      return {
        id: `serp-daphne-al-rental-${slug(name)}`,
        name,
        category: inferRentalCategory(`${item.title || ""} ${item.snippet || ""}`),
        managementCompany: inferManager(`${item.title || ""} ${item.snippet || ""}`),
        address: null,
        sourceUrl: item.link || null,
        evidence: compactEvidence([
          "SerpAPI organic result for the Daphne rental/property-management query.",
          item.snippet ? trimSentence(item.snippet) : ""
        ]),
        source: "SerpAPI organic",
        rawPath,
        serpCallId: call.id
      };
    });

  const localRecords = local.map((item, index) => {
    const name = cleanTitle(item.title || item.name || `Serp rental result ${index + 1}`);
    return {
      id: `serp-daphne-al-rental-local-${slug(name)}`,
      name,
      category: inferRentalCategory([item.type, item.description, item.snippet, name].join(" ")),
      managementCompany: null,
      address: item.address || null,
      sourceUrl: item.links?.website || item.website || item.link || item.place_id_search || null,
      evidence: compactEvidence([
        "SerpAPI local result for the Daphne rental/property-management query.",
        item.type ? `Type: ${item.type}.` : "",
        item.address ? `Address: ${item.address}.` : ""
      ]),
      source: "SerpAPI Google Local",
      rawPath,
      serpCallId: call.id
    };
  });

  return [...organicRecords, ...localRecords].filter((record) => record.sourceUrl);
}

async function appendToManualUpdates(extracted) {
  const updates = JSON.parse(await fs.readFile(UPDATES, "utf8"));
  updates.states ||= {};
  updates.states.AL ||= {};
  updates.states.AL.Daphne ||= {};
  updates.states.AL.Daphne.services = mergeByKey(updates.states.AL.Daphne.services || [], extracted.services);
  updates.states.AL.Daphne.rentals = mergeByKey(updates.states.AL.Daphne.rentals || [], extracted.rentals);
  await fs.writeFile(UPDATES, `${JSON.stringify(updates, null, 2)}\n`);
}

function mergeByKey(existing, additions) {
  const merged = [...existing];
  const keys = new Set(existing.map(recordKey));
  for (const item of additions) {
    const key = recordKey(item);
    if (keys.has(key)) continue;
    merged.push(item);
    keys.add(key);
  }
  return merged;
}

function dedupeRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recordKey(record) {
  return [record.name, record.address, record.sourceUrl]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|:/.-]/g, "");
}

function inferServiceCategory(text) {
  const haystack = text.toLowerCase();
  const categories = [];
  if (haystack.includes("hvac") || haystack.includes("heating") || haystack.includes("air conditioning") || haystack.includes("cooling")) categories.push("HVAC");
  if (haystack.includes("plumb")) categories.push("plumbing");
  if (haystack.includes("electric")) categories.push("electrical");
  if (haystack.includes("pest") || haystack.includes("termite")) categories.push("pest control");
  if (haystack.includes("roof")) categories.push("roofing");
  if (haystack.includes("lawn") || haystack.includes("landscap")) categories.push("landscaping");
  return categories.length ? categories.join(", ") : "home services";
}

function inferRentalCategory(text) {
  const haystack = text.toLowerCase();
  if (haystack.includes("property management")) return "property manager";
  if (haystack.includes("townhome")) return "townhome community";
  if (haystack.includes("single family") || haystack.includes("house")) return "single-family rental";
  if (haystack.includes("senior")) return "senior apartment community";
  return "rental source";
}

function inferMarketClass(name) {
  const haystack = name.toLowerCase();
  const chainSignals = ["orkin", "terminix", "massey", "arrow", "mr. electric", "mister sparky", "one hour", "benjamin franklin", "roto-rooter"];
  if (chainSignals.some((signal) => haystack.includes(signal))) return "chain";
  return "local/regional";
}

function inferManager(text) {
  const managers = [
    "Greystar",
    "RPM Living",
    "Asset Living",
    "Cushman & Wakefield",
    "FirstKey Homes",
    "Progress Residential",
    "Invitation Homes",
    "Bell Partners",
    "RangeWater"
  ];
  return managers.find((manager) => text.toLowerCase().includes(manager.toLowerCase())) || null;
}

function cleanRentalName(value) {
  return cleanTitle(value)
    .replace(/\s*-\s*Daphne,\s*AL.*$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();
}

function cleanTitle(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+Google Search$/i, "")
    .trim();
}

function compactEvidence(parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function trimSentence(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function containsAny(text, needles) {
  const haystack = text.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function readEnv() {
  const text = await fs.readFile(ENV, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

async function readRawIfPresent(rawPath) {
  try {
    return JSON.parse(await fs.readFile(rawPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
