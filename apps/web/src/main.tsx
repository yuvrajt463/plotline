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
    label: "Nominatim",
    name: "OpenStreetMap Nominatim",
    url: "https://nominatim.org/release-docs/latest/api/Search/",
    method: "Geocodes the selected city before Overpass radius searches.",
    coverage: "Live for city centers; rate-limited and intended for light use.",
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
  const [growthStatus, setGrowthStatus] = useState<"loading" | "ready" | "error">("loading");
  const [growthError, setGrowthError] = useState("");
  const [services, setServices] = useState<DiscoveryResult>(emptyDiscovery());
  const [rentals, setRentals] = useState<DiscoveryResult>(emptyDiscovery());

  const state = STATES[stateCode];
  const activeCity = cities.find((city) => city.name === selectedCity) ?? cities[0];
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
      try {
        const response = await fetch(`/data/${state.abbr.toLowerCase()}-free-research.json`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load dumped research data.");
        if (cancelled) return;
        setCities(payload.cities);
        setDumpMeta(payload);
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
  }, [activeCity?.place]);

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
              {growthStatus === "ready" ? "Live ACS" : growthStatus === "loading" ? "Loading" : "Error"}
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

          <section className="detail-grid">
            <div className="panel services-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{activeCity.name}</p>
                  <h2>Local service companies</h2>
                </div>
                <SourceBadge label="OSM" />
              </div>
              <DiscoveryPanel result={services} emptyLabel="No free-source service matches yet." />
            </div>

            <div className="panel housing-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">For-rent housing</p>
                  <h2>Rental/community matches</h2>
                </div>
                <SourceBadge label="OSM" />
              </div>
              <DiscoveryPanel result={rentals} emptyLabel="No free-source rental/community matches yet." />
              <div className="source-note">
                <strong>Management companies:</strong> free OSM records may include an <code>operator</code> tag or website, but full ownership and management coverage usually requires community websites or licensed multifamily data.
              </div>
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

function DiscoveryPanel({ result, emptyLabel }: { result: DiscoveryResult; emptyLabel: string }) {
  if (result.status === "loading") {
    return <div className="free-probe loading"><strong>Loading dumped data...</strong><span>The dashboard reads static JSON generated from free sources.</span></div>;
  }

  if (result.status === "error") {
    return <div className="free-probe error"><strong>Search failed</strong><span>{result.message}</span><SourceBadge label="OSM" /></div>;
  }

  if (result.status !== "ready") {
    return <div className="free-probe"><strong>{emptyLabel}</strong><span>Use the search button to query OpenStreetMap/Overpass around the selected city.</span><SourceBadge label="OSM" /></div>;
  }

  return (
    <div className="company-list">
      <div className="free-probe ready">
        <strong>{result.count} pre-gathered free-source matches</strong>
        <span>{result.message}</span>
        <SourceBadge label="OSM" />
      </div>
      {result.items.length === 0 ? (
        <div className="source-note">No free-source matches found. This means OSM has no matching records in the search radius, not that the market has no companies or communities.</div>
      ) : (
        result.items.map((item) => (
          <article className="company-card" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <small>{item.category || "mapped place"}</small>
            </div>
            <div className="source-wrap">
              {item.website && <span>website</span>}
              {item.phone && <span>phone</span>}
              {item.operator && <span>operator: {item.operator}</span>}
              <SourceBadge label="OSM" />
            </div>
          </article>
        ))
      )}
    </div>
  );
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
