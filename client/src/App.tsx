import { useEffect, useState } from 'react'
import './App.css'

const API_BASE = '/api'

interface Prediction {
  disease: string
  confidence: number
  low_confidence: boolean
  message: string | null
  probabilities: Record<string, number>
}

const sidebarItems = [
  { label: 'Dashboard', icon: 'grid' },
  { label: 'Flocks', icon: 'barn' },
  { label: 'Cases', icon: 'alert' },
  { label: 'Predictions', icon: 'pulse' },
  { label: 'Reports', icon: 'report' },
  { label: 'Settings', icon: 'gear' },
]

const summaryCards = [
  { label: 'Birds Monitored', value: '18,240', meta: '+12% this month', tone: 'blue' },
  { label: 'Active Farms', value: '24', meta: '3 regions online', tone: 'amber' },
  { label: 'Flagged Cases', value: '08', meta: '2 need review', tone: 'red' },
  { label: 'Model Accuracy', value: '94.8%', meta: 'Last validation run', tone: 'green' },
]

const farmCards = [
  { name: 'Newcastle North Farm', owner: 'Admin', birds: '4,600 birds', status: 'Stable' },
  { name: 'Green Valley Poultry', owner: 'Supervisor', birds: '3,240 birds', status: 'Observe' },
  { name: 'Sunrise Layers Unit', owner: 'Field Officer', birds: '5,100 birds', status: 'Stable' },
  { name: 'Riverbend Broilers', owner: 'Admin', birds: '5,300 birds', status: 'Priority' },
]

const surveillanceRows = [
  { flock: 'Broiler House A', contact: 'John Dube', location: 'Bulawayo', lastScan: '2 hrs ago', state: 'Healthy trend' },
  { flock: 'Layer Unit C', contact: 'Rudo Moyo', location: 'Harare', lastScan: '5 hrs ago', state: 'Watchlist' },
  { flock: 'Brooder Pen 2', contact: 'Grace Ncube', location: 'Gweru', lastScan: 'Today', state: 'Healthy trend' },
  { flock: 'Grower Block D', contact: 'Tinashe Ndlovu', location: 'Mutare', lastScan: 'Yesterday', state: 'Needs review' },
]

const activityRows = [
  { event: 'Coccidiosis risk spike detected', source: 'Model inference', when: '09:12', severity: 'Medium' },
  { event: 'NCD sample uploaded for review', source: 'Vet technician', when: '08:40', severity: 'High' },
  { event: 'Healthy batch confirmed', source: 'Farm dashboard', when: 'Yesterday', severity: 'Low' },
]

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`)
      const data = await res.json()
      setModelReady(data.model_ready)
    } catch {
      setModelReady(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      setError('Please select an image file like PNG, JPG, or JPEG.')
      return
    }

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Prediction failed')
        return
      }

      setResult(data)
    } catch {
      setError('Could not reach the server. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  const topProbability = result
    ? Object.entries(result.probabilities).sort((a, b) => b[1] - a[1])[0]
    : null

  return (
    <div className="dashboard-app">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand brand-sidebar">
            <div className="brand-badge">PD</div>
            <div>
              <strong>PoultryCare</strong>
              <span>Disease Monitor</span>
            </div>
          </div>
          <button type="button" className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close sidebar">
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          {sidebarItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${index === 0 ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <p>System status</p>
          <strong>{modelReady ? 'Model ready' : 'Waiting for backend'}</strong>
          <button type="button" onClick={checkStatus}>
            Refresh status
          </button>
        </div>
      </aside>

      {menuOpen && <button type="button" className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle menu">
              <span />
              <span />
              <span />
            </button>
            <strong className="page-title">Dashboard</strong>
          </div>

          <div className="topbar-title">
            <p className="eyebrow">Operations overview</p>
            <h1>Dashboard</h1>
          </div>

          <div className="topbar-actions">
            <div className="user-chip">
              <div className="avatar">PN</div>
              <div>
                <strong>Panashe</strong>
                <span>System Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          <section className="hero-panel">
            <div className="hero-copy">
              <p className="eyebrow">Live surveillance</p>
              <h2>Monitor farm health, triage image uploads, and review predictions from one workspace.</h2>
              <p>
                The dashboard brings together rapid disease screening, current flock activity,
                and field response signals for mobile and desktop users.
              </p>
            </div>

            <div className="hero-stats">
              <div>
                <span>Teams active</span>
                <strong>09</strong>
              </div>
              <div>
                <span>Screenings today</span>
                <strong>146</strong>
              </div>
              <div>
                <span>Critical alerts</span>
                <strong>02</strong>
              </div>
            </div>
          </section>

          <section className="summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label} className={`summary-card tone-${card.tone}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.meta}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-grid">
            <div className="panel panel-wide">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Farms</p>
                  <h3>Registered poultry units</h3>
                </div>
                <button type="button" className="ghost-btn">View all</button>
              </div>

              <div className="farm-grid">
                {farmCards.map((farm) => (
                  <article key={farm.name} className="farm-card">
                    <div className="farm-badge">{farm.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{farm.name}</strong>
                      <span>{farm.owner}</span>
                    </div>
                    <p>{farm.birds}</p>
                    <small>{farm.status}</small>
                  </article>
                ))}
              </div>
            </div>

            <section className="panel upload-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Prediction</p>
                  <h3>Upload poultry image</h3>
                </div>
                <button type="button" className="ghost-btn" onClick={checkStatus}>Check model</button>
              </div>

              <form onSubmit={handleSubmit} className="predict-form">
                <label className="upload-dropzone" htmlFor="file-input">
                  <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} />
                  {preview ? (
                    <img src={preview} alt="Selected poultry preview" className="preview-image" />
                  ) : (
                    <div className="upload-placeholder">
                      <Icon name="upload" />
                      <strong>Tap or click to add an image</strong>
                      <span>Optimized for quick checks on desktop and mobile.</span>
                    </div>
                  )}
                </label>

                <button type="submit" className="primary-btn" disabled={!file || loading}>
                  {loading ? 'Analyzing image...' : 'Run prediction'}
                </button>
              </form>

              {error && <p className="inline-error">{error}</p>}

              <div className="prediction-card">
                <div className="prediction-head">
                  <div>
                    <span>Latest result</span>
                    <strong>{result ? result.disease : 'Waiting for scan'}</strong>
                  </div>
                  <div className={`confidence-pill ${result?.low_confidence ? 'warning' : ''}`}>
                    {result ? `${result.confidence}% confidence` : 'No result yet'}
                  </div>
                </div>

                {result?.message && <p className="prediction-message">{result.message}</p>}

                {topProbability && (
                  <p className="top-match">
                    Strongest class: <strong>{topProbability[0]}</strong> at {topProbability[1]}%
                  </p>
                )}

                <div className="probability-list">
                  {(result ? Object.entries(result.probabilities) : []).map(([label, value]) => (
                    <div key={label} className="probability-row">
                      <span>{label}</span>
                      <div className="probability-track">
                        <div className="probability-bar" style={{ width: `${value}%` }} />
                      </div>
                      <strong>{value}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel panel-wide">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Surveillance</p>
                  <h3>Recent flock activity</h3>
                </div>
                <button type="button" className="ghost-btn">Export</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Flock</th>
                      <th>Contact person</th>
                      <th>Location</th>
                      <th>Last scan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveillanceRows.map((row) => (
                      <tr key={row.flock}>
                        <td>{row.flock}</td>
                        <td>{row.contact}</td>
                        <td>{row.location}</td>
                        <td>{row.lastScan}</td>
                        <td>
                          <span className={`table-pill ${row.state === 'Needs review' ? 'danger' : row.state === 'Watchlist' ? 'warning' : 'safe'}`}>
                            {row.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Activity</p>
                  <h3>Latest alerts</h3>
                </div>
              </div>

              <div className="activity-list">
                {activityRows.map((item) => (
                  <article key={item.event} className="activity-item">
                    <div className={`severity-dot severity-${item.severity.toLowerCase()}`} />
                    <div>
                      <strong>{item.event}</strong>
                      <p>{item.source}</p>
                    </div>
                    <span>{item.when}</span>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  )
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
    barn: 'M4 10 12 4l8 6v10h-5v-5H9v5H4z',
    alert: 'M12 3 2 21h20L12 3zm0 6v5m0 4h.01',
    pulse: 'M3 12h4l2-4 4 8 2-4h6',
    report: 'M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3',
    gear: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8 3-1.7-.3a6.8 6.8 0 0 0-.7-1.6l1-1.4-1.9-1.9-1.4 1a6.8 6.8 0 0 0-1.6-.7L12.5 4h-1l-.3 1.7a6.8 6.8 0 0 0-1.6.7l-1.4-1-1.9 1.9 1 1.4a6.8 6.8 0 0 0-.7 1.6L4 11.5v1l1.7.3a6.8 6.8 0 0 0 .7 1.6l-1 1.4 1.9 1.9 1.4-1a6.8 6.8 0 0 0 1.6.7l.3 1.7h1l.3-1.7a6.8 6.8 0 0 0 1.6-.7l1.4 1 1.9-1.9-1-1.4a6.8 6.8 0 0 0 .7-1.6l1.7-.3z',
    upload: 'M12 16V7m0 0-4 4m4-4 4 4M5 20h14',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

export default App
