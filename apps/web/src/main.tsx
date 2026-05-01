import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ServiceCategory =
  | "HVAC"
  | "Plumbing"
  | "Electrical"
  | "Pest Control"
  | "Roofing"
  | "Landscaping"
  | "Cleaning"
  | "Restoration";

type ServiceCompany = {
  name: string;
  category: ServiceCategory;
  footprint: string[];
  type: "Local" | "Regional" | "Chain";
  confidence: number;
  source: SourceRef;
};

type Community = {
  name: string;
  manager: string;
  owner: string;
  type: "Market-rate" | "Build-to-rent" | "Affordable" | "Mixed";
  units: number;
  digitalSources: string[];
  confidence: number;
  source: SourceRef;
};

type City = {
  rank: number;
  name: string;
  kind: "City" | "CDP";
  population: number;
  avgHouseholdIncome: number;
  incomeGrowth: number;
  employedGrowth: number;
  score: number;
  x: number;
  y: number;
  source: SourceRef;
  services: ServiceCompany[];
  communities: Community[];
};

type SourceRef = {
  name: string;
  label: string;
  url: string;
  method: string;
  status: "Live public" | "API key" | "Licensed" | "Derived mock";
};

type FreeDiscovery = {
  status: "idle" | "loading" | "ready" | "error";
  count: number;
  items: Array<{ id: string; name: string; website?: string | null; phone?: string | null }>;
  message: string;
};

const SOURCES = {
  acs: {
    name: "Census ACS 5-Year",
    label: "ACS",
    url: "https://api.census.gov/data/2024/acs/acs5.html",
    method: "Place-level ACS 2024 vs 2019. Average household income = B19025_001E / B11001_001E; employed residents = B23025_004E.",
    status: "Live public",
  },
  bls: {
    name: "BLS QCEW",
    label: "BLS QCEW",
    url: "https://www.bls.gov/cew/downloadable-data-files.htm",
    method: "County/MSA employment validation using annual average employment by NAICS and area.",
    status: "Live public",
  },
  google: {
    name: "Google Places API",
    label: "Google",
    url: "https://developers.google.com/maps/documentation/places/web-service/text-search",
    method: "Text Search by service category plus city; Place Details for website, phone, rating, business status, and maps URI.",
    status: "API key",
  },
  yelp: {
    name: "Yelp Places API",
    label: "Yelp",
    url: "https://docs.developer.yelp.com/reference/v3_business_search",
    method: "Business Search and Business Details for ratings, review count, category validation, phone, URL, and address.",
    status: "API key",
  },
  search: {
    name: "SERP / website discovery",
    label: "Search",
    url: "https://serpapi.com/",
    method: "Organic search for Facebook pages, weak-web contractors, management pages, and source triangulation.",
    status: "API key",
  },
  osm: {
    name: "OpenStreetMap / Overpass",
    label: "OSM",
    url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
    method: "No-cost supplemental discovery using OSM tags and name matching. Good for public POIs, weak for contractors and management ownership.",
    status: "Live public",
  },
  hud: {
    name: "HUD LIHTC",
    label: "HUD",
    url: "https://www.huduser.gov/portal/datasets/lihtc/property.html",
    method: "Affordable community address, units, low-income units, geocode, placed-in-service year.",
    status: "Live public",
  },
  licensed: {
    name: "Multifamily licensed data",
    label: "Licensed",
    url: "https://www.yardimatrix.com/",
    method: "Market-rate inventory, units, owner, manager, rents, occupancy, construction status.",
    status: "Licensed",
  },
  mock: {
    name: "Synthetic dashboard seed",
    label: "Mock",
    url: "#",
    method: "Temporary representative values used to design the UI contract before live integrations.",
    status: "Derived mock",
  },
} satisfies Record<string, SourceRef>;

const serviceCategories: ServiceCategory[] = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Pest Control",
  "Roofing",
  "Landscaping",
  "Cleaning",
  "Restoration",
];

const cities: City[] = [
  {
    rank: 1,
    name: "Rainsville",
    kind: "City",
    population: 5702,
    avgHouseholdIncome: 81590,
    incomeGrowth: 83.0,
    employedGrowth: 56.0,
    score: 138.9,
    x: 73,
    y: 16,
    source: SOURCES.acs,
    services: [
      service("Sand Mountain Heating & Air", "HVAC", "Local", 82, ["Website", "Google"]),
      service("Fort Payne Plumbing Pros", "Plumbing", "Regional", 68, ["Google", "Yelp"]),
      service("Terminix", "Pest Control", "Chain", 74, ["Website", "Google", "Facebook"]),
      service("North Alabama Electric", "Electrical", "Local", 71, ["Website"]),
      service("Highlands Restoration", "Restoration", "Local", 60, ["Google"]),
    ],
    communities: [
      community("The Ridge at Rainsville", "Independent", "Private owner", "Market-rate", 84, ["Google", "Website"], 58),
      community("DeKalb Garden Apartments", "Regional Housing Partners", "Private owner", "Affordable", 72, ["HUD", "Google"], 72),
    ],
  },
  {
    rank: 2,
    name: "Semmes",
    kind: "City",
    population: 5626,
    avgHouseholdIncome: 96299,
    incomeGrowth: 77.5,
    employedGrowth: 33.8,
    score: 111.3,
    x: 15,
    y: 85,
    source: SOURCES.acs,
    services: [
      service("Hansen Super Techs", "HVAC", "Regional", 87, ["Website", "Google", "Facebook"]),
      service("Mr. Rooter Plumbing", "Plumbing", "Chain", 79, ["Website", "Google"]),
      service("Mister Sparky", "Electrical", "Chain", 83, ["Website", "Yelp"]),
      service("Waynes Pest Control", "Pest Control", "Regional", 80, ["Website", "Google"]),
      service("Coastal Lawn Care", "Landscaping", "Local", 62, ["Facebook"]),
      service("Servpro", "Restoration", "Chain", 77, ["Website", "Google"]),
    ],
    communities: [
      community("Semmes Ridge", "DLH Properties", "Private owner", "Market-rate", 156, ["Apartments.com", "Google"], 65),
      community("Pecan Pointe", "Sealy Management", "Private owner", "Market-rate", 128, ["Website", "Google"], 71),
      community("Magnolia Villas", "Independent", "Private owner", "Build-to-rent", 64, ["Zillow", "Google"], 54),
    ],
  },
  {
    rank: 3,
    name: "Robertsdale",
    kind: "City",
    population: 7194,
    avgHouseholdIncome: 93383,
    incomeGrowth: 81.7,
    employedGrowth: 26.2,
    score: 107.8,
    x: 31,
    y: 88,
    source: SOURCES.acs,
    services: [
      service("Baldwin Heating & Cooling", "HVAC", "Local", 76, ["Website", "Google"]),
      service("Roberts Cooling, Heating, Plumbing & Electrical", "Plumbing", "Regional", 84, ["Website", "Google"]),
      service("Roberts Cooling, Heating, Plumbing & Electrical", "Electrical", "Regional", 84, ["Website", "Google"]),
      service("Arrow Exterminators", "Pest Control", "Chain", 72, ["Website", "Google"]),
      service("Baldwin County Roofing", "Roofing", "Local", 67, ["Google", "Facebook"]),
      service("Gulf Coast Cleaning", "Cleaning", "Local", 58, ["Facebook"]),
    ],
    communities: [
      community("Central Baldwin Apartments", "Broad Management", "Private owner", "Market-rate", 102, ["Google", "Apartments.com"], 64),
      community("Silverhill Cottages", "Independent", "Private owner", "Build-to-rent", 48, ["Zillow"], 50),
    ],
  },
  {
    rank: 4,
    name: "Meridianville",
    kind: "CDP",
    population: 11150,
    avgHouseholdIncome: 122916,
    incomeGrowth: 40.3,
    employedGrowth: 65.9,
    score: 106.2,
    x: 58,
    y: 12,
    source: SOURCES.acs,
    services: [
      service("Conditioned Air Solutions", "HVAC", "Regional", 88, ["Website", "Google", "Yelp"]),
      service("Benjamin Franklin Plumbing", "Plumbing", "Chain", 80, ["Website", "Google"]),
      service("Mister Sparky", "Electrical", "Chain", 81, ["Website", "Google"]),
      service("Cook's Pest Control", "Pest Control", "Regional", 85, ["Website", "Google"]),
      service("Bama Roofing", "Roofing", "Regional", 72, ["Website"]),
      service("North Alabama Lawn", "Landscaping", "Local", 59, ["Facebook"]),
    ],
    communities: [
      community("The Collins", "RAM Partners", "Private owner", "Market-rate", 264, ["Apartments.com", "Website"], 76),
      community("Meridian Commons", "Sealy Management", "Private owner", "Market-rate", 192, ["Google", "Website"], 69),
      community("Trailhead Cottages", "RangeWater", "Institutional owner", "Build-to-rent", 126, ["Website", "Zillow"], 66),
    ],
  },
  {
    rank: 5,
    name: "Margaret",
    kind: "City",
    population: 5877,
    avgHouseholdIncome: 102155,
    incomeGrowth: 36.2,
    employedGrowth: 67.9,
    score: 104.1,
    x: 51,
    y: 35,
    source: SOURCES.acs,
    services: [
      service("Aire Serv", "HVAC", "Chain", 75, ["Website", "Google"]),
      service("Standard Heating, Cooling & Plumbing", "Plumbing", "Regional", 78, ["Website"]),
      service("Mr. Electric", "Electrical", "Chain", 74, ["Website", "Google"]),
      service("Mosquito Joe", "Pest Control", "Chain", 68, ["Website"]),
      service("Trussville Roofing", "Roofing", "Local", 64, ["Facebook", "Google"]),
    ],
    communities: [
      community("St. Clair Landing", "Independent", "Private owner", "Build-to-rent", 80, ["Google"], 48),
      community("Margaret Flats", "Regional Housing Partners", "Private owner", "Mixed", 96, ["HUD", "Google"], 61),
    ],
  },
  {
    rank: 6,
    name: "Orange Beach",
    kind: "City",
    population: 8407,
    avgHouseholdIncome: 131028,
    incomeGrowth: 29.5,
    employedGrowth: 58.0,
    score: 87.5,
    x: 39,
    y: 95,
    source: SOURCES.acs,
    services: [
      service("Gulf Coast HVAC", "HVAC", "Local", 89, ["Website", "Google"]),
      service("Coastal Plumbing", "Plumbing", "Local", 73, ["Website", "Yelp"]),
      service("Mister Sparky", "Electrical", "Chain", 82, ["Website", "Google"]),
      service("Cook's Pest Control", "Pest Control", "Regional", 86, ["Website", "Google"]),
      service("Island Pool & Spa", "Restoration", "Local", 52, ["Google"]),
      service("Gulf Shores Landscaping", "Landscaping", "Local", 66, ["Facebook", "Google"]),
    ],
    communities: [
      community("The Wharf Apartments", "Arlington Properties", "Institutional owner", "Market-rate", 276, ["Apartments.com", "Website"], 79),
      community("Canal Road Cottages", "Independent", "Private owner", "Build-to-rent", 74, ["Zillow", "Google"], 55),
      community("Marina Pointe Residences", "Independent", "Private owner", "Mixed", 112, ["Website"], 57),
    ],
  },
  {
    rank: 7,
    name: "Calera",
    kind: "City",
    population: 17714,
    avgHouseholdIncome: 100196,
    incomeGrowth: 43.7,
    employedGrowth: 41.9,
    score: 85.6,
    x: 45,
    y: 55,
    source: SOURCES.acs,
    services: [
      service("One Hour Heating & Air", "HVAC", "Chain", 79, ["Website", "Google"]),
      service("Champion Plumbing", "Plumbing", "Local", 71, ["Google", "Facebook"]),
      service("OnTime Service", "Electrical", "Regional", 82, ["Website", "Google"]),
      service("Cook's Pest Control", "Pest Control", "Regional", 84, ["Website", "Yelp"]),
      service("Calera Roofing", "Roofing", "Local", 61, ["Facebook"]),
      service("Molly Maid", "Cleaning", "Chain", 65, ["Website"]),
    ],
    communities: [
      community("The Reserve at Calera", "Sealy Management", "Private owner", "Market-rate", 224, ["Apartments.com", "Google"], 75),
      community("Timberline Cottages", "RangeWater", "Institutional owner", "Build-to-rent", 138, ["Website", "Zillow"], 70),
      community("Calera Park Apartments", "Independent", "Private owner", "Affordable", 96, ["HUD", "Google"], 69),
    ],
  },
  {
    rank: 8,
    name: "Foley",
    kind: "City",
    population: 24026,
    avgHouseholdIncome: 79867,
    incomeGrowth: 36.7,
    employedGrowth: 41.2,
    score: 77.9,
    x: 34,
    y: 91,
    source: SOURCES.acs,
    services: [
      service("Gulf Coast HVAC", "HVAC", "Local", 91, ["Website", "Google"]),
      service("Roberts Cooling, Heating, Plumbing & Electrical", "HVAC", "Regional", 88, ["Website", "Google"]),
      service("Roberts Cooling, Heating, Plumbing & Electrical", "Plumbing", "Regional", 88, ["Website", "Google"]),
      service("Roberts Cooling, Heating, Plumbing & Electrical", "Electrical", "Regional", 88, ["Website", "Google"]),
      service("Arrow Exterminators", "Pest Control", "Chain", 76, ["Website", "Yelp"]),
      service("Baldwin County Roofing", "Roofing", "Local", 68, ["Facebook", "Google"]),
      service("Servpro", "Restoration", "Chain", 79, ["Website", "Google"]),
      service("Coastal Cleaning", "Cleaning", "Local", 57, ["Facebook"]),
    ],
    communities: [
      community("Allier Foley", "Arlington Properties", "Institutional owner", "Market-rate", 300, ["Apartments.com", "Website"], 83),
      community("Exchange at Foley", "Hawthorne Residential Partners", "Institutional owner", "Market-rate", 290, ["Apartments.com", "Google"], 81),
      community("The Edison at the Shores", "Sealy Management", "Private owner", "Market-rate", 240, ["Zillow", "Website"], 76),
      community("Cottages at Foley Farms", "RangeWater", "Institutional owner", "Build-to-rent", 184, ["Zillow", "Website"], 71),
      community("Meadowbrook Apartments", "Foley Trio", "Private owner", "Market-rate", 132, ["Website", "Apartments.com"], 70),
    ],
  },
  {
    rank: 9,
    name: "Tallassee",
    kind: "City",
    population: 5134,
    avgHouseholdIncome: 89066,
    incomeGrowth: 57.0,
    employedGrowth: 13.2,
    score: 70.2,
    x: 61,
    y: 61,
    source: SOURCES.acs,
    services: [
      service("AirNow Cooling & Heating", "HVAC", "Regional", 72, ["Website", "Google"]),
      service("River Region Plumbing", "Plumbing", "Local", 66, ["Google"]),
      service("Dixie Electric", "Electrical", "Regional", 73, ["Website", "Google"]),
      service("Terminix", "Pest Control", "Chain", 74, ["Website"]),
      service("Tallassee Lawn", "Landscaping", "Local", 51, ["Facebook"]),
    ],
    communities: [
      community("Tallassee Pointe", "Independent", "Private owner", "Market-rate", 88, ["Google"], 50),
      community("River Mill Apartments", "Regional Housing Partners", "Private owner", "Affordable", 64, ["HUD", "Google"], 67),
    ],
  },
  {
    rank: 10,
    name: "Satsuma",
    kind: "City",
    population: 6822,
    avgHouseholdIncome: 112011,
    incomeGrowth: 35.4,
    employedGrowth: 34.2,
    score: 69.6,
    x: 19,
    y: 80,
    source: SOURCES.acs,
    services: [
      service("Hansen Super Techs", "HVAC", "Regional", 84, ["Website", "Google"]),
      service("Roto-Rooter", "Plumbing", "Chain", 78, ["Website", "Yelp"]),
      service("Mister Sparky", "Electrical", "Chain", 82, ["Website", "Google"]),
      service("Waynes Pest Control", "Pest Control", "Regional", 79, ["Website", "Google"]),
      service("Mobile Bay Roofing", "Roofing", "Local", 63, ["Facebook", "Google"]),
    ],
    communities: [
      community("Satsuma Station", "Independent", "Private owner", "Market-rate", 92, ["Google"], 51),
      community("Bayou Oaks", "Sealy Management", "Private owner", "Mixed", 110, ["HUD", "Website"], 64),
    ],
  },
];

function service(
  name: string,
  category: ServiceCategory,
  type: ServiceCompany["type"],
  confidence: number,
  footprint: string[],
): ServiceCompany {
  return { name, category, type, confidence, footprint, source: SOURCES.mock };
}

function community(
  name: string,
  manager: string,
  owner: string,
  type: Community["type"],
  units: number,
  digitalSources: string[],
  confidence: number,
): Community {
  const hasHud = digitalSources.includes("HUD");
  const source = hasHud ? SOURCES.hud : SOURCES.mock;
  return { name, manager, owner, type, units, digitalSources, confidence, source };
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtNum(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function App() {
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem("plotline-demo-auth") === "true");
  const [liveCities, setLiveCities] = useState<City[] | null>(null);
  const [growthStatus, setGrowthStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [selectedCityName, setSelectedCityName] = useState("Foley");
  const [category, setCategory] = useState<ServiceCategory | "All">("All");
  const [freeServices, setFreeServices] = useState<FreeDiscovery>({
    status: "idle",
    count: 0,
    items: [],
    message: "Not probed yet.",
  });
  const [freeRentals, setFreeRentals] = useState<FreeDiscovery>({
    status: "idle",
    count: 0,
    items: [],
    message: "Not probed yet.",
  });
  const displayCities = liveCities ?? cities;
  const selectedCity = displayCities.find((city) => city.name === selectedCityName) ?? displayCities[0];

  const filteredServices = selectedCity.services.filter((company) => {
    return category === "All" || company.category === category;
  });

  const stateStats = useMemo(() => {
    const totalCommunities = displayCities.reduce((sum, city) => sum + city.communities.length, 0);
    const totalUnits = displayCities.reduce(
      (sum, city) => sum + city.communities.reduce((citySum, item) => citySum + item.units, 0),
      0,
    );
    const totalCompanies = new Set(displayCities.flatMap((city) => city.services.map((item) => item.name))).size;
    const managers = new Set(displayCities.flatMap((city) => city.communities.map((item) => item.manager))).size;
    return { totalCommunities, totalUnits, totalCompanies, managers };
  }, [displayCities]);

  useEffect(() => {
    let cancelled = false;
    async function loadGrowth() {
      try {
        const response = await fetch("/api/growth?state=01&startYear=2019&endYear=2024&minPopulation=5000&limit=10");
        if (!response.ok) throw new Error("Growth API unavailable");
        const payload = await response.json();
        if (cancelled) return;
        const merged = payload.cities.map((city: unknown, index: number) => mergeLiveCity(city, index));
        setLiveCities(merged);
        setGrowthStatus("ready");
        if (!merged.some((city: City) => city.name === selectedCityName)) {
          setSelectedCityName(merged[0]?.name ?? "Foley");
        }
      } catch {
        if (!cancelled) setGrowthStatus("fallback");
      }
    }
    loadGrowth();
    return () => {
      cancelled = true;
    };
  }, []);

  async function probeFree(type: "services" | "rentals") {
    const setter = type === "services" ? setFreeServices : setFreeRentals;
    setter({ status: "loading", count: 0, items: [], message: "Checking OpenStreetMap and Overpass..." });
    try {
      const response = await fetch(`/api/osm?city=${encodeURIComponent(selectedCity.name)}&stateName=Alabama&type=${type}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "OSM probe failed");
      setter({
        status: "ready",
        count: payload.count,
        items: payload.items.slice(0, 8),
        message: payload.warning || "Free source probe complete.",
      });
    } catch (error) {
      setter({
        status: "error",
        count: 0,
        items: [],
        message: error instanceof Error ? error.message : "Free source probe failed.",
      });
    }
  }

  if (!isAuthed) {
    return <LoginScreen onLogin={() => setIsAuthed(true)} />;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Plotline dashboard">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M7 27 C 12 13, 18 28, 25 14 S 34 13, 34 8" />
              <circle cx="34" cy="8" r="3.4" />
            </svg>
          </span>
          <span>
            <strong>Plotline</strong>
            <small>Market service intelligence</small>
          </span>
        </a>
        <div className="toolbar">
          <label>
            State
            <select defaultValue="AL">
              <option value="AL">Alabama</option>
              <option value="TN" disabled>
                Tennessee
              </option>
              <option value="GA" disabled>
                Georgia
              </option>
            </select>
          </label>
          <button className="ghost">Export CSV</button>
          <button>Run Research</button>
          <button
            className="ghost"
            onClick={() => {
              localStorage.removeItem("plotline-demo-auth");
              setIsAuthed(false);
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <div className="panel map-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Growth screen</p>
              <h1>Top Alabama markets by jobs and income momentum</h1>
            </div>
            <div className="score-pill">ACS 2019-2024</div>
          </div>
          <AlabamaMap selected={selectedCity.name} onSelect={setSelectedCityName} cities={displayCities} />
        </div>

        <aside className="panel rank-panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Ranked cities</p>
              <h2>Top 10</h2>
            </div>
            <span className="muted">score</span>
          </div>
          <div className={`live-status ${growthStatus}`}>
            {growthStatus === "ready" ? "Live ACS loaded" : growthStatus === "loading" ? "Loading ACS..." : "Using local fallback"}
          </div>
          <div className="rank-list">
            {displayCities.map((city) => (
              <button
                className={city.name === selectedCity.name ? "rank-row active" : "rank-row"}
                key={city.name}
                onClick={() => setSelectedCityName(city.name)}
              >
                <span className="rank-num">{city.rank}</span>
                <span className="rank-main">
                  <strong>{city.name}</strong>
                  <small>
                    {city.kind} · {fmtNum(city.population)}
                  </small>
                  <SourceBadge source={city.source} />
                </span>
                <span className="rank-score">{city.score.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="stat-strip">
        <Metric
          title="Avg HH income"
          value={fmtMoney(selectedCity.avgHouseholdIncome)}
          note={`${selectedCity.incomeGrowth}% growth`}
          source={selectedCity.source}
        />
        <Metric
          title="Employed growth"
          value={`${selectedCity.employedGrowth}%`}
          note="resident employment proxy"
          source={selectedCity.source}
        />
        <Metric
          title="Service companies"
          value={String(new Set(selectedCity.services.map((s) => s.name)).size)}
          note={`${chainShare(selectedCity.services)}% chain or regional`}
          source={SOURCES.mock}
        />
        <Metric
          title="For-rent communities"
          value={String(selectedCity.communities.length)}
          note={`${fmtNum(selectedCity.communities.reduce((sum, item) => sum + item.units, 0))} tracked units`}
          source={SOURCES.mock}
        />
        <Metric
          title="Statewide sample"
          value={String(stateStats.totalCompanies)}
          note={`${stateStats.totalCommunities} communities`}
          source={SOURCES.mock}
        />
      </section>

      <section className="detail-grid">
        <div className="panel services-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{selectedCity.name}</p>
              <h2>Service company coverage</h2>
            </div>
            <div className="tabs">
              <button onClick={() => probeFree("services")}>Probe OSM</button>
              <button className={category === "All" ? "active" : ""} onClick={() => setCategory("All")}>
                All
              </button>
              {serviceCategories.slice(0, 4).map((item) => (
                <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <ServiceMix services={selectedCity.services} />
          <FreeProbeResult discovery={freeServices} source={SOURCES.osm} />
          <div className="company-list">
            {filteredServices.map((company) => (
              <article className="company-card" key={`${company.name}-${company.category}`}>
                <div>
                  <span className={`type-dot ${company.type.toLowerCase()}`} />
                  <strong>{company.name}</strong>
                  <small>{company.category} · {company.type}</small>
                </div>
                <div className="source-wrap">
                  {company.footprint.map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                  <SourceBadge source={company.source} />
                </div>
                <Confidence value={company.confidence} />
              </article>
            ))}
          </div>
        </div>

        <div className="panel housing-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">For-rent housing</p>
              <h2>Communities and managers</h2>
            </div>
            <span className="score-pill">{stateStats.managers} managers in sample</span>
          </div>
          <div className="probe-actions">
            <button onClick={() => probeFree("rentals")}>Probe Free OSM Rentals</button>
          </div>
          <FreeProbeResult discovery={freeRentals} source={SOURCES.osm} />
          <div className="community-table">
            {selectedCity.communities.map((item) => (
              <article className="community-row" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.type} · {fmtNum(item.units)} units</small>
                </div>
                <div>
                  <span className="label">Manager</span>
                  <strong>{item.manager}</strong>
                  <small>{item.owner}</small>
                </div>
                <div className="source-wrap">
                  {item.digitalSources.map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                  <SourceBadge source={item.source} />
                </div>
                <Confidence value={item.confidence} />
              </article>
            ))}
          </div>
        </div>

        <div className="panel source-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Data acquisition</p>
              <h2>Source stack</h2>
            </div>
          </div>
          <SourceStack />
        </div>
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [combinedUser, combinedPassword] = String(import.meta.env.VITE_DEMO_CREDENTIALS || "").split(":");
  const expectedUser = String(import.meta.env.VITE_DEMO_USER || combinedUser || "");
  const expectedPassword = String(import.meta.env.VITE_DEMO_PASSWORD || combinedPassword || "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user === expectedUser && password === expectedPassword) {
      localStorage.setItem("plotline-demo-auth", "true");
      onLogin();
      return;
    }
    setError("Invalid demo credentials.");
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M7 27 C 12 13, 18 28, 25 14 S 34 13, 34 8" />
              <circle cx="34" cy="8" r="3.4" />
            </svg>
          </span>
          <span>
            <strong>Plotline</strong>
            <small>Market service intelligence</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">Demo access</p>
          <h1>Sign in</h1>
        </div>
        <label>
          User
          <input value={user} onChange={(event) => setUser(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Login</button>
      </form>
    </main>
  );
}

function AlabamaMap({ selected, onSelect, cities }: { selected: string; onSelect: (city: string) => void; cities: City[] }) {
  return (
    <div className="map-wrap">
      <svg className="state-map" viewBox="0 0 100 100" role="img" aria-label="Alabama top cities map">
        <path className="state-shape" d="M41 5 L71 5 L78 30 L73 61 L83 85 L63 96 L25 93 L17 75 L23 42 L30 24 Z" />
        <path className="river-line" d="M68 12 C60 27, 70 38, 58 51 C48 61, 54 72, 39 88" />
        {cities.map((city) => {
          const active = city.name === selected;
          const radius = active ? 5.7 : Math.max(3.2, 7 - city.rank * 0.25);
          return (
            <g key={city.name}>
              <button type="button" className="map-button" onClick={() => onSelect(city.name)} aria-label={`Select ${city.name}`}>
                <circle className={active ? "city-dot active" : "city-dot"} cx={city.x} cy={city.y} r={radius} />
                <text x={city.x + 5.5} y={city.y + 1.7}>
                  {city.rank}
                </text>
              </button>
            </g>
          );
        })}
      </svg>
      <div className="map-caption">
        <strong>{selected}</strong>
        <span>City-level ACS growth screen, then service and rental discovery by market radius.</span>
        <SourceBadge source={SOURCES.acs} />
      </div>
    </div>
  );
}

function Metric({ title, value, note, source }: { title: string; value: string; note: string; source: SourceRef }) {
  return (
    <article className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
      <SourceBadge source={source} />
    </article>
  );
}

function ServiceMix({ services }: { services: ServiceCompany[] }) {
  const counts = serviceCategories
    .map((item) => ({ item, count: services.filter((serviceItem) => serviceItem.category === item).length }))
    .filter((item) => item.count > 0);
  const max = Math.max(...counts.map((item) => item.count), 1);
  return (
    <div className="mix-chart">
      {counts.map(({ item, count }) => (
        <div className="mix-row" key={item}>
          <span>{item}</span>
          <div>
            <i style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <strong title={SOURCES.mock.method}>{count}</strong>
        </div>
      ))}
    </div>
  );
}

function SourceStack() {
  const sources = [SOURCES.acs, SOURCES.bls, SOURCES.osm, SOURCES.google, SOURCES.yelp, SOURCES.search, SOURCES.hud, SOURCES.licensed];

  return (
    <div className="source-list">
      {sources.map((source) => (
        <article key={source.name}>
          <strong>{source.name}</strong>
          <span>{source.method}</span>
          <small>{source.status}</small>
          <a href={source.url} target="_blank" rel="noreferrer">
            Source documentation
          </a>
        </article>
      ))}
    </div>
  );
}

function FreeProbeResult({ discovery, source }: { discovery: FreeDiscovery; source: SourceRef }) {
  return (
    <div className={`free-probe ${discovery.status}`}>
      <div>
        <strong>
          {discovery.status === "ready"
            ? `${discovery.count} free-source matches`
            : discovery.status === "loading"
              ? "Free-source probe running"
              : discovery.status === "error"
                ? "Free-source probe failed"
                : "Free-source probe"}
        </strong>
        <span>{discovery.message}</span>
      </div>
      <SourceBadge source={source} />
      {discovery.items.length > 0 && (
        <ul>
          {discovery.items.map((item) => (
            <li key={item.id}>
              {item.name}
              {item.website ? " · website" : ""}
              {item.phone ? " · phone" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: SourceRef }) {
  if (source.url === "#") {
    return (
      <span className={`source-badge ${source.status.toLowerCase().replaceAll(" ", "-")}`} title={source.method}>
        {source.label}
      </span>
    );
  }

  return (
    <a
      className={`source-badge ${source.status.toLowerCase().replaceAll(" ", "-")}`}
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={source.method}
      onClick={(event) => event.stopPropagation()}
    >
      {source.label}
    </a>
  );
}

function Confidence({ value }: { value: number }) {
  return (
    <div className="confidence" aria-label={`Confidence ${value} percent`}>
      <span>{value}%</span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function chainShare(services: ServiceCompany[]) {
  if (services.length === 0) return 0;
  const matched = services.filter((item) => item.type !== "Local").length;
  return Math.round((matched / services.length) * 100);
}

function mergeLiveCity(rawCity: unknown, index: number): City {
  const city = rawCity as Partial<City> & { kind?: string };
  const name = String(city.name || `City ${index + 1}`);
  const match = cities.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const fallbackX = 18 + ((index * 17) % 58);
  const fallbackY = 12 + ((index * 23) % 78);

  return {
    ...(match ?? {
      services: [],
      communities: [],
      x: fallbackX,
      y: fallbackY,
    }),
    rank: Number(city.rank || index + 1),
    name,
    kind: city.kind === "CDP" ? "CDP" : "City",
    population: Number(city.population || 0),
    avgHouseholdIncome: Number(city.avgHouseholdIncome || 0),
    incomeGrowth: Number(city.incomeGrowth || 0),
    employedGrowth: Number(city.employedGrowth || 0),
    score: Number(city.score || 0),
    source: SOURCES.acs,
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
