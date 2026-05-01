import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "apps", "web", "public", "data");
const OUT_FILE = path.join(ROOT, "data", "api-search-plan.json");
const STATES = [
  { code: "01", abbr: "AL", name: "Alabama", file: "al-free-research.json" },
  { code: "13", abbr: "GA", name: "Georgia", file: "ga-free-research.json" },
];

const GOOGLE_SEARCHES = [
  {
    id: "core-trades",
    label: "Core home services",
    text: (city, state) => `HVAC plumbing electrical pest control companies in ${city}, ${state}`,
  },
  {
    id: "exterior-yard",
    label: "Exterior and yard services",
    text: (city, state) => `roofing landscaping lawn care service companies in ${city}, ${state}`,
  },
  {
    id: "rentals-management",
    label: "For-rent communities and managers",
    text: (city, state) => `apartments property management build to rent communities in ${city}, ${state}`,
  },
];

const SERP_SEARCHES = [
  {
    id: "local-services",
    label: "Digital footprint for service companies",
    q: (city, state) => `HVAC plumbing electrical pest control ${city} ${state}`,
  },
  {
    id: "local-rentals",
    label: "Digital footprint for rentals and managers",
    q: (city, state) => `apartments property management for rent communities ${city} ${state}`,
  },
];

async function main() {
  const markets = [];

  for (const state of STATES) {
    const payload = JSON.parse(await fs.readFile(path.join(DATA_DIR, state.file), "utf8"));
    const special = payload.cities.filter((city) => city.specialCity);
    const topRanked = payload.cities.filter((city) => !city.specialCity).slice(0, 10);
    for (const city of [...special, ...topRanked]) {
      markets.push({
        state: state.abbr,
        stateName: state.name,
        city: city.name,
        rank: city.specialCity ? null : city.rank,
        specialCity: Boolean(city.specialCity),
        lat: city.lat,
        lon: city.lon,
      });
    }
  }

  const googlePlaces = markets.flatMap((market) =>
    GOOGLE_SEARCHES.map((search) => ({
      provider: "google_places_text_search",
      searchId: `${market.state.toLowerCase()}-${slug(market.city)}-${search.id}`,
      state: market.state,
      city: market.city,
      purpose: search.label,
      endpoint: "https://places.googleapis.com/v1/places:searchText",
      method: "POST",
      request: {
        textQuery: search.text(market.city, market.stateName),
        maxResultCount: 10,
        locationBias:
          Number.isFinite(market.lat) && Number.isFinite(market.lon)
            ? {
                circle: {
                  center: { latitude: market.lat, longitude: market.lon },
                  radius: 12000,
                },
              }
            : undefined,
      },
      fieldMask:
        "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus,places.types,places.websiteUri,places.nationalPhoneNumber",
      status: "draft_not_run",
    })),
  );

  const serpApi = markets.flatMap((market) =>
    SERP_SEARCHES.map((search) => ({
      provider: "serpapi_google_local",
      searchId: `${market.state.toLowerCase()}-${slug(market.city)}-${search.id}`,
      state: market.state,
      city: market.city,
      purpose: search.label,
      endpoint: "https://serpapi.com/search.json",
      method: "GET",
      request: {
        engine: "google_local",
        q: search.q(market.city, market.stateName),
        location: `${market.city}, ${market.stateName}, United States`,
        google_domain: "google.com",
        hl: "en",
        gl: "us",
      },
      status: "draft_not_run",
    })),
  );

  const plan = {
    generatedAt: new Date().toISOString(),
    status: "draft_only_no_api_calls_made",
    scope: {
      states: STATES.map((state) => state.abbr),
      markets: markets.length,
      rule: "Pinned special cities plus the current ACS top 10 ranked cities per state.",
    },
    quotaStrategy: {
      googlePlacesTextSearchCalls: googlePlaces.length,
      serpApiGoogleLocalCalls: serpApi.length,
      serpApiFreeTierBudget: "42 planned searches out of 250 monthly searches, leaving 208 for retries, gaps, and later states.",
      firstRunRecommendation:
        "Run Google Places first, merge and dedupe results, then run SerpAPI only for markets or categories with weak coverage.",
    },
    markets,
    googlePlaces,
    serpApi,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(plan, null, 2));
  console.log(`wrote ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`${googlePlaces.length} Google Places drafts, ${serpApi.length} SerpAPI drafts`);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
