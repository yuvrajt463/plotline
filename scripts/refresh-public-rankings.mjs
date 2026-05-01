import fs from "node:fs/promises";
import path from "node:path";
import growthHandler from "../api/growth.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "apps", "web", "public", "data");
const DISPLAY_LIMIT = Number(process.env.DISPLAY_LIMIT || 35);
const STATES = [
  { state: "01", stateName: "Alabama", abbr: "AL" },
  { state: "13", stateName: "Georgia", abbr: "GA" },
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const state of STATES) {
    const filePath = path.join(OUT_DIR, `${state.abbr.toLowerCase()}-free-research.json`);
    const existing = await readJson(filePath);
    const growth = await callHandler(growthHandler, {
      state: state.state,
      startYear: "2019",
      endYear: "2024",
      minPopulation: "5000",
      limit: String(DISPLAY_LIMIT),
    });

    const cities = mergeCities(existing?.cities || [], growth.cities || []);
    const payload = {
      ...(existing || {}),
      state,
      gatheredAt: new Date().toISOString(),
      cities,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    console.log(`${state.abbr}: wrote ${cities.length} ranked/display cities`);
  }

  await writeStateBoundaries();
  await fs.writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: STATES.map((state) => ({
          state: state.state,
          stateName: state.stateName,
          abbr: state.abbr,
          url: `/data/${state.abbr.toLowerCase()}-free-research.json`,
        })),
      },
      null,
      2,
    ),
  );
}

function mergeCities(existingCities, freshCities) {
  const existingByPlace = new Map(existingCities.map((city) => [city.place, city]));
  const existingByName = new Map(existingCities.map((city) => [city.name.toLowerCase(), city]));
  const specialCities = existingCities.filter((city) => city.specialCity);
  const specialKeys = new Set(specialCities.map((city) => city.place));
  const mergedRanked = freshCities.map((fresh) => ({
    ...fresh,
    ...(existingByPlace.get(fresh.place) || existingByName.get(fresh.name.toLowerCase()) || {}),
    rank: fresh.rank,
    score: fresh.score,
    incomeGrowth: fresh.incomeGrowth,
    employedGrowth: fresh.employedGrowth,
    avgHouseholdIncome: fresh.avgHouseholdIncome,
    population: fresh.population,
    trends: fresh.trends,
    lat: fresh.lat,
    lon: fresh.lon,
  }));

  return [
    ...specialCities,
    ...mergedRanked.filter((city) => !specialKeys.has(city.place)),
  ];
}

async function writeStateBoundaries() {
  const source =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2024/State_County/MapServer/9";
  const states = {};

  for (const state of STATES) {
    const url = new URL(`${source}/query`);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", `GEOID='${state.state}'`);
    url.searchParams.set("outFields", "GEOID,STUSAB");
    url.searchParams.set("returnGeometry", "true");
    url.searchParams.set("outSR", "4326");

    const response = await fetch(url, {
      headers: { "User-Agent": "city-growth-dashboard/0.1" },
    });
    if (!response.ok) throw new Error(`TIGER state boundary ${state.abbr} returned HTTP ${response.status}`);
    const payload = await response.json();
    const feature = payload.features?.[0];
    states[state.state] = {
      abbr: state.abbr,
      name: state.stateName,
      rings: feature?.geometry?.rings || [],
    };
  }

  await fs.writeFile(
    path.join(OUT_DIR, "state-boundaries.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source,
        method: "Census TIGERweb generalized 20m state boundary geometries, projected in the frontend.",
        states,
      },
      null,
      2,
    ),
  );
}

async function callHandler(handler, query) {
  return new Promise((resolve, reject) => {
    const req = { query };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        if (this.statusCode >= 400) reject(new Error(payload.error || `HTTP ${this.statusCode}`));
        else resolve(payload);
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
