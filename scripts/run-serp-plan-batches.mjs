import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV = path.join(ROOT, ".env");
const PLAN = path.join(ROOT, "data", "serp-200-call-plan.json");
const RAW_ROOT = path.join(ROOT, "data", "raw", "serpapi", "full-200");
const STATUS_OUT = path.join(ROOT, "data", "serp-run-status.json");
const COMPILED_OUT = path.join(ROOT, "data", "serp-compiled-results.json");

const BATCH_SIZE = Number(process.env.SERP_BATCH_SIZE || 10);
const MAX_CALLS = Number(process.env.SERP_MAX_CALLS || 0);
const DELAY_MS = Number(process.env.SERP_BATCH_DELAY_MS || 750);
const SKIP_CALL_IDS = new Set(
  String(process.env.SERP_SKIP_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const SERVICE_WORDS = [
  "hvac",
  "heating",
  "cooling",
  "air conditioning",
  "plumb",
  "electric",
  "pest",
  "termite",
  "roof",
  "lawn",
  "landscap",
  "septic",
  "irrigation"
];

const RENTAL_WORDS = [
  "apartment",
  "apartments",
  "rent",
  "rental",
  "property management",
  "townhome",
  "homes",
  "community",
  "villas",
  "landing",
  "heights",
  "reserve"
];

const GENERIC_RENTAL_TITLES = [
  "apartments for rent",
  "homes for rent",
  "houses for rent",
  "rentals in",
  "apartment communities for rent",
  "best apartments",
  "daily updates"
];

const MARKETPLACE_HOSTS = [
  "apartments.com",
  "zillow.com",
  "realtor.com",
  "trulia.com",
  "homes.com",
  "redfin.com",
  "rent.com",
  "apartmentfinder.com",
  "apartmentguide.com",
  "yelp.com"
];

async function main() {
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
    throw new Error("SERP_BATCH_SIZE must be a positive integer");
  }

  const env = await readEnv();
  const apiKey = env.SERPAPI_KEY || env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY or SERP_API_KEY is missing from .env");
  }

  const plan = JSON.parse(await fs.readFile(PLAN, "utf8"));
  const plannedCalls = plan.calls.filter((call) => !SKIP_CALL_IDS.has(call.id));
  const calls = MAX_CALLS > 0 ? plannedCalls.slice(0, MAX_CALLS) : plannedCalls;
  await fs.mkdir(RAW_ROOT, { recursive: true });

  const status = await readJsonIfPresent(STATUS_OUT) || {
    plan: path.relative(ROOT, PLAN),
    rawRoot: path.relative(ROOT, RAW_ROOT),
    generatedAt: null,
    totalPlannedCalls: calls.length,
    batchSize: BATCH_SIZE,
    skippedCallIds: [...SKIP_CALL_IDS],
    calls: {}
  };
  status.generatedAt = new Date().toISOString();
  status.totalPlannedCalls = calls.length;
  status.batchSize = BATCH_SIZE;
  status.skippedCallIds = [...SKIP_CALL_IDS];

  for (let start = 0; start < calls.length; start += BATCH_SIZE) {
    const batch = calls.slice(start, start + BATCH_SIZE);
    const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
    console.log(`batch ${batchNumber}: calls ${start + 1}-${start + batch.length} of ${calls.length}`);

    const results = await Promise.all(batch.map((call) => runOne(call, apiKey)));
    for (const result of results) {
      status.calls[result.call.id] = {
        status: result.status,
        rawPath: path.relative(ROOT, result.rawPath),
        ranAt: result.ranAt,
        fallback: result.fallback || null,
        error: result.error || null
      };
    }

    status.generatedAt = new Date().toISOString();
    await fs.writeFile(STATUS_OUT, `${JSON.stringify(status, null, 2)}\n`);
    await compileFromRaw(calls);
    await delay(DELAY_MS);
  }

  const compiled = await compileFromRaw(calls);
  const completed = Object.values(status.calls).filter((call) => call.status === "ok" || call.status === "cached").length;
  const failed = Object.values(status.calls).filter((call) => call.status === "error").length;
  console.log(`completed ${completed}/${calls.length} SerpAPI calls; failed ${failed}`);
  console.log(`compiled ${compiled.totals.serviceCandidates} services, ${compiled.totals.rentalCandidates} rentals, ${compiled.totals.sourceIndexes} source indexes`);
}

async function runOne(call, apiKey) {
  const rawPath = path.join(RAW_ROOT, `${call.id}.json`);
  const cached = await readJsonIfPresent(rawPath);
  if (cached) {
    return {
      call,
      rawPath,
      status: "cached",
      ranAt: new Date().toISOString()
    };
  }

  try {
    const first = await requestSerp(call.serpapiParams, apiKey);
    let payload = first.payload;
    let fallback = null;

    if (first.error && isUnsupportedLocation(first.error) && call.serpapiParams?.location) {
      const retryParams = { ...call.serpapiParams };
      delete retryParams.location;
      payload = (await requestSerp(retryParams, apiKey)).payload;
      fallback = "removed unsupported location parameter";
    } else if (first.error) {
      throw new Error(first.error);
    }

    if (payload?.error) {
      throw new Error(payload.error);
    }

    await fs.writeFile(rawPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
    return {
      call,
      rawPath,
      status: "ok",
      ranAt: new Date().toISOString(),
      fallback
    };
  } catch (error) {
    return {
      call,
      rawPath,
      status: "error",
      ranAt: new Date().toISOString(),
      error: error.message
    };
  }
}

async function requestSerp(paramsObject, apiKey) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(paramsObject || {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  params.set("api_key", apiKey);

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: { accept: "application/json" }
  });
  const text = await response.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { payload: null, error: `SerpAPI returned non-JSON: HTTP ${response.status}` };
  }

  if (!response.ok || payload.error) {
    return { payload, error: payload.error || `HTTP ${response.status}` };
  }

  return { payload, error: null };
}

async function compileFromRaw(calls) {
  const compiled = {
    generatedAt: new Date().toISOString(),
    source: "Derived from raw SerpAPI responses. Raw JSON is stored separately and never modified by this compiler.",
    rawRoot: path.relative(ROOT, RAW_ROOT),
    totals: {
      rawResponses: 0,
      serviceCandidates: 0,
      rentalCandidates: 0,
      sourceIndexes: 0,
      sourceNotes: 0
    },
    states: {},
    sourceIndexes: [],
    sourceNotes: []
  };

  for (const call of calls) {
    const rawPath = path.join(RAW_ROOT, `${call.id}.json`);
    const payload = await readJsonIfPresent(rawPath);
    if (!payload) continue;

    compiled.totals.rawResponses += 1;
    if (call.layer === "services") {
      const records = extractServices(call, payload, rawPath);
      appendCityRecords(compiled, call, "services", records);
    } else if (call.layer === "rentals") {
      const { entityRecords, sourceIndexes } = extractRentals(call, payload, rawPath);
      appendCityRecords(compiled, call, "rentals", entityRecords);
      compiled.sourceIndexes.push(...sourceIndexes);
    } else {
      compiled.sourceNotes.push(...extractSourceNotes(call, payload, rawPath));
    }
  }

  dedupeCompiled(compiled);
  compiled.totals.serviceCandidates = countCityRecords(compiled, "services");
  compiled.totals.rentalCandidates = countCityRecords(compiled, "rentals");
  compiled.totals.sourceIndexes = compiled.sourceIndexes.length;
  compiled.totals.sourceNotes = compiled.sourceNotes.length;

  await fs.writeFile(COMPILED_OUT, `${JSON.stringify(compiled, null, 2)}\n`);
  return compiled;
}

function extractServices(call, payload, rawPath) {
  const localRecords = localResults(payload).map((item, index) => {
    const name = cleanTitle(item.title || item.name || `Serp service result ${index + 1}`);
    return {
      id: `${call.id}-service-${slug(name)}`,
      name,
      category: inferServiceCategory([item.type, item.description, item.snippet, name, call.categories?.join(" ")].join(" ")),
      marketClass: inferMarketClass(name),
      address: item.address || null,
      sourceUrl: bestUrl(item),
      evidence: compactEvidence([
        `SerpAPI ${call.engine} result for "${call.query}".`,
        item.type ? `Type: ${item.type}.` : "",
        item.address ? `Address: ${item.address}.` : "",
        item.rating ? `Rating shown: ${item.rating}.` : "",
        item.reviews ? `Reviews shown: ${item.reviews}.` : ""
      ]),
      source: `SerpAPI ${call.engine}`,
      rawPath: path.relative(ROOT, rawPath),
      serpCallId: call.id,
      confidence: item.links?.website || item.website ? "high" : "medium"
    };
  });

  const organicRecords = organicResults(payload)
    .filter((item) => containsAny(`${item.title || ""} ${item.snippet || ""}`, SERVICE_WORDS))
    .map((item, index) => {
      const name = cleanTitle(item.title || `Serp service source ${index + 1}`);
      return {
        id: `${call.id}-service-organic-${slug(name)}`,
        name,
        category: inferServiceCategory(`${item.title || ""} ${item.snippet || ""} ${call.categories?.join(" ") || ""}`),
        marketClass: inferMarketClass(name),
        address: null,
        sourceUrl: item.link || null,
        evidence: compactEvidence([
          `SerpAPI organic result for "${call.query}".`,
          item.snippet ? trimSentence(item.snippet) : ""
        ]),
        source: "SerpAPI organic",
        rawPath: path.relative(ROOT, rawPath),
        serpCallId: call.id,
        confidence: looksOfficial(item.link) ? "medium" : "low"
      };
    });

  return [...localRecords, ...organicRecords].filter((record) => record.name && record.sourceUrl);
}

function extractRentals(call, payload, rawPath) {
  const allRecords = [
    ...localResults(payload).map((item, index) => {
      const name = cleanRentalName(item.title || item.name || `Serp rental result ${index + 1}`);
      return {
        id: `${call.id}-rental-local-${slug(name)}`,
        name,
        category: inferRentalCategory([item.type, item.description, item.snippet, name].join(" ")),
        managementCompany: inferManager(`${name} ${item.description || ""} ${item.snippet || ""}`),
        address: item.address || null,
        sourceUrl: bestUrl(item),
        evidence: compactEvidence([
          `SerpAPI ${call.engine} result for "${call.query}".`,
          item.type ? `Type: ${item.type}.` : "",
          item.address ? `Address: ${item.address}.` : "",
          item.rating ? `Rating shown: ${item.rating}.` : "",
          item.reviews ? `Reviews shown: ${item.reviews}.` : ""
        ]),
        source: `SerpAPI ${call.engine}`,
        rawPath: path.relative(ROOT, rawPath),
        serpCallId: call.id,
        confidence: item.links?.website || item.website ? "high" : "medium"
      };
    }),
    ...organicResults(payload)
      .filter((item) => containsAny(`${item.title || ""} ${item.snippet || ""}`, RENTAL_WORDS))
      .map((item, index) => {
        const name = cleanRentalName(item.title || `Serp rental source ${index + 1}`);
        return {
          id: `${call.id}-rental-organic-${slug(name)}`,
          name,
          category: inferRentalCategory(`${item.title || ""} ${item.snippet || ""}`),
          managementCompany: inferManager(`${item.title || ""} ${item.snippet || ""}`),
          address: null,
          sourceUrl: item.link || null,
          evidence: compactEvidence([
            `SerpAPI organic result for "${call.query}".`,
            item.snippet ? trimSentence(item.snippet) : ""
          ]),
          source: "SerpAPI organic",
          rawPath: path.relative(ROOT, rawPath),
          serpCallId: call.id,
          confidence: looksOfficial(item.link) ? "medium" : "low"
        };
      })
  ].filter((record) => record.name && isPublicSourceUrl(record.sourceUrl));

  const entityRecords = [];
  const sourceIndexes = [];
  for (const record of allRecords) {
    if (isGenericRentalSource(record)) {
      sourceIndexes.push({
        ...record,
        state: call.state,
        city: call.city,
        reason: "Generic rental marketplace/search page retained for analyst traceability but not merged into the dashboard entity list."
      });
    } else {
      entityRecords.push(record);
    }
  }

  return { entityRecords, sourceIndexes };
}

function extractSourceNotes(call, payload, rawPath) {
  return organicResults(payload).map((item, index) => ({
    id: `${call.id}-source-note-${index + 1}`,
    state: call.state,
    city: call.city || null,
    layer: call.layer,
    title: cleanTitle(item.title || `Source note ${index + 1}`),
    sourceUrl: item.link || null,
    evidence: trimSentence(item.snippet || ""),
    rawPath: path.relative(ROOT, rawPath),
    serpCallId: call.id
  })).filter((record) => record.sourceUrl);
}

function appendCityRecords(compiled, call, key, records) {
  if (!call.state || !call.city) return;
  compiled.states[call.state] ||= {};
  compiled.states[call.state][call.city] ||= { services: [], rentals: [] };
  compiled.states[call.state][call.city][key].push(...records);
}

function dedupeCompiled(compiled) {
  for (const cities of Object.values(compiled.states)) {
    for (const city of Object.values(cities)) {
      city.services = dedupeRecords(city.services);
      city.rentals = dedupeRecords(city.rentals);
    }
  }
  compiled.sourceIndexes = dedupeRecords(compiled.sourceIndexes);
  compiled.sourceNotes = dedupeRecords(compiled.sourceNotes);
}

function countCityRecords(compiled, key) {
  return Object.values(compiled.states).reduce(
    (stateSum, cities) => stateSum + Object.values(cities).reduce((citySum, city) => citySum + city[key].length, 0),
    0
  );
}

function localResults(payload) {
  if (Array.isArray(payload.local_results)) return payload.local_results;
  if (Array.isArray(payload.local_results?.places)) return payload.local_results.places;
  if (Array.isArray(payload.local_results?.results)) return payload.local_results.results;
  return [];
}

function organicResults(payload) {
  return Array.isArray(payload.organic_results) ? payload.organic_results : [];
}

function bestUrl(item) {
  const url = item.links?.website || item.website || item.link || null;
  return isPublicSourceUrl(url) ? url : null;
}

function isPublicSourceUrl(link) {
  const value = host(link);
  return Boolean(value) && value !== "serpapi.com" && !value.endsWith(".serpapi.com");
}

function isGenericRentalSource(record) {
  const title = record.name.toLowerCase();
  const urlHost = host(record.sourceUrl);
  const genericTitle = GENERIC_RENTAL_TITLES.some((needle) => title.includes(needle));
  const marketplace = MARKETPLACE_HOSTS.some((needle) => urlHost.endsWith(needle) || urlHost.includes(`.${needle}`));
  return genericTitle && marketplace;
}

function inferServiceCategory(text) {
  const haystack = text.toLowerCase();
  const categories = [];
  if (haystack.includes("hvac") || haystack.includes("heating") || haystack.includes("air conditioning") || haystack.includes("cooling")) categories.push("HVAC");
  if (haystack.includes("plumb")) categories.push("plumbing");
  if (haystack.includes("electric")) categories.push("electrical");
  if (haystack.includes("pest") || haystack.includes("termite")) categories.push("pest control");
  if (haystack.includes("roof")) categories.push("roofing");
  if (haystack.includes("lawn") || haystack.includes("landscap") || haystack.includes("irrigation")) categories.push("landscaping");
  if (haystack.includes("septic")) categories.push("septic");
  return categories.length ? [...new Set(categories)].join(", ") : "home services";
}

function inferRentalCategory(text) {
  const haystack = text.toLowerCase();
  if (haystack.includes("property management") || haystack.includes("property manager")) return "property manager";
  if (haystack.includes("townhome")) return "townhome community";
  if (haystack.includes("single family") || haystack.includes("house for rent")) return "single-family rental";
  if (haystack.includes("senior")) return "senior apartment community";
  if (haystack.includes("apart")) return "apartment community";
  return "rental community";
}

function inferMarketClass(name) {
  const haystack = name.toLowerCase();
  const chainSignals = ["orkin", "terminix", "massey", "arrow", "mr. electric", "mr rooter", "mister sparky", "one hour", "benjamin franklin", "roto-rooter", "cooks pest", "cook's pest"];
  if (chainSignals.some((signal) => haystack.includes(signal))) return "chain";
  return "local/regional";
}

function inferManager(text) {
  const managers = ["Greystar", "RPM Living", "Asset Living", "Cushman & Wakefield", "FirstKey Homes", "Progress Residential", "Invitation Homes", "Bell Partners", "RangeWater", "Vantage Management", "Trion Living", "Harbor Group Management", "Equity Residential"];
  return managers.find((manager) => text.toLowerCase().includes(manager.toLowerCase())) || null;
}

function looksOfficial(link) {
  const value = host(link);
  return value && !MARKETPLACE_HOSTS.some((needle) => value.endsWith(needle) || value.includes(`.${needle}`));
}

function cleanRentalName(value) {
  return cleanTitle(value)
    .replace(/\s*-\s*(apartments|homes|houses)?\s*for\s*rent.*$/i, "")
    .replace(/\s*-\s*[A-Z][a-z]+,\s*(AL|GA).*$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();
}

function cleanTitle(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+Google Search$/i, "")
    .replace(/Â·/g, "-")
    .trim();
}

function compactEvidence(parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function trimSentence(value) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function containsAny(text, needles) {
  const haystack = text.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
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
    .replace(/utm_[^|&]+=[^|&]+/g, "")
    .replace(/[^a-z0-9|:/.-]/g, "");
}

function host(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
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

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function isUnsupportedLocation(error) {
  return String(error).toLowerCase().includes("unsupported") && String(error).toLowerCase().includes("location");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
