import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_PLAN = path.join(ROOT, "data", "api-search-plan.json");
const OUT = path.join(ROOT, "data", "serp-200-call-plan.json");
const SMOKE_TEST_OUT = path.join(ROOT, "data", "serp-2-call-smoke-test-plan.json");

const perCityTemplates = [
  {
    id: "hvac",
    engine: "google_local",
    query: ({ city, state }) => `HVAC heating air conditioning ${city} ${state}`,
    layer: "services",
    categories: ["HVAC"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"]
  },
  {
    id: "plumbing",
    engine: "google_local",
    query: ({ city, state }) => `plumber plumbing company ${city} ${state}`,
    layer: "services",
    categories: ["plumbing"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"]
  },
  {
    id: "electrical",
    engine: "google_local",
    query: ({ city, state }) => `electrician electrical contractor ${city} ${state}`,
    layer: "services",
    categories: ["electrical"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"]
  },
  {
    id: "pest",
    engine: "google_local",
    query: ({ city, state }) => `pest control termite control ${city} ${state}`,
    layer: "services",
    categories: ["pest control"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"]
  },
  {
    id: "roofing-landscaping",
    engine: "google_local",
    query: ({ city, state }) => `roofing landscaping lawn care ${city} ${state}`,
    layer: "services",
    categories: ["roofing", "landscaping"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"]
  },
  {
    id: "apartments",
    engine: "google",
    query: ({ city, state }) => `apartments for rent ${city} ${state} property management`,
    layer: "rentals",
    categories: ["apartment community", "property manager"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.rentals",
    fieldsToHydrate: ["name", "category", "managementCompany", "address", "sourceUrl", "evidence"]
  },
  {
    id: "single-family-rentals",
    engine: "google",
    query: ({ city, state }) => `single family homes for rent ${city} ${state} property management`,
    layer: "rentals",
    categories: ["single-family rental", "property manager"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.rentals",
    fieldsToHydrate: ["name", "category", "managementCompany", "address", "sourceUrl", "evidence"]
  },
  {
    id: "management-company",
    engine: "google",
    query: ({ city, state }) => `apartment community management company ${city} ${state}`,
    layer: "rentals",
    categories: ["apartment community", "management company"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.rentals",
    fieldsToHydrate: ["name", "category", "managementCompany", "address", "sourceUrl", "evidence"]
  },
  {
    id: "digital-footprint",
    engine: "google",
    query: ({ city, state }) => `site:facebook.com OR site:yelp.com OR site:bbb.org service company ${city} ${state} HVAC plumbing electrical pest`,
    layer: "services",
    categories: ["digital footprint", "reviews", "social"],
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "sourceUrl", "evidence", "digitalFootprints"]
  }
];

const stateTemplates = [
  {
    id: "al-growth-crosscheck",
    engine: "google",
    query: "Alabama fastest growing cities household income job growth ACS Census BLS",
    state: "AL",
    layer: "growth",
    insertPath: "apps/web/public/data/al-free-research.json -> rankedCities[*].sources",
    fieldsToHydrate: ["sourceUrl", "evidence", "metricContext"]
  },
  {
    id: "ga-growth-crosscheck",
    engine: "google",
    query: "Georgia fastest growing cities household income job growth ACS Census BLS",
    state: "GA",
    layer: "growth",
    insertPath: "apps/web/public/data/ga-free-research.json -> rankedCities[*].sources",
    fieldsToHydrate: ["sourceUrl", "evidence", "metricContext"]
  },
  {
    id: "al-property-manager-backfill",
    engine: "google",
    query: "Alabama apartment property management companies Daphne Calera Foley Orange Beach rentals",
    state: "AL",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.AL.{city}.rentals",
    fieldsToHydrate: ["managementCompany", "sourceUrl", "evidence"]
  },
  {
    id: "ga-property-manager-backfill",
    engine: "google",
    query: "Georgia apartment property management companies Cumming Mableton Locust Grove Perry rentals",
    state: "GA",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.GA.{city}.rentals",
    fieldsToHydrate: ["managementCompany", "sourceUrl", "evidence"]
  },
  {
    id: "al-build-to-rent-backfill",
    engine: "google",
    query: "Alabama build to rent communities single family rental communities Foley Daphne Calera",
    state: "AL",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.AL.{city}.rentals",
    fieldsToHydrate: ["name", "managementCompany", "address", "sourceUrl", "evidence"]
  },
  {
    id: "ga-build-to-rent-backfill",
    engine: "google",
    query: "Georgia build to rent communities single family rental communities Locust Grove Cumming Mableton",
    state: "GA",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.GA.{city}.rentals",
    fieldsToHydrate: ["name", "managementCompany", "address", "sourceUrl", "evidence"]
  },
  {
    id: "al-lihtc-hud-backfill",
    engine: "google",
    query: "Alabama LIHTC affordable apartment communities Daphne Foley Calera Tallassee HUD",
    state: "AL",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.AL.{city}.rentals",
    fieldsToHydrate: ["name", "category", "managementCompany", "sourceUrl", "evidence"]
  },
  {
    id: "ga-lihtc-hud-backfill",
    engine: "google",
    query: "site:hud.gov OR site:affordablehousingonline.com Georgia LIHTC apartment communities Blakely Fort Valley Swainsboro",
    state: "GA",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.GA.{city}.rentals",
    fieldsToHydrate: ["name", "category", "managementCompany", "sourceUrl", "evidence"]
  },
  {
    id: "al-service-chain-footprint",
    engine: "google",
    query: "Alabama HVAC plumbing electrical pest chain service centers Baldwin Shelby Mobile Huntsville",
    state: "AL",
    layer: "services",
    insertPath: "apps/web/public/data/manual-research.json -> states.AL.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "sourceUrl", "evidence"]
  },
  {
    id: "ga-service-chain-footprint",
    engine: "google",
    query: "Georgia HVAC plumbing electrical pest chain service centers metro Atlanta Middle Georgia",
    state: "GA",
    layer: "services",
    insertPath: "apps/web/public/data/manual-research.json -> states.GA.{city}.services",
    fieldsToHydrate: ["name", "category", "marketClass", "sourceUrl", "evidence"]
  },
  {
    id: "regional-apartment-operators-crosscheck",
    engine: "google",
    query: "Alabama Georgia apartment operators Greystar RPM Living Asset Living Cushman Wakefield Trion Living",
    state: "AL+GA",
    layer: "rentals",
    insertPath: "apps/web/public/data/manual-research.json -> states.{state}.{city}.rentals",
    fieldsToHydrate: ["managementCompany", "sourceUrl", "evidence"]
  }
];

function paramsFor(call) {
  const base = {
    engine: call.engine,
    q: call.query,
    google_domain: "google.com",
    gl: "us",
    hl: "en"
  };

  if (call.engine === "google_local") {
    return {
      ...base,
      location: `${call.city}, ${call.stateName || call.state}, United States`
    };
  }

  return {
    ...base,
    num: 10
  };
}

async function main() {
  const source = JSON.parse(await fs.readFile(SOURCE_PLAN, "utf8"));
  const markets = source.markets.map(({ state, stateName, city, rank, specialCity, lat, lon }) => ({
    state,
    stateName,
    city,
    rank,
    specialCity,
    lat,
    lon
  }));

  const cityCalls = markets.flatMap((market) =>
    perCityTemplates.map((template) => {
      const query = template.query(market);
      const call = {
        id: `${market.state.toLowerCase()}-${slug(market.city)}-${template.id}`,
        status: "draft_only_no_api_call_made",
        state: market.state,
        stateName: market.stateName,
        city: market.city,
        rank: market.rank,
        specialCity: market.specialCity,
        layer: template.layer,
        categories: template.categories,
        engine: template.engine,
        query,
        serpapiParams: paramsFor({ ...market, ...template, query }),
        insertPath: template.insertPath,
        stagingPath: "data/manual-research-updates.json -> states.{state}.{city}.{services|rentals}",
        fieldsToHydrate: template.fieldsToHydrate,
        mergeRule: "Normalize, dedupe by sourceUrl/name/address, keep original sourceUrl and concise evidence, then run scripts/merge-manual-research-updates.mjs."
      };
      return call;
    })
  );

  const stateCalls = stateTemplates.map((template) => ({
    id: template.id,
    status: "draft_only_no_api_call_made",
    state: template.state,
    layer: template.layer,
    categories: template.layer === "growth" ? ["growth cross-check"] : ["management company backfill"],
    engine: template.engine,
    query: template.query,
    serpapiParams: paramsFor(template),
    insertPath: template.insertPath,
    stagingPath: template.layer === "growth" ? "data/public-source-notes.json" : "data/manual-research-updates.json",
    fieldsToHydrate: template.fieldsToHydrate,
    mergeRule: "Use only as backfill/context; do not replace Census ACS/BLS public metrics unless the upstream public source changes."
  }));

  const calls = [...cityCalls, ...stateCalls];
  if (calls.length !== 200) {
    throw new Error(`Expected 200 calls, generated ${calls.length}`);
  }

  const plan = {
    generatedAt: new Date().toISOString(),
    status: "draft_only_no_api_calls_made",
    budget: {
      plannedSerpApiCalls: calls.length,
      freeTierMonthlyReference: 250,
      remainingAfterPlan: 50,
      shape: "21 markets x 9 targeted calls = 189, plus 11 state/backfill calls = 200"
    },
    insertionModel: {
      rawResponseArchive: "data/raw/serpapi/YYYY-MM-DD/{call.id}.json",
      normalizedStaging: "data/manual-research-updates.json",
      dashboardRuntimeDump: "apps/web/public/data/manual-research.json",
      publicRankingDumps: [
        "apps/web/public/data/al-free-research.json",
        "apps/web/public/data/ga-free-research.json"
      ],
      dashboardUsage: "The UI reads manual-research.json. Services/rentals are rendered as clickable cards; sourceUrl is the outbound reference and evidence stays available for hover/detail context."
    },
    extractionRules: [
      "Prefer official company/property pages over directories when both exist.",
      "For service companies, keep name, category, local/regional/chain marketClass, address when available, sourceUrl, and one-sentence evidence.",
      "For rentals, keep property/community name, category, managementCompany when visible, address, sourceUrl, and one-sentence evidence.",
      "If a Serp result is only a directory page, keep it only when it clearly references the city and no official page is found.",
      "Do not expose SerpAPI keys or raw API payloads in the frontend."
    ],
    calls
  };

  const smokeTestCalls = buildSmokeTestCalls();
  const smokeTestPlan = {
    ...plan,
    status: "draft_only_no_api_calls_made_smoke_test",
    budget: {
      plannedSerpApiCalls: smokeTestCalls.length,
      fullPlanReference: calls.length,
      freeTierMonthlyReference: 250,
      remainingAfterSmokeTest: 248,
      shape: "Use only 1-2 calls to validate SerpAPI response shape and extraction quality before spending real quota."
    },
    smokeTestRule: [
      "Run call 1 only if we want the absolute minimum test.",
      "Run call 2 only after call 1 parses cleanly.",
      "Do not run either call until the user explicitly says to execute the SerpAPI smoke test."
    ],
    calls: smokeTestCalls
  };

  await fs.writeFile(OUT, `${JSON.stringify(plan, null, 2)}\n`);
  await fs.writeFile(SMOKE_TEST_OUT, `${JSON.stringify(smokeTestPlan, null, 2)}\n`);
  console.log(`wrote ${calls.length} planned SerpAPI calls to ${path.relative(ROOT, OUT)}`);
  console.log(`wrote ${smokeTestCalls.length} smoke-test SerpAPI calls to ${path.relative(ROOT, SMOKE_TEST_OUT)}`);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildSmokeTestCalls() {
  const calls = [
    {
      id: "smoke-daphne-al-services-omnibus",
      smokeTestOrder: 1,
      status: "draft_only_no_api_call_made",
      state: "AL",
      stateName: "Alabama",
      city: "Daphne",
      layer: "services",
      categories: ["HVAC", "plumbing", "electrical", "pest control", "roofing", "landscaping"],
      engine: "google_local",
      query: "HVAC plumbing electrical pest control roofing landscaping Daphne AL",
      serpapiParams: {
        engine: "google_local",
        q: "HVAC plumbing electrical pest control roofing landscaping Daphne AL",
        google_domain: "google.com",
        gl: "us",
        hl: "en",
        location: "Daphne, Alabama, United States"
      },
      insertPath: "apps/web/public/data/manual-research.json -> states.AL.Daphne.services",
      stagingPath: "data/manual-research-updates.json -> states.AL.Daphne.services",
      fieldsToHydrate: ["name", "category", "marketClass", "address", "sourceUrl", "evidence"],
      testGoal: "Validate Google Local response shape and see how many service companies can be extracted from one broad call."
    },
    {
      id: "smoke-daphne-al-rentals-management-omnibus",
      smokeTestOrder: 2,
      status: "draft_only_no_api_call_made",
      state: "AL",
      stateName: "Alabama",
      city: "Daphne",
      layer: "rentals",
      categories: ["apartment community", "single-family rental", "property manager"],
      engine: "google",
      query: "apartments for rent rental communities property management Daphne AL",
      serpapiParams: {
        engine: "google",
        q: "apartments for rent rental communities property management Daphne AL",
        google_domain: "google.com",
        gl: "us",
        hl: "en",
        num: 10
      },
      insertPath: "apps/web/public/data/manual-research.json -> states.AL.Daphne.rentals",
      stagingPath: "data/manual-research-updates.json -> states.AL.Daphne.rentals",
      fieldsToHydrate: ["name", "category", "managementCompany", "address", "sourceUrl", "evidence"],
      testGoal: "Validate organic result extraction for rental communities and manager names before scaling."
    }
  ];

  if (calls.length !== 2) {
    throw new Error(`Expected 2 smoke-test calls, generated ${calls.length}`);
  }
  return calls;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
