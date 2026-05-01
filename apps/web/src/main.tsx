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
  source?: unknown;
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

const STATES: Record<StateCode, { code: StateCode; name: string; abbr: string }> = {
  "01": { code: "01", name: "Alabama", abbr: "AL" },
  "13": { code: "13", name: "Georgia", abbr: "GA" },
};

const SOURCES: SourceRef[] = [
  {
    label: "ACS",
    name: "Census ACS 5-Year Detailed Tables",
    url: "https://api.census.gov/data/2024/acs/acs5.html",
    method:
      "Ranks places by average household income growth and employed-resident growth between ACS 2019 and ACS 2024.",
    coverage: "Live for Alabama and Georgia places with population above the selected threshold.",
  },
  {
    label: "OSM",
    name: "OpenStreetMap via Overpass",
    url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
    method:
      "Searches mapped businesses and apartment/rental-like places around the selected city using tags and name patterns.",
    coverage:
      "Live but incomplete. OSM is free and useful for public POIs, but it undercounts contractors, apartment managers, ownership, and weak-web businesses.",
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

function emptyDiscovery(message = "Run a free-source search for the selected city."): DiscoveryResult {
  return { status: "idle", count: 0, items: [], message };
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
        const response = await fetch(`/api/growth?state=${stateCode}&startYear=2019&endYear=2024&minPopulation=5000&limit=25`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load ACS growth data.");
        if (cancelled) return;
        setCities(payload.cities);
        setSelectedCity(payload.cities[0]?.name ?? "");
        setGrowthStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setCities([]);
        setSelectedCity("");
        setGrowthStatus("error");
        setGrowthError(error instanceof Error ? error.message : "Could not load ACS growth data.");
      }
    }
    loadGrowth();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  async function runDiscovery(type: DiscoveryType) {
    if (!activeCity) return;
    const setter = type === "services" ? setServices : setRentals;
    setter({ status: "loading", count: 0, items: [], message: `Searching ${state.name} free sources...` });
    try {
      const url = `/api/osm?city=${encodeURIComponent(activeCity.name)}&stateName=${encodeURIComponent(state.name)}&type=${type}&radius=${radius}`;
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Free-source search failed.");
      setter({
        status: "ready",
        count: payload.count,
        items: payload.items,
        message: payload.warning || "Free-source search complete.",
        sourceUrl: payload.sourceUrl,
      });
    } catch (error) {
      setter({
        status: "error",
        count: 0,
        items: [],
        message: error instanceof Error ? error.message : "Free-source search failed.",
      });
    }
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="City Growth Dashboard">
          <span>
            <strong>City Growth Dashboard</strong>
            <small>Live free-source research for Alabama and Georgia</small>
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
          <GrowthMap cities={cities.slice(0, 10)} selected={activeCity?.name} onSelect={setSelectedCity} />
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
            <Metric title="Avg household income" value={money(activeCity.avgHouseholdIncome)} note="ACS aggregate income / households" source="ACS" />
            <Metric title="Income growth" value={pct(activeCity.incomeGrowth)} note="ACS 2019 to ACS 2024" source="ACS" />
            <Metric title="Employed-resident growth" value={pct(activeCity.employedGrowth)} note="City-level jobs proxy" source="ACS" />
            <Metric title="Composite score" value={activeCity.score.toFixed(1)} note="income growth + employed growth" source="ACS" />
            <Metric title="Free-source radius" value={`${Math.round(radius / 1000)} km`} note="OSM search radius" source="OSM" />
          </section>

          <section className="detail-grid">
            <div className="panel services-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{activeCity.name}</p>
                  <h2>Local service companies</h2>
                </div>
                <button className="action-button" onClick={() => runDiscovery("services")}>
                  Search free sources
                </button>
              </div>
              <DiscoveryPanel result={services} emptyLabel="No free-source service matches yet." />
            </div>

            <div className="panel housing-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">For-rent housing</p>
                  <h2>Rental/community matches</h2>
                </div>
                <button className="action-button" onClick={() => runDiscovery("rentals")}>
                  Search free sources
                </button>
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
                  <h2>What is live now</h2>
                </div>
              </div>
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
            <small>Live free-source research for Alabama and Georgia</small>
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

function Metric({ title, value, note, source }: { title: string; value: string; note: string; source: string }) {
  return (
    <article className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
      <SourceBadge label={source} />
    </article>
  );
}

function DiscoveryPanel({ result, emptyLabel }: { result: DiscoveryResult; emptyLabel: string }) {
  if (result.status === "loading") {
    return <div className="free-probe loading"><strong>Searching live free sources...</strong><span>This can take a few seconds because public Overpass instances are rate-limited.</span></div>;
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
        <strong>{result.count} live free-source matches</strong>
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
