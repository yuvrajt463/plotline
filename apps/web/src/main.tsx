import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type StateCode = "01" | "13";
type DiscoveryType = "services" | "rentals";

type SourceRef = {
  label: string;
  name: string;
  url: string;
  method: string;
  coverage: string;
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
  place: string;
  lat?: number;
  lon?: number;
  trends?: CityTrends;
  freeSources?: {
    services?: DiscoveryDump;
    rentals?: DiscoveryDump;
  };
  paidSources?: {
    googleServices?: DiscoveryDump;
    googleRentals?: DiscoveryDump;
    serpServices?: DiscoveryDump;
    serpRentals?: DiscoveryDump;
  };
  source?: unknown;
};

type TrendPoint = { year: number; value: number | null };
type TrendSeries = {
  actual: TrendPoint[];
  projection: { year: number; value: number; method: string } | null;
};
type CityTrends = {
  avgHouseholdIncome?: TrendSeries;
  employedResidents?: TrendSeries;
  population?: TrendSeries;
  compositeScore?: TrendSeries;
};

type DiscoveryItem = {
  id: string;
  name: string;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  operator?: string | null;
  address?: string | null;
  sourceUrl?: string | null;
  status?: string | null;
  rating?: number | null;
  reviews?: number | null;
  marketClass?: "local" | "regional" | "chain" | "unknown";
  managementCompany?: string | null;
  lat?: number | null;
  lon?: number | null;
  tags?: Record<string, string>;
};

type DiscoveryResult = {
  status: "idle" | "loading" | "ready" | "error";
  count: number;
  items: DiscoveryItem[];
  message: string;
  sourceUrl?: string;
};

type DiscoveryDump = {
  type: DiscoveryType;
  count: number;
  items: DiscoveryItem[];
  warning?: string;
  error?: string;
  sourceUrl?: string;
};

type ManualRecord = DiscoveryItem & {
  category: string;
  evidence?: string;
  evidenceNote?: string;
};

type ManualResearchDump = {
  generatedAt: string;
  method: string;
  states: Record<string, Record<string, { services?: ManualRecord[]; rentals?: ManualRecord[] }>>;
};

type ResearchDump = {
  state: { state: StateCode; stateName: string; abbr: string };
  gatheredAt: string;
  radius: number;
  sourceNotes: Record<string, string>;
  cities: City[];
};

const STATES: Record<StateCode, { code: StateCode; name: string; abbr: string }> = {
  "01": { code: "01", name: "Alabama", abbr: "AL" },
  "13": { code: "13", name: "Georgia", abbr: "GA" },
};

const STATE_BOUNDS: Record<StateCode, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  "01": { minLat: 30.1, maxLat: 35.1, minLon: -88.6, maxLon: -84.7 },
  "13": { minLat: 30.3, maxLat: 35.1, minLon: -85.7, maxLon: -80.6 },
};

const STATE_OUTLINES: Record<StateCode, string> = {
  "01": "M38 4 L72 4 L78 27 L73 58 L84 85 L64 96 L25 93 L16 73 L23 42 L30 22 Z",
  "13": "M38 4 L75 10 L87 44 L77 84 L58 96 L25 89 L14 58 L25 28 Z",
};

const SOURCES: SourceRef[] = [
  {
    label: "ACS",
    name: "Census ACS 5-Year Detailed Tables",
    url: "https://api.census.gov/data/2024/acs/acs5.html",
    method:
      "Ranks places by average household income growth and employed-resident growth between ACS 2019 and ACS 2024.",
    coverage: "Pre-gathered for Alabama and Georgia places with population above the selected threshold.",
  },
  {
    label: "OSM",
    name: "OpenStreetMap via Overpass",
    url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
    method:
      "Pre-gathered search of mapped businesses and apartment/rental-like places around the selected city using tags and name patterns.",
    coverage:
      "Pre-gathered but incomplete. OSM is free and useful for public POIs, but it undercounts contractors, apartment managers, ownership, and weak-web businesses.",
  },
  {
    label: "Public Web",
    name: "Manual Public Web Research",
    url: "/data/manual-research.json",
    method:
      "Human-readable public web research dump using official service-area pages, apartment/community pages, and public directories. No paid API keys are used.",
    coverage:
      "Seed coverage for Alabama and Georgia top-10 cities. Every service/community record carries its own source URL and evidence note.",
  },
  {
    label: "Google",
    name: "Google Places Text Search",
    url: "https://developers.google.com/maps/documentation/places/web-service/text-search",
    method:
      "Pre-gathered offline for the top 10 city list only, with a limited field mask and local response cache to reduce API use.",
    coverage:
      "Better service-company and rental-community discovery than OSM, but still a discovery layer. The API key is used only during local data gathering and is not shipped to the frontend.",
  },
  {
    label: "SerpAPI",
    name: "SerpAPI Google Local API",
    url: "https://serpapi.com/google-local-api",
    method:
      "Pre-gathered offline using one broad Google Local query per top city/category, with both local cache and SerpAPI provider cache enabled.",
    coverage:
      "Good for visible digital footprint, ratings, reviews, and local-result presence. Free tier should be treated as a scarce monthly budget.",
  },
  {
    label: "Nominatim",
    name: "OpenStreetMap Nominatim",
    url: "https://nominatim.org/release-docs/latest/api/Search/",
    method: "Geocodes the selected city before Overpass radius searches.",
    coverage: "Used only by the offline OSM gather script for city centers; rate-limited and intended for light use.",
  },
  {
    label: "HUD LIHTC",
    name: "HUD Low-Income Housing Tax Credit database",
    url: "https://www.huduser.gov/portal/datasets/lihtc/property.html",
    method:
      "Public affordable-housing property database with address, units, low-income units, geocoding, and placed-in-service year.",
    coverage:
      "Free and authoritative for LIHTC affordable communities. It does not cover all market-rate apartment communities or property managers.",
  },
  {
    label: "BLS QCEW",
    name: "BLS Quarterly Census of Employment and Wages",
    url: "https://www.bls.gov/cew/downloadable-data-files.htm",
    method:
      "Free establishment-employment data by county/metro/state. Best used as a validation layer because city-level jobs are not cleanly available.",
    coverage:
      "Not shown as a city KPI yet; ACS employed residents remain the live city-level proxy in this free version.",
  },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function num(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function emptyDiscovery(message = "No dumped data loaded for this city."): DiscoveryResult {
  return { status: "idle", count: 0, items: [], message };
}

function discoveryFromDump(dump?: DiscoveryDump): DiscoveryResult {
  if (!dump) return emptyDiscovery();
  if (dump.error) return { status: "error", count: 0, items: [], message: dump.error, sourceUrl: dump.sourceUrl };
  return {
    status: "ready",
    count: dump.count || dump.items?.length || 0,
    items: dump.items || [],
    message: dump.warning || "Loaded from pre-gathered free-source dataset.",
    sourceUrl: dump.sourceUrl,
  };
}

function discoveryFromManual(records: ManualRecord[] | undefined, type: DiscoveryType): DiscoveryResult {
  if (!records) return emptyDiscovery("No manual public-web records loaded for this city.");
  return {
    status: "ready",
    count: records.length,
    items: records.map((record, index) => ({
      ...record,
      id: record.id || `manual-${type}-${index}-${record.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      tags: {
        ...(record.tags || {}),
        evidence: record.evidence || record.evidenceNote || "",
        source: "Manual public web",
      },
    })),
    message: "Loaded from manual public-web research dump. Each item links to the page used as evidence.",
  };
}

function App() {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("city-dashboard-auth") === "true" || localStorage.getItem("plotline-demo-auth") === "true",
  );
  const [stateCode, setStateCode] = useState<StateCode>("01");
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [cityFilter, setCityFilter] = useState("");
  const [radius, setRadius] = useState(10000);
  const [dumpMeta, setDumpMeta] = useState<ResearchDump | null>(null);
  const [manualDump, setManualDump] = useState<ManualResearchDump | null>(null);
  const [growthStatus, setGrowthStatus] = useState<"loading" | "ready" | "error">("loading");
  const [growthError, setGrowthError] = useState("");
  const [services, setServices] = useState<DiscoveryResult>(emptyDiscovery());
  const [rentals, setRentals] = useState<DiscoveryResult>(emptyDiscovery());
  const [googleServices, setGoogleServices] = useState<DiscoveryResult>(emptyDiscovery());
  const [googleRentals, setGoogleRentals] = useState<DiscoveryResult>(emptyDiscovery());
  const [serpServices, setSerpServices] = useState<DiscoveryResult>(emptyDiscovery());
  const [serpRentals, setSerpRentals] = useState<DiscoveryResult>(emptyDiscovery());
  const [manualServices, setManualServices] = useState<DiscoveryResult>(emptyDiscovery());
  const [manualRentals, setManualRentals] = useState<DiscoveryResult>(emptyDiscovery());

  const state = STATES[stateCode];
  const activeCity = cities.find((city) => city.name === selectedCity) ?? cities[0];
  const summary = useMemo(
    () =>
      activeCity
        ? summarizeMarket(activeCity, {
            services,
            rentals,
            manualServices,
            manualRentals,
            googleServices,
            googleRentals,
            serpServices,
            serpRentals,
          })
        : null,
    [activeCity, services, rentals, manualServices, manualRentals, googleServices, googleRentals, serpServices, serpRentals],
  );
  const filteredCities = useMemo(() => {
    const q = cityFilter.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((city) => city.name.toLowerCase().includes(q));
  }, [cities, cityFilter]);

  useEffect(() => {
    let cancelled = false;
    async function loadGrowth() {
      setGrowthStatus("loading");
      setGrowthError("");
      setServices(emptyDiscovery());
      setRentals(emptyDiscovery());
      setGoogleServices(emptyDiscovery());
      setGoogleRentals(emptyDiscovery());
      setSerpServices(emptyDiscovery());
      setSerpRentals(emptyDiscovery());
      setManualServices(emptyDiscovery());
      setManualRentals(emptyDiscovery());
      try {
        const [response, manualResponse] = await Promise.all([
          fetch(`/data/${state.abbr.toLowerCase()}-free-research.json`),
          fetch("/data/manual-research.json"),
        ]);
        const payload = await response.json();
        const manualPayload = await manualResponse.json();
        if (!response.ok) throw new Error(payload.error || "Could not load dumped research data.");
        if (cancelled) return;
        setCities(payload.cities);
        setDumpMeta(payload);
        setManualDump(manualResponse.ok ? manualPayload : null);
        setRadius(payload.radius || 10000);
        setSelectedCity(payload.cities[0]?.name ?? "");
        setGrowthStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setCities([]);
        setSelectedCity("");
        setGrowthStatus("error");
        setDumpMeta(null);
        setGrowthError(error instanceof Error ? error.message : "Could not load dumped research data.");
      }
    }
    loadGrowth();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  useEffect(() => {
    if (!activeCity) return;
    setServices(discoveryFromDump(activeCity.freeSources?.services));
    setRentals(discoveryFromDump(activeCity.freeSources?.rentals));
    setGoogleServices(discoveryFromDump(activeCity.paidSources?.googleServices));
    setGoogleRentals(discoveryFromDump(activeCity.paidSources?.googleRentals));
    setSerpServices(discoveryFromDump(activeCity.paidSources?.serpServices));
    setSerpRentals(discoveryFromDump(activeCity.paidSources?.serpRentals));
    const manualCity = manualDump?.states?.[state.abbr]?.[activeCity.name];
    setManualServices(discoveryFromManual(manualCity?.services, "services"));
    setManualRentals(discoveryFromManual(manualCity?.rentals, "rentals"));
  }, [activeCity?.place, manualDump, state.abbr]);

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="City Growth Dashboard">
          <span>
            <strong>City Growth Dashboard</strong>
            <small>Pre-gathered free-source research for Alabama and Georgia</small>
          </span>
        </a>
        <div className="toolbar">
          <label>
            State
            <select value={stateCode} onChange={(event) => setStateCode(event.target.value as StateCode)}>
              <option value="01">Alabama</option>
              <option value="13">Georgia</option>
            </select>
          </label>
          <label>
            Radius
            <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={15000}>15 km</option>
            </select>
          </label>
          <button
            className="ghost"
            onClick={() => {
              localStorage.removeItem("city-dashboard-auth");
              localStorage.removeItem("plotline-demo-auth");
              setAuthed(false);
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
              <p className="eyebrow">Live growth screen</p>
              <h1>{state.name} city markets ranked by income and employment momentum</h1>
            </div>
            <SourceBadge label="ACS" />
          </div>
          <StateRankMap stateCode={stateCode} cities={cities.slice(0, 10)} selected={activeCity?.name} onSelect={setSelectedCity} />
        </div>

        <aside className="panel rank-panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Searchable city list</p>
              <h2>Top places</h2>
            </div>
            <span className={`live-status ${growthStatus}`}>
              {growthStatus === "ready" ? "Static dump" : growthStatus === "loading" ? "Loading" : "Error"}
            </span>
          </div>
          <div className="source-note compact-note">Top 10 are visible at a glance; scroll for the rest.</div>
          <input
            className="search-input"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder={`Search ${state.abbr} cities`}
          />
          {growthError && <div className="login-error">{growthError}</div>}
          <div className="rank-list">
            {filteredCities.map((city) => (
              <button
                className={city.name === activeCity?.name ? "rank-row active" : "rank-row"}
                key={city.place}
                onClick={() => {
                  setSelectedCity(city.name);
                  setServices(emptyDiscovery());
                  setRentals(emptyDiscovery());
                  setGoogleServices(emptyDiscovery());
                  setGoogleRentals(emptyDiscovery());
                  setSerpServices(emptyDiscovery());
                  setSerpRentals(emptyDiscovery());
                  setManualServices(emptyDiscovery());
                  setManualRentals(emptyDiscovery());
                }}
              >
                <span className="rank-num">{city.rank}</span>
                <span className="rank-main">
                  <strong>{city.name}</strong>
                  <small>
                    {city.kind} · pop {num(city.population)}
                  </small>
                  <SourceBadge label="ACS" />
                </span>
                <span className="rank-score">{city.score.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {activeCity && (
        <>
          <section className="stat-strip">
            <Metric title="Avg household income" value={money(activeCity.avgHouseholdIncome)} note="ACS aggregate income / households" source="ACS" trend={activeCity.trends?.avgHouseholdIncome} />
            <Metric title="Income growth" value={pct(activeCity.incomeGrowth)} note="ACS 2019 to ACS 2024" source="ACS" trend={growthTrend(activeCity.trends?.avgHouseholdIncome)} />
            <Metric title="Employed-resident growth" value={pct(activeCity.employedGrowth)} note="City-level jobs proxy" source="ACS" trend={activeCity.trends?.employedResidents} />
            <Metric title="Composite score" value={activeCity.score.toFixed(1)} note="income growth + employed growth" source="ACS" trend={activeCity.trends?.compositeScore} />
            <Metric title="Free-source radius" value={`${Math.round(radius / 1000)} km`} note="OSM search radius" source="OSM" trend={radiusTrend(radius)} />
          </section>

          {summary && <AnswerStrip city={activeCity} summary={summary} />}

          <section className="detail-grid">
            <div className="panel services-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{activeCity.name}</p>
                  <h2>Local service companies</h2>
                </div>
                <div className="source-wrap">
                  <SourceBadge label="Google" />
                  <SourceBadge label="SerpAPI" />
                  <SourceBadge label="Public Web" />
                  <SourceBadge label="OSM" />
                </div>
              </div>
              <DiscoveryPanel result={manualServices} emptyLabel="No manual public-web service matches in the dump yet." source="Public Web" sourceKind="free-source" />
              <DiscoveryPanel result={serpServices} emptyLabel="No SerpAPI service matches in the dump." source="SerpAPI" sourceKind="paid-source" />
              <DiscoveryPanel result={googleServices} emptyLabel="No Google Places service matches in the dump." source="Google" sourceKind="paid-source" />
              <DiscoveryPanel result={services} emptyLabel="No free OSM service matches in the dump." source="OSM" sourceKind="free-source" />
            </div>

            <div className="panel housing-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">For-rent housing</p>
                  <h2>Rental/community matches</h2>
                </div>
                <div className="source-wrap">
                  <SourceBadge label="Google" />
                  <SourceBadge label="SerpAPI" />
                  <SourceBadge label="Public Web" />
                  <SourceBadge label="OSM" />
                </div>
              </div>
              <DiscoveryPanel result={manualRentals} emptyLabel="No manual public-web rental/community matches in the dump yet." source="Public Web" sourceKind="free-source" />
              <DiscoveryPanel result={serpRentals} emptyLabel="No SerpAPI rental/community matches in the dump." source="SerpAPI" sourceKind="paid-source" />
              <DiscoveryPanel result={googleRentals} emptyLabel="No Google Places rental/community matches in the dump." source="Google" sourceKind="paid-source" />
              <DiscoveryPanel result={rentals} emptyLabel="No free OSM rental/community matches in the dump." source="OSM" sourceKind="free-source" />
              <div className="source-note">
                <strong>Management companies:</strong> OSM records may include an <code>operator</code> tag and Google results may point to a Maps listing, but full ownership and management coverage usually requires community websites or licensed multifamily data.
              </div>
              {summary.managerSignals.length > 0 && (
                <div className="manager-list">
                  {summary.managerSignals.map((item) => (
                    <span key={`${item.source}-${item.name}`}>{item.name} <SourceBadge label={item.source} /></span>
                  ))}
                </div>
              )}
            </div>

            <div className="panel source-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Data sources</p>
                  <h2>What is in the dump</h2>
                </div>
              </div>
              {dumpMeta && (
                <div className="source-note compact-note">
                  Dataset gathered {new Date(dumpMeta.gatheredAt).toLocaleString()} at {Math.round(dumpMeta.radius / 1000)} km radius.
                </div>
              )}
              <SourceStack />
            </div>
          </section>
        </>
      )}
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
      localStorage.setItem("city-dashboard-auth", "true");
      onLogin();
      return;
    }
    setError("Invalid demo credentials.");
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand login-brand">
          <span>
            <strong>City Growth Dashboard</strong>
            <small>Pre-gathered free-source research for Alabama and Georgia</small>
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
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Login</button>
      </form>
    </main>
  );
}

function StateRankMap({ stateCode, cities, selected, onSelect }: { stateCode: StateCode; cities: City[]; selected?: string; onSelect: (city: string) => void }) {
  const bounds = STATE_BOUNDS[stateCode];
  const project = (city: City) => {
    const x = city.lon == null ? 50 : ((city.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100;
    const y = city.lat == null ? 50 : 100 - ((city.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="state-rank-map">
      <svg viewBox="0 0 100 100" role="img" aria-label="State map with top ranked cities">
        <path className="state-shape" d={STATE_OUTLINES[stateCode]} />
        {cities.map((city) => {
          const { x, y } = project(city);
          const active = city.name === selected;
          return (
            <g key={city.place} className="rank-dot-group" onClick={() => onSelect(city.name)}>
              <circle className={`rank-dot rank-${city.rank} ${active ? "active" : ""}`} cx={x} cy={y} r={active ? 5.8 : 4.6} />
              <text x={x} y={y + 1.6}>
                {city.rank}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <strong>{selected}</strong>
        <span>Top 10 cities are shaded from dark green at rank 1 to light green at rank 10.</span>
      </div>
    </div>
  );
}

function GrowthMap({ cities, selected, onSelect }: { cities: City[]; selected?: string; onSelect: (city: string) => void }) {
  return (
    <div className="live-map-grid">
      {cities.map((city) => (
        <button className={city.name === selected ? "market-tile active" : "market-tile"} key={city.place} onClick={() => onSelect(city.name)}>
          <span>{city.rank}</span>
          <strong>{city.name}</strong>
          <small>{pct(city.incomeGrowth)} income · {pct(city.employedGrowth)} employed</small>
        </button>
      ))}
    </div>
  );
}

function Metric({ title, value, note, source, trend }: { title: string; value: string; note: string; source: string; trend?: TrendSeries }) {
  return (
    <article className="metric">
      {trend && <Sparkline trend={trend} />}
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
      <SourceBadge label={source} />
    </article>
  );
}

function Sparkline({ trend }: { trend: TrendSeries }) {
  const points = [...trend.actual, ...(trend.projection ? [{ year: trend.projection.year, value: trend.projection.value }] : [])]
    .filter((point): point is { year: number; value: number } => Number.isFinite(point.value));
  if (points.length < 2) return null;

  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 78 - ((point.value - min) / span) * 56;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const lastActualIndex = trend.actual.filter((point) => Number.isFinite(point.value)).length - 1;
  const actualPath = points
    .slice(0, lastActualIndex + 1)
    .map((point, index, arr) => {
      const x = (index / Math.max(1, points.length - 1)) * 100;
      const y = 78 - ((point.value - min) / span) * 56;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="metric-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="spark-area" d={`${path} L 100 100 L 0 100 Z`} />
      <path className="spark-line" d={actualPath} />
      {trend.projection && <path className="spark-projection" d={path} />}
    </svg>
  );
}

function growthTrend(trend?: TrendSeries): TrendSeries | undefined {
  const base = trend?.actual.find((point) => Number.isFinite(point.value))?.value;
  if (!trend || !base) return trend;
  return {
    actual: trend.actual.map((point) => ({
      year: point.year,
      value: Number.isFinite(point.value) ? Number((((point.value || 0) - base) / base * 100).toFixed(1)) : null,
    })),
    projection: trend.projection
      ? {
          ...trend.projection,
          value: Number((((trend.projection.value || 0) - base) / base * 100).toFixed(1)),
        }
      : null,
  };
}

function radiusTrend(radius: number): TrendSeries {
  return {
    actual: [
      { year: 1, value: 5000 },
      { year: 2, value: 10000 },
      { year: 3, value: radius },
    ],
    projection: null,
  };
}

function DiscoveryPanel({
  result,
  emptyLabel,
  source,
  sourceKind,
}: {
  result: DiscoveryResult;
  emptyLabel: string;
  source: string;
  sourceKind: "free-source" | "paid-source";
}) {
  if (result.status === "loading") {
    return <div className="free-probe loading"><strong>Loading dumped data...</strong><span>The dashboard reads static JSON generated offline.</span></div>;
  }

  if (result.status === "error") {
    return <div className="free-probe error"><strong>{source} gather failed</strong><span>{result.message}</span><SourceBadge label={source} /></div>;
  }

  if (result.status !== "ready") {
    return <div className="free-probe"><strong>{emptyLabel}</strong><span>This panel reads only the pre-gathered static dump.</span><SourceBadge label={source} /></div>;
  }

  return (
    <div className="company-list">
      <div className="free-probe ready">
        <strong>{result.count} pre-gathered {sourceKind} matches</strong>
        <span>{result.message}</span>
        <SourceBadge label={source} />
      </div>
      {result.items.length === 0 ? (
        <div className="source-note">No {source} matches found in the dump. That does not prove the market has no companies or communities; it only reflects this source and query.</div>
      ) : (
        result.items.map((item) => (
          <article className="company-card" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <small>{item.address || item.category || "mapped place"}</small>
            </div>
            <div className="source-wrap">
              {item.website && <a href={item.website} target="_blank" rel="noreferrer">website</a>}
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">map</a>}
              {item.phone && <span>phone</span>}
              {item.operator && <span>operator: {item.operator}</span>}
              {item.status && <span>{item.status.replaceAll("_", " ").toLowerCase()}</span>}
              {item.rating && <span>{item.rating.toFixed(1)} rating</span>}
              {item.reviews && <span>{num(item.reviews)} reviews</span>}
              <span>{classifyMarket(item).label}</span>
              <SourceBadge label={source} />
            </div>
            {(item.tags?.evidence || item.tags?.evidenceNote) && <p className="evidence-note">{item.tags.evidence || item.tags.evidenceNote}</p>}
          </article>
        ))
      )}
    </div>
  );
}

type MarketSummary = {
  serviceCandidates: number;
  rentalCandidates: number;
  local: number;
  regional: number;
  chain: number;
  unknown: number;
  managerSignals: Array<{ name: string; source: string }>;
};

function AnswerStrip({ city, summary }: { city: City; summary: MarketSummary }) {
  return (
    <section className="answer-strip">
      <article className="answer-card">
        <span>Layer 1</span>
        <strong>{city.name} ranks #{city.rank}</strong>
        <small>{pct(city.incomeGrowth)} income growth and {pct(city.employedGrowth)} employed-resident growth from ACS.</small>
        <SourceBadge label="ACS" />
      </article>
      <article className="answer-card">
        <span>Layer 2</span>
        <strong>{summary.serviceCandidates} service candidates</strong>
        <div className="breakdown">
          <i>{summary.local} local</i>
          <i>{summary.regional} regional</i>
          <i>{summary.chain} chain</i>
          {summary.unknown > 0 && <i>{summary.unknown} unknown</i>}
        </div>
        <SourceBadge label="SerpAPI" />
        <SourceBadge label="Google" />
        <SourceBadge label="Public Web" />
        <SourceBadge label="OSM" />
      </article>
      <article className="answer-card">
        <span>Layer 3</span>
        <strong>{summary.rentalCandidates} for-rent candidates</strong>
        <small>{summary.managerSignals.length} management/operator signals found in the current dump.</small>
        <SourceBadge label="Google" />
        <SourceBadge label="Public Web" />
        <SourceBadge label="OSM" />
      </article>
    </section>
  );
}

function summarizeMarket(
  city: City,
  results: {
    services: DiscoveryResult;
    rentals: DiscoveryResult;
    manualServices: DiscoveryResult;
    manualRentals: DiscoveryResult;
    googleServices: DiscoveryResult;
    googleRentals: DiscoveryResult;
    serpServices: DiscoveryResult;
    serpRentals: DiscoveryResult;
  },
): MarketSummary {
  const serviceItems = dedupeItems([
    ...results.manualServices.items,
    ...results.serpServices.items,
    ...results.googleServices.items,
    ...results.services.items,
  ]);
  const rentalGroups = [
    { source: "SerpAPI", result: results.serpRentals },
    { source: "Google", result: results.googleRentals },
    { source: "Public Web", result: results.manualRentals },
    { source: "OSM", result: results.rentals },
  ];
  const managerSignals = rentalGroups.flatMap(({ source, result }) =>
    result.items
      .map((item) => ({ name: managerName(item), source }))
      .filter((item): item is { name: string; source: string } => Boolean(item.name)),
  );

  const classes = serviceItems.map((item) => classifyMarket(item, city.name).className);
  return {
    serviceCandidates: serviceItems.length,
    rentalCandidates: Math.max(...rentalGroups.map(({ result }) => result.count || result.items.length || 0), 0),
    local: classes.filter((item) => item === "local").length,
    regional: classes.filter((item) => item === "regional").length,
    chain: classes.filter((item) => item === "chain").length,
    unknown: classes.filter((item) => item === "unknown").length,
    managerSignals: dedupeManagers(managerSignals).slice(0, 8),
  };
}

function dedupeItems(items: DiscoveryItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyMarket(item: DiscoveryItem, cityName = "") {
  if (item.marketClass) return { className: item.marketClass, label: item.marketClass };
  const name = item.name.toLowerCase();
  const website = item.website?.toLowerCase() || "";
  const chainPatterns = [
    "aire serv",
    "benjamin franklin",
    "mr. electric",
    "mister sparky",
    "mr. rooter",
    "one hour",
    "orkin",
    "roto-rooter",
    "terminix",
    "trugreen",
  ];
  if (chainPatterns.some((brand) => name.includes(brand) || website.includes(brand.replace(/[^a-z]/g, "")))) {
    return { className: "chain" as const, label: "chain" };
  }
  if (/\b(southern|southeast|metro|statewide|tri-state|regional|alabama|georgia)\b/i.test(item.name)) {
    return { className: "regional" as const, label: "regional" };
  }
  if (/\b(inc|llc|services|heating|cooling|plumbing|electric|pest|landscap|roofing)\b/i.test(item.name)) {
    return { className: "local" as const, label: cityName && name.includes(cityName.toLowerCase()) ? "local" : "local/regional" };
  }
  return { className: "unknown" as const, label: "unclassified" };
}

function managerName(item: DiscoveryItem) {
  if (item.managementCompany) return item.managementCompany;
  if (item.operator) return item.operator;
  const haystack = [item.name, item.category, item.address, item.tags?.formattedAddress].filter(Boolean).join(" ");
  if (/\b(management|property|properties|realty|residential|apartments)\b/i.test(haystack)) return item.name;
  return "";
}

function dedupeManagers(items: Array<{ name: string; source: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function SourceStack() {
  return (
    <div className="source-list">
      {SOURCES.map((source) => (
        <article key={source.label}>
          <strong>{source.name}</strong>
          <span>{source.method}</span>
          <small>{source.coverage}</small>
          <a href={source.url} target="_blank" rel="noreferrer">
            Source documentation
          </a>
        </article>
      ))}
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  const source = SOURCES.find((item) => item.label === label);
  return (
    <a className="source-badge live-public" href={source?.url || "#"} target="_blank" rel="noreferrer" title={source?.method}>
      {label}
    </a>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
