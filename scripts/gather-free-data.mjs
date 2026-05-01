import fs from "node:fs/promises";
import path from "node:path";
import growthHandler from "../api/growth.js";
import osmHandler from "../api/osm.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "apps", "web", "public", "data");
const CACHE_DIR = path.join(ROOT, "data", "google-places-cache");
const SERP_CACHE_DIR = path.join(ROOT, "data", "serpapi-cache");
const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const SERPAPI_SEARCH_URL = "https://serpapi.com/search.json";
const GOOGLE_BASIC_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.types",
].join(",");
const STATES = [
  { state: "01", stateName: "Alabama", abbr: "AL" },
  { state: "13", stateName: "Georgia", abbr: "GA" },
];

const LIMIT = Number(process.env.GATHER_LIMIT || 10);
const RADIUS = Number(process.env.GATHER_RADIUS || 5000);
const CONCURRENCY = Number(process.env.GATHER_CONCURRENCY || 2);
const GOOGLE_MAX_RESULTS = Math.min(Math.max(Number(process.env.GOOGLE_PLACES_MAX_RESULTS || 10), 1), 20);
const SERPAPI_MAX_RESULTS = Math.min(Math.max(Number(process.env.SERPAPI_MAX_RESULTS || 10), 1), 20);
const SERPAPI_TYPES = new Set(String(process.env.SERPAPI_TYPES || "services").split(",").map((type) => type.trim()));

async function main() {
  await loadLocalEnv();
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(SERP_CACHE_DIR, { recursive: true });
  const googleEnabled = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  const serpEnabled = Boolean(process.env.SERPAPI_KEY);

  for (const state of STATES) {
    console.log(`\n[${state.abbr}] gathering top ${LIMIT}`);
    const growth = await callHandler(growthHandler, {
      state: state.state,
      startYear: "2019",
      endYear: "2024",
      minPopulation: "5000",
      limit: String(LIMIT),
    });

    const cities = await mapLimit(growth.cities || [], CONCURRENCY, async (city) => {
      console.log(`[${state.abbr}] ${city.rank}. ${city.name}`);
      const [services, rentals, googleServices, googleRentals, serpServices, serpRentals] = await Promise.all([
        safeDiscovery(city.name, state.stateName, "services"),
        safeDiscovery(city.name, state.stateName, "rentals"),
        safeGooglePlaces(city, state, "services"),
        safeGooglePlaces(city, state, "rentals"),
        SERPAPI_TYPES.has("services") ? safeSerpApi(city, state, "services") : skippedSerpApi("services"),
        SERPAPI_TYPES.has("rentals") ? safeSerpApi(city, state, "rentals") : skippedSerpApi("rentals"),
      ]);

      return {
        ...city,
        stateName: state.stateName,
        stateAbbr: state.abbr,
        freeSources: {
          services,
          rentals,
        },
        paidSources: googleEnabled || serpEnabled
          ? {
              ...(googleEnabled ? { googleServices, googleRentals } : {}),
              ...(serpEnabled && SERPAPI_TYPES.has("services") ? { serpServices } : {}),
              ...(serpEnabled && SERPAPI_TYPES.has("rentals") ? { serpRentals } : {}),
            }
          : undefined,
      };
    });

    const payload = {
      state,
      gatheredAt: new Date().toISOString(),
      radius: RADIUS,
      sourceNotes: {
        growth: "Census ACS 5-Year API. Average household income = B19025_001E / B11001_001E. Employed residents = B23025_004E.",
        centroids: "Census TIGERweb place centroid fields CENTLAT/CENTLON or INTPTLAT/INTPTLON.",
        services: "OpenStreetMap / Overpass free-source search. This is incomplete for contractors and weak-web businesses.",
        rentals: "OpenStreetMap / Overpass free-source search. This is incomplete for market-rate communities, ownership, and managers.",
        googlePlaces:
          "Google Places Text Search (New), pre-gathered offline with a limited field mask and local response cache. Default fields exclude phone and website to limit cost.",
        serpApi:
          "SerpAPI Google Local results, pre-gathered offline with local caching and provider cache enabled. Default is one broad local query per city/category.",
      },
      cities,
    };

    await fs.writeFile(path.join(OUT_DIR, `${state.abbr.toLowerCase()}-free-research.json`), JSON.stringify(payload, null, 2));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    files: STATES.map((state) => ({
      state: state.state,
      stateName: state.stateName,
      abbr: state.abbr,
      url: `/data/${state.abbr.toLowerCase()}-free-research.json`,
    })),
  };
  await fs.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${path.relative(ROOT, OUT_DIR)}`);
}

async function loadLocalEnv() {
  try {
    const envPath = path.join(ROOT, ".env");
    const text = await fs.readFile(envPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] == null) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function safeDiscovery(city, stateName, type) {
  try {
    const payload = await callHandler(osmHandler, {
      city,
      stateName,
      type,
      radius: String(RADIUS),
    });
    return {
      type,
      count: payload.count || 0,
      warning: payload.warning,
      sourceUrl: payload.sourceUrl,
      origin: payload.origin,
      items: payload.items || [],
    };
  } catch (error) {
    return {
      type,
      count: 0,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function safeGooglePlaces(city, state, type) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      type,
      count: 0,
      items: [],
      warning: "GOOGLE_PLACES_API_KEY is not configured for offline enrichment.",
      sourceUrl: "https://developers.google.com/maps/documentation/places/web-service/text-search",
    };
  }

  try {
    const cacheKey = [
      "v1",
      state.abbr.toLowerCase(),
      city.place,
      type,
      RADIUS,
      GOOGLE_MAX_RESULTS,
      hashText(process.env.GOOGLE_PLACES_FIELD_MASK || GOOGLE_BASIC_FIELD_MASK),
    ].join("-");
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    const cached = await readJson(cachePath);
    if (cached) return cached;

    const query = googleQuery(city.name, state.stateName, type);
    const body = {
      textQuery: query,
      maxResultCount: GOOGLE_MAX_RESULTS,
    };

    if (Number.isFinite(city.lat) && Number.isFinite(city.lon)) {
      body.locationBias = {
        circle: {
          center: { latitude: city.lat, longitude: city.lon },
          radius: RADIUS,
        },
      };
    }

    const response = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": process.env.GOOGLE_PLACES_FIELD_MASK || GOOGLE_BASIC_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Places returned HTTP ${response.status}: ${text.slice(0, 240)}`);
    }

    const payload = await response.json();
    const items = (payload.places || []).map((place) => normalizeGooglePlace(place, type));
    const result = {
      type,
      count: items.length,
      items,
      query,
      sourceUrl: "https://developers.google.com/maps/documentation/places/web-service/text-search",
      warning:
        "Google Places results were gathered offline with a limited field mask and cached locally to reduce repeated API use.",
    };

    await fs.writeFile(cachePath, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    return {
      type,
      count: 0,
      items: [],
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: "https://developers.google.com/maps/documentation/places/web-service/text-search",
    };
  }
}

async function safeSerpApi(city, state, type) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      type,
      count: 0,
      items: [],
      warning: "SERPAPI_KEY is not configured for offline enrichment.",
      sourceUrl: "https://serpapi.com/google-local-api",
    };
  }

  try {
    const query = serpQuery(city.name, state.stateName, type);
    const cacheKey = ["v1", state.abbr.toLowerCase(), city.place, type, SERPAPI_MAX_RESULTS, hashText(query)].join("-");
    const cachePath = path.join(SERP_CACHE_DIR, `${cacheKey}.json`);
    const cached = await readJson(cachePath);
    if (cached) return cached;

    const url = new URL(SERPAPI_SEARCH_URL);
    url.searchParams.set("engine", "google_local");
    url.searchParams.set("q", query);
    url.searchParams.set("location", `${city.name}, ${state.stateName}, United States`);
    url.searchParams.set("google_domain", "google.com");
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");
    url.searchParams.set("device", "desktop");
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`SerpAPI returned HTTP ${response.status}`);

    const payload = await response.json();
    if (payload.error) throw new Error(payload.error);

    const items = (payload.local_results || []).slice(0, SERPAPI_MAX_RESULTS).map((item) => normalizeSerpResult(item, type));
    const result = {
      type,
      count: items.length,
      items,
      query,
      sourceUrl: "https://serpapi.com/google-local-api",
      warning:
        "SerpAPI Google Local results were gathered offline and cached locally. SerpAPI provider cache remains enabled to reduce monthly search usage.",
    };

    await fs.writeFile(cachePath, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    return {
      type,
      count: 0,
      items: [],
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: "https://serpapi.com/google-local-api",
    };
  }
}

function skippedSerpApi(type) {
  return {
    type,
    count: 0,
    items: [],
    warning: `SerpAPI ${type} gathering skipped by SERPAPI_TYPES. Default is services only to preserve monthly quota.`,
    sourceUrl: "https://serpapi.com/google-local-api",
  };
}

function googleQuery(city, stateName, type) {
  if (type === "rentals") {
    return `apartment communities townhomes rentals property management in ${city}, ${stateName}`;
  }
  return `HVAC plumbing electrical pest control roofing landscaping companies in ${city}, ${stateName}`;
}

function serpQuery(city, stateName, type) {
  if (type === "rentals") {
    return `apartment communities property management ${city} ${stateName}`;
  }
  return `HVAC plumbing electrical pest control ${city} ${stateName}`;
}

function normalizeGooglePlace(place, type) {
  return {
    id: place.id || place.name || `google-${hashText(JSON.stringify(place))}`,
    name: place.displayName?.text || "Unnamed Google Places result",
    category: Array.isArray(place.types) ? place.types.slice(0, 3).join(", ") : type,
    address: place.formattedAddress || null,
    website: place.websiteUri || null,
    phone: place.nationalPhoneNumber || null,
    operator: null,
    sourceUrl: place.googleMapsUri || null,
    status: place.businessStatus || null,
    lat: place.location?.latitude ?? null,
    lon: place.location?.longitude ?? null,
    tags: {
      source: "Google Places",
      ...(place.googleMapsUri ? { googleMapsUri: place.googleMapsUri } : {}),
      ...(place.formattedAddress ? { formattedAddress: place.formattedAddress } : {}),
    },
  };
}

function normalizeSerpResult(item, type) {
  return {
    id: item.place_id || item.data_cid || `serp-${hashText(JSON.stringify(item))}`,
    name: item.title || "Unnamed SerpAPI local result",
    category: item.type || type,
    address: item.address || null,
    website: item.links?.website || null,
    phone: item.phone || null,
    operator: null,
    sourceUrl: item.place_id_search || null,
    status: item.hours || null,
    lat: item.gps_coordinates?.latitude ?? null,
    lon: item.gps_coordinates?.longitude ?? null,
    rating: item.rating ?? null,
    reviews: item.reviews ?? null,
    tags: {
      source: "SerpAPI Google Local",
      ...(item.rating ? { rating: String(item.rating) } : {}),
      ...(item.reviews ? { reviews: String(item.reviews) } : {}),
    },
  };
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function callHandler(handler, query) {
  return new Promise((resolve, reject) => {
    const req = { query };
    const res = {
      code: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        if (this.code >= 400) reject(new Error(payload.error || `HTTP ${this.code}`));
        else resolve(payload);
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
