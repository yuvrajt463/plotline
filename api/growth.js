const ACS_BASE = "https://api.census.gov/data";
const TIGER_PLACES_BASE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2024/Places_CouSub_ConCity_SubMCD/MapServer";

const STATES = {
  AL: "01",
  Alabama: "01",
  "01": "01",
  TN: "47",
  Tennessee: "47",
  GA: "13",
  Georgia: "13",
  MS: "28",
  Mississippi: "28",
  FL: "12",
  Florida: "12",
};

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchAcs(year, state) {
  const vars = ["NAME", "B19025_001E", "B11001_001E", "B23025_004E", "B01003_001E"].join(",");
  const url = `${ACS_BASE}/${year}/acs/acs5?get=${vars}&for=place:*&in=state:${state}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "plotline-growth-dashboard/0.1" },
  });

  if (!response.ok) {
    throw new Error(`Census ACS ${year} returned HTTP ${response.status}`);
  }

  return response.json();
}

function rowsByPlace(payload) {
  const map = new Map();
  for (const row of payload.slice(1)) {
    map.set(row[6], row);
  }
  return map;
}

async function fetchPlaceCentroids(state, placeCodes) {
  const out = new Map();
  const quoted = placeCodes.map((place) => `'${place}'`).join(",");
  if (!quoted) return out;

  await Promise.all([10, 11].map(async (layer) => {
    const url = new URL(`${TIGER_PLACES_BASE}/${layer}/query`);
    url.searchParams.set("f", "json");
    url.searchParams.set("where", `STATE='${state}' AND PLACE IN (${quoted})`);
    url.searchParams.set("outFields", "PLACE,CENTLAT,CENTLON,INTPTLAT,INTPTLON");
    url.searchParams.set("returnGeometry", "false");

    const response = await fetch(url, {
      headers: { "User-Agent": "city-growth-dashboard/0.1" },
    });
    if (!response.ok) return;

    const payload = await response.json();
    for (const feature of payload.features || []) {
      const attrs = feature.attributes || {};
      const lat = Number(attrs.INTPTLAT || attrs.CENTLAT);
      const lon = Number(attrs.INTPTLON || attrs.CENTLON);
      if (attrs.PLACE && Number.isFinite(lat) && Number.isFinite(lon)) {
        out.set(attrs.PLACE, { lat, lon });
      }
    }
  }));

  return out;
}

function trendFromRows(rowsByYear, place, years) {
  const avgHouseholdIncome = [];
  const employedResidents = [];
  const population = [];

  for (const year of years) {
    const row = rowsByYear.get(year)?.get(place);
    if (!row) continue;

    const aggregateIncome = numeric(row[1]);
    const households = numeric(row[2]);
    const employed = numeric(row[3]);
    const pop = numeric(row[4]);

    avgHouseholdIncome.push({
      year,
      value: aggregateIncome && households ? Math.round(aggregateIncome / households) : null,
    });
    employedResidents.push({ year, value: employed ? Math.round(employed) : null });
    population.push({ year, value: pop ? Math.round(pop) : null });
  }

  const compositeScore = years.map((year) => {
    const incomeBase = avgHouseholdIncome[0]?.value;
    const employedBase = employedResidents[0]?.value;
    const income = avgHouseholdIncome.find((point) => point.year === year)?.value;
    const employed = employedResidents.find((point) => point.year === year)?.value;
    if (!incomeBase || !employedBase || !income || !employed) return { year, value: null };
    return {
      year,
      value: Number((((income - incomeBase) / incomeBase) * 100 + ((employed - employedBase) / employedBase) * 100).toFixed(1)),
    };
  });

  return {
    avgHouseholdIncome: withProjection(avgHouseholdIncome),
    employedResidents: withProjection(employedResidents),
    population: withProjection(population),
    compositeScore: withProjection(compositeScore),
  };
}

function withProjection(points) {
  const clean = points.filter((point) => Number.isFinite(point.value));
  if (clean.length < 2) return { actual: points, projection: null };
  const first = clean[0];
  const last = clean[clean.length - 1];
  const annualSlope = (last.value - first.value) / Math.max(1, last.year - first.year);
  return {
    actual: points,
    projection: {
      year: last.year + 1,
      value: Number((last.value + annualSlope).toFixed(1)),
      method: "Linear projection from first and latest ACS points.",
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const stateParam = String(req.query.state || "01");
  const state = STATES[stateParam] || stateParam;
  const endYear = Number(req.query.endYear || 2024);
  const startYear = Number(req.query.startYear || 2019);
  const minPopulation = Number(req.query.minPopulation || 5000);
  const limit = Number(req.query.limit || 10);

  try {
    const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
    const yearPayloads = await Promise.all(years.map((year) => fetchAcs(year, state)));
    const rowsByYear = new Map(yearPayloads.map((payload, index) => [years[index], rowsByPlace(payload)]));
    const current = rowsByYear.get(endYear);
    const priorByPlace = rowsByYear.get(startYear);
    const cities = [];

    for (const row of yearPayloads[yearPayloads.length - 1].slice(1)) {
      const place = row[6];
      const old = priorByPlace.get(place);
      if (!old) continue;

      const aggregateIncomeNow = numeric(row[1]);
      const householdsNow = numeric(row[2]);
      const employedNow = numeric(row[3]);
      const populationNow = numeric(row[4]);
      const aggregateIncomeOld = numeric(old[1]);
      const householdsOld = numeric(old[2]);
      const employedOld = numeric(old[3]);

      if (
        !aggregateIncomeNow ||
        !householdsNow ||
        !employedNow ||
        !populationNow ||
        !aggregateIncomeOld ||
        !householdsOld ||
        !employedOld ||
        populationNow < minPopulation
      ) {
        continue;
      }

      const avgHouseholdIncome = aggregateIncomeNow / householdsNow;
      const avgHouseholdIncomeOld = aggregateIncomeOld / householdsOld;
      const incomeGrowth = ((avgHouseholdIncome - avgHouseholdIncomeOld) / avgHouseholdIncomeOld) * 100;
      const employedGrowth = ((employedNow - employedOld) / employedOld) * 100;
      const score = incomeGrowth + employedGrowth;

      const fullName = row[0];
      const rawName = fullName.replace(/, .+$/, "");
      cities.push({
        name: rawName.replace(/\s+(city|town|village|CDP)$/i, ""),
        kind: /\bCDP\b/i.test(rawName) ? "CDP" : "City",
        rawName,
        fullName,
        place,
        state,
        population: Math.round(populationNow),
        avgHouseholdIncome: Math.round(avgHouseholdIncome),
        incomeGrowth: Number(incomeGrowth.toFixed(1)),
        employedGrowth: Number(employedGrowth.toFixed(1)),
        score: Number(score.toFixed(1)),
        trends: trendFromRows(rowsByYear, place, years),
        source: {
          dataset: "Census ACS 5-Year Detailed Tables",
          endYear,
          startYear,
          variables: {
            aggregateHouseholdIncome: "B19025_001E",
            households: "B11001_001E",
            employedResidents: "B23025_004E",
            population: "B01003_001E",
          },
          method:
            "Average household income is aggregate household income divided by households. Growth compares ACS vintages.",
        },
      });
    }

    cities.sort((a, b) => b.score - a.score);
    const limited = cities.slice(0, limit);
    const centroids = await fetchPlaceCentroids(
      state,
      limited.map((city) => city.place),
    );

    res.status(200).json({
      state,
      startYear,
      endYear,
      minPopulation,
      sourceUrl: `${ACS_BASE}/${endYear}/acs/acs5.html`,
      cities: limited.map((city, index) => ({ ...city, ...centroids.get(city.place), rank: index + 1 })),
      allCount: cities.length,
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Failed to fetch Census ACS data" });
  }
}
