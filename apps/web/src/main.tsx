import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type StateCode = "01" | "13";
type DiscoveryType = "services" | "rentals";

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
  specialCity?: boolean;
  specialLabel?: string;
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

type StateBoundary = {
  abbr: string;
  name: string;
  rings: Array<Array<[number, number]>>;
};

type BoundaryDump = {
  states: Partial<Record<StateCode, StateBoundary>>;
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

const STATES: Record<StateCode, { code: StateCode; name: string; abbr: string }> = {
  "01": { code: "01", name: "Alabama", abbr: "AL" },
  "13": { code: "13", name: "Georgia", abbr: "GA" },
};

const STATE_BOUNDS: Record<StateCode, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  "01": { minLat: 30.1, maxLat: 35.1, minLon: -88.6, maxLon: -84.7 },
  "13": { minLat: 30.3, maxLat: 35.1, minLon: -85.7, maxLon: -80.6 },
};

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
  const [boundaries, setBoundaries] = useState<BoundaryDump | null>(null);
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
        const [response, manualResponse, boundaryResponse] = await Promise.all([
          fetch(`/data/${state.abbr.toLowerCase()}-free-research.json`),
          fetch("/data/manual-research.json"),
          fetch("/data/state-boundaries.json"),
        ]);
        const payload = await response.json();
        const manualPayload = await manualResponse.json();
        const boundaryPayload = boundaryResponse.ok ? await boundaryResponse.json() : null;
        if (!response.ok) throw new Error(payload.error || "Could not load dumped research data.");
        if (cancelled) return;
        setCities(payload.cities);
        setManualDump(manualResponse.ok ? manualPayload : null);
        setBoundaries(boundaryPayload);
        setSelectedCity(payload.cities[0]?.name ?? "");
        setGrowthStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setCities([]);
        setSelectedCity("");
        setGrowthStatus("error");
        setBoundaries(null);
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
            <small>Alabama and Georgia market intelligence</small>
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
          </div>
          <StateRankMap
            stateCode={stateCode}
            boundary={boundaries?.states?.[stateCode]}
            cities={cities.filter((city) => !city.specialCity).slice(0, 10)}
            specialCities={cities.filter((city) => city.specialCity)}
            selected={activeCity?.name}
            onSelect={setSelectedCity}
          />
        </div>

        <aside className="panel rank-panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Searchable city list</p>
              <h2>Top places</h2>
            </div>
            <span className={`live-status ${growthStatus}`}>
              {growthStatus === "ready" ? "Ready" : growthStatus === "loading" ? "Loading" : "Error"}
            </span>
          </div>
          <div className="source-note compact-note">Top 10 markets are deeply researched. Additional ranked cities are searchable below.</div>
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
                className={`${city.name === activeCity?.name ? "rank-row active" : "rank-row"} ${city.specialCity ? "special" : ""}`}
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
                <span className="rank-num">{city.specialCity ? "*" : city.rank}</span>
                <span className="rank-main">
                  <strong>{city.name}</strong>
                  <small>{city.specialCity ? city.specialLabel || "Star city" : `${city.kind} - pop ${num(city.population)}`}</small>
                </span>
                <span className="rank-score">{city.specialCity ? "Pinned" : city.score.toFixed(1)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {activeCity && (
        <>
          <section className="stat-strip">
            <Metric title="Avg household income" value={money(activeCity.avgHouseholdIncome)} note="Household income momentum" source="Census ACS public tables" trend={activeCity.trends?.avgHouseholdIncome} />
            <Metric title="Income growth" value={pct(activeCity.incomeGrowth)} note="Five-year change" source="Census ACS public tables, 2019 to 2024" trend={growthTrend(activeCity.trends?.avgHouseholdIncome)} />
            <Metric title="Resident employment" value={pct(activeCity.employedGrowth)} note="Five-year change" source="Census ACS employed-resident table" trend={activeCity.trends?.employedResidents} />
            <Metric title="Market score" value={activeCity.score.toFixed(1)} note="Growth momentum" source="Income growth plus employed-resident growth" trend={activeCity.trends?.compositeScore} />
          </section>

          {summary && <AnswerStrip city={activeCity} summary={summary} />}

          <section className="detail-grid">
            <div className="panel services-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{activeCity.name}</p>
                  <h2>Service companies</h2>
                </div>
                <InfoTip text="Public company pages and directories. Listings open to the page where the city was referenced." />
              </div>
              <ExecutiveList
                items={dedupeItems([...manualServices.items, ...serpServices.items, ...googleServices.items, ...services.items])}
                emptyLabel="No service companies verified yet."
              />
            </div>

            <div className="panel housing-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">For-rent housing</p>
                  <h2>For-rent communities</h2>
                </div>
                <InfoTip text="Apartment sites, rental marketplaces, and property manager pages. Listings open to the evidence page." />
              </div>
              <ExecutiveList
                items={dedupeItems([...manualRentals.items, ...serpRentals.items, ...googleRentals.items, ...rentals.items])}
                emptyLabel="No for-rent communities verified yet."
              />
              {summary.managerSignals.length > 0 && (
                <div className="manager-list">
                  {summary.managerSignals.map((item) => (
                    <span key={`${item.source}-${item.name}`}>{item.name}</span>
                  ))}
                </div>
              )}
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
            <small>Alabama and Georgia market intelligence</small>
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

function StateRankMap({
  stateCode,
  boundary,
  cities,
  specialCities,
  selected,
  onSelect,
}: {
  stateCode: StateCode;
  boundary?: StateBoundary;
  cities: City[];
  specialCities: City[];
  selected?: string;
  onSelect: (city: string) => void;
}) {
  const bounds = useMemo(() => boundaryBounds(boundary) || STATE_BOUNDS[stateCode], [boundary, stateCode]);
  const projectLonLat = (lon?: number | null, lat?: number | null) => {
    const x = lon == null ? 50 : 5 + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 90;
    const y = lat == null ? 50 : 95 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 90;
    return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
  };
  const project = (city: City) => projectLonLat(city.lon, city.lat);
  const pathForRing = (ring: Array<[number, number]>) => {
    if (!ring.length) return "";
    return ring
      .map(([lon, lat], index) => {
        const { x, y } = projectLonLat(lon, lat);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z";
  };

  return (
    <div className="state-rank-map">
      <svg viewBox="0 0 100 100" role="img" aria-label="State map with top ranked cities">
        {(boundary?.rings?.length ? boundary.rings : []).map((ring, index) => (
          <path className="state-shape" d={pathForRing(ring)} key={index} />
        ))}
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
        {specialCities.map((city) => {
          const { x, y } = project(city);
          const active = city.name === selected;
          return (
            <g key={city.place} className="rank-dot-group special-star" onClick={() => onSelect(city.name)}>
              <circle className={`rank-dot special ${active ? "active" : ""}`} cx={x} cy={y} r={active ? 6.7 : 5.6} />
              <text x={x} y={y + 1.6}>
                *
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <strong>{selected}</strong>
        <span>Top 10 ranked cities are green. Starred strategic cities are gold.</span>
      </div>
    </div>
  );
}

function boundaryBounds(boundary?: StateBoundary) {
  const points = boundary?.rings?.flat() || [];
  if (!points.length) return null;
  const lons = points.map(([lon]) => lon).filter(Number.isFinite);
  const lats = points.map(([, lat]) => lat).filter(Number.isFinite);
  if (!lons.length || !lats.length) return null;
  const padLon = (Math.max(...lons) - Math.min(...lons)) * 0.04;
  const padLat = (Math.max(...lats) - Math.min(...lats)) * 0.04;
  return {
    minLon: Math.min(...lons) - padLon,
    maxLon: Math.max(...lons) + padLon,
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
  };
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
      <div className="metric-context">
        <strong>{source}</strong>
        <span>{note}</span>
      </div>
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

function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={text}>
      i
      <span>{text}</span>
    </span>
  );
}

function ExecutiveList({ items, emptyLabel }: { items: DiscoveryItem[]; emptyLabel: string }) {
  if (items.length === 0) return <div className="empty-list">{emptyLabel}</div>;
  return (
    <div className="executive-list">
      {items.map((item) => {
        const href = item.sourceUrl || item.website || "#";
        const descriptor = item.managementCompany || item.address || item.category || "Verified listing";
        const content = (
          <>
            <strong>{item.name}</strong>
            <small>{descriptor}</small>
          </>
        );
        return href === "#" ? (
          <article className="listing-card" key={item.id}>{content}</article>
        ) : (
          <a className="listing-card" href={href} target="_blank" rel="noreferrer" key={item.id}>
            {content}
          </a>
        );
      })}
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
  const cityHeadline = city.specialCity ? `${city.name} is pinned for review` : `${city.name} ranks #${city.rank}`;
  const cityDetail = city.specialCity
    ? `${pct(city.incomeGrowth)} income growth and ${pct(city.employedGrowth)} employed-resident growth, shown alongside the ranked markets.`
    : `${pct(city.incomeGrowth)} income growth and ${pct(city.employedGrowth)} employed-resident growth.`;

  return (
    <section className="answer-strip">
      <article className="answer-card">
        <span>Growth</span>
        <strong>{cityHeadline}</strong>
        <small>{cityDetail}</small>
      </article>
      <article className="answer-card">
        <span>Services</span>
        <strong>{summary.serviceCandidates} service candidates</strong>
        <div className="breakdown">
          <i>{summary.local} local</i>
          <i>{summary.regional} regional</i>
          <i>{summary.chain} chain</i>
          {summary.unknown > 0 && <i>{summary.unknown} unknown</i>}
        </div>
      </article>
      <article className="answer-card">
        <span>For Rent</span>
        <strong>{summary.rentalCandidates} for-rent candidates</strong>
        <small>{summary.managerSignals.length} management or operator names identified.</small>
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
