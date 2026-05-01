import fs from "node:fs/promises";
import path from "node:path";
import growthHandler from "../api/growth.js";
import osmHandler from "../api/osm.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "apps", "web", "public", "data");
const STATES = [
  { state: "01", stateName: "Alabama", abbr: "AL" },
  { state: "13", stateName: "Georgia", abbr: "GA" },
];

const LIMIT = Number(process.env.GATHER_LIMIT || 10);
const RADIUS = Number(process.env.GATHER_RADIUS || 5000);
const CONCURRENCY = Number(process.env.GATHER_CONCURRENCY || 3);

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

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
      const [services, rentals] = await Promise.all([
        safeDiscovery(city.name, state.stateName, "services"),
        safeDiscovery(city.name, state.stateName, "rentals"),
      ]);

      return {
        ...city,
        stateName: state.stateName,
        stateAbbr: state.abbr,
        freeSources: {
          services,
          rentals,
        },
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
