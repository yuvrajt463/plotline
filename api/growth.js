const ACS_BASE = "https://api.census.gov/data";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const stateParam = String(req.query.state || "01");
  const state = STATES[stateParam] || stateParam;
  const endYear = Number(req.query.endYear || 2024);
  const startYear = Number(req.query.startYear || 2019);
  const minPopulation = Number(req.query.minPopulation || 5000);
  const limit = Number(req.query.limit || 10);

  try {
    const [current, prior] = await Promise.all([fetchAcs(endYear, state), fetchAcs(startYear, state)]);
    const priorByPlace = rowsByPlace(prior);
    const cities = [];

    for (const row of current.slice(1)) {
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
    res.status(200).json({
      state,
      startYear,
      endYear,
      minPopulation,
      sourceUrl: `${ACS_BASE}/${endYear}/acs/acs5.html`,
      cities: cities.slice(0, limit).map((city, index) => ({ ...city, rank: index + 1 })),
      allCount: cities.length,
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Failed to fetch Census ACS data" });
  }
}
