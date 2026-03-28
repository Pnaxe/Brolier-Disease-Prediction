import { useEffect, useRef, useState } from 'react'
import './App.css'
import CasesPage from './CasesPage'
import FlocksPage from './FlocksPage'
import ModellingPage from './ModellingPage'
import ReportsPage from './ReportsPage'
import SettingsPage from './SettingsPage'
import loginLogoImage from './assets/images/logoo (2).png'

const API_BASE = '/api'
const AUTH_STORAGE_KEY = 'broiler-authenticated'
const ACTIVE_PAGE_STORAGE_KEY = 'broiler-active-page'
const DEFAULT_USERNAME = 'sysadmin'
const DEFAULT_PASSWORD = 'password123'
const DEFAULT_USER_FULL_NAME = 'System Administrator'

interface Prediction {
  disease: string
  confidence: number
  low_confidence: boolean
  message: string | null
  probabilities: Record<string, number>
}

type UploadKind = 'image' | 'video'

interface SelectedUpload {
  file: File
  preview: string
  kind: UploadKind
}

interface PredictionResultItem {
  fileName: string
  preview: string
  kind: UploadKind
  prediction: Prediction
}

interface PredictToast {
  text: string
  tone: 'success' | 'error'
}

interface DiseaseSummary {
  disease: string
  count: number
  highestConfidence: number
}

interface ReportRow {
  caseId: string
  flock: string
  date: string
  disease: string
  confidence: number
  status: string
  recommendation: string
}

interface DashboardMetricCard {
  label: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: string
}

interface DashboardQuickStat {
  value: string
  label: string
}

interface DashboardRiskLevel {
  label: string
  value: string
  width: string
}

interface DashboardWorkflowRow {
  label: string
  value: string
}

interface DashboardInsightRow {
  title: string
  meta: string
}

interface DashboardSummary {
  model_ready: boolean
  hero_tags: string[]
  hero_side: {
    suspected_cases: string
    detection_model: string
  }
  overview_cards: DashboardMetricCard[]
  quick_stats: DashboardQuickStat[]
  risk_levels: DashboardRiskLevel[]
  workflow_rows: DashboardWorkflowRow[]
  insight_rows: DashboardInsightRow[]
  screening_volume: number[]
  prediction_trend: number[]
  alert_trend: number[]
}

type PageKey = 'Dashboard' | 'Flocks' | 'Cases' | 'Predict Disease' | 'Modelling' | 'Reports' | 'Settings'

const sidebarItems = [
  { label: 'Dashboard', icon: 'grid' },
  { label: 'Batch', pageKey: 'Flocks', icon: 'chicken' },
  { label: 'Cases', icon: 'alert' },
  { label: 'Predict Disease', icon: 'pulse' },
  { label: 'Modelling', icon: 'model' },
  { label: 'Reports', icon: 'report' },
  { label: 'Settings', icon: 'gear' },
]

const overviewCards = [
  { label: 'Droppings Images Screened', value: '1,284', change: '+86 today', trend: 'up', icon: 'scan' },
  { label: 'Suspected Disease Alerts', value: '37', change: '+5 new flagged flocks', trend: 'up', icon: 'alert' },
  { label: 'Flocks Under Observation', value: '14', change: '3 need immediate review', trend: 'up', icon: 'case' },
  { label: 'Healthy Flocks', value: '112', change: '89.6% of active flocks', trend: 'up', icon: 'ai' },
]

const quickStats = [
  { value: '26', label: 'Active farms' },
  { value: '4,860', label: 'Samples reviewed today' },
  { value: '92%', label: 'Model confidence average' },
]

const riskLevels = [
  { label: 'Healthy flocks', value: '112', width: '82%' },
  { label: 'Watchlist flocks', value: '18', width: '44%' },
  { label: 'Critical flocks', value: '7', width: '18%' },
]

const workflowRows = [
  { label: 'Pending review', value: '11' },
  { label: 'Lab follow-up', value: '6' },
  { label: 'Vet escalations', value: '4' },
  { label: 'Treatment plans', value: '9' },
  { label: 'Resolved this week', value: '15' },
]

const insightRows = [
  { title: 'Newcastle North Farm shows respiratory symptom spike', meta: '8 minutes ago' },
  { title: 'Layer Unit C moved to watchlist after droppings screening', meta: '21 minutes ago' },
  { title: 'Mortality trend improved across two treated flocks', meta: '1 hour ago' },
]

const predictionFlockOptions = [
  'Batch A - 500 birds',
  'Layer Unit C',
  'Block D',
  'Starter Pen 2',
]

const IMAGE_FILE_PREFIX = 'image/'
const VIDEO_FILE_PREFIX = 'video/'

function getUploadKind(file: File): UploadKind | null {
  if (file.type.startsWith(IMAGE_FILE_PREFIX)) return 'image'
  if (file.type.startsWith(VIDEO_FILE_PREFIX)) return 'video'
  return null
}

  function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem(AUTH_STORAGE_KEY) === 'true')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [selectedImages, setSelectedImages] = useState<SelectedUpload[]>([])
  const [results, setResults] = useState<PredictionResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activePage, setActivePage] = useState<PageKey>(() => {
    const storedPage = localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY)
    const allowedPages: PageKey[] = ['Dashboard', 'Flocks', 'Cases', 'Predict Disease', 'Modelling', 'Reports', 'Settings']
    return storedPage && allowedPages.includes(storedPage as PageKey) ? (storedPage as PageKey) : 'Dashboard'
  })
  const [selectedPredictionFlock, setSelectedPredictionFlock] = useState('')
  const isDashboardLoading = dashboardData === null && modelReady === null
  const weeklyScreeningData = isDashboardLoading ? [18, 42, 28, 56, 36, 64, 44] : dashboardData?.screening_volume ?? [0, 0, 0, 0, 0, 0, 0]
  const predictionTrendData = isDashboardLoading ? [8, 14, 12, 18, 16, 21, 19, 24] : dashboardData?.prediction_trend ?? [0, 0, 0, 0, 0, 0, 0, 0]
  const alertTrendData = isDashboardLoading ? [4, 9, 7, 13, 11, 15, 14, 18] : dashboardData?.alert_trend ?? [0, 0, 0, 0, 0, 0, 0, 0]
  const pageTitle =
    activePage === 'Predict Disease' && results.length > 0 ? '' : activePage === 'Flocks' ? 'Batch' : activePage
  const loggedInFullName = DEFAULT_USER_FULL_NAME

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, activePage)
  }, [activePage, isAuthenticated])

  const selectedImagesRef = useRef<SelectedUpload[]>([])

  useEffect(() => {
    selectedImagesRef.current = selectedImages
  }, [selectedImages])

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview))
    }
  }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/summary`)
      const data = await res.json()
      setModelReady(data.model_ready)
      setDashboardData(data)
    } catch {
      setModelReady(false)
      setDashboardData(null)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(e.target.files ?? [])
    if (!pickedFiles.length) return

    setUploadingImages(true)
    setUploadProgress(0)

    const totalFiles = pickedFiles.length
    const nextFiles: File[] = []

    for (const [index, file] of pickedFiles.entries()) {
      nextFiles.push(file)
      setUploadProgress(Math.round(((index + 1) / totalFiles) * 100))
      await new Promise((resolve) => window.setTimeout(resolve, 80))
    }

    appendImages(nextFiles)
    setUploadingImages(false)
    setUploadProgress(0)
    e.target.value = ''
  }

  const appendImages = (pickedFiles: File[]) => {
    if (!pickedFiles.length) return

    if (pickedFiles.some((selected) => getUploadKind(selected) === null)) {
      setError('Please select image or video files only. Supported types include PNG, JPG, JPEG, MP4, MOV, and AVI.')
      return
    }

    setSelectedImages((currentImages) => {
      const existingKeys = new Set(currentImages.map((image) => `${image.file.name}-${image.file.lastModified}-${image.file.size}`))
      const nextImages = [...currentImages]

      pickedFiles.forEach((file) => {
        const key = `${file.name}-${file.lastModified}-${file.size}`
        const kind = getUploadKind(file)
        if (!existingKeys.has(key)) {
          nextImages.push({
            file,
            preview: URL.createObjectURL(file),
            kind: kind ?? 'image',
          })
          existingKeys.add(key)
        }
      })

      return nextImages
    })
    setResults([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedImages.length) return
    if (!selectedPredictionFlock) {
      setError('Please choose the batch or flock for these droppings samples before running prediction.')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])

    try {
      const nextResults: PredictionResultItem[] = []

      for (const image of selectedImages) {
        const formData = new FormData()
        formData.append('file', image.file)
        formData.append('batch_name', selectedPredictionFlock)

        const res = await fetch(`${API_BASE}/predict`, {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.detail || `Prediction failed for ${image.file.name}`)
          return
        }

        nextResults.push({
          fileName: image.file.name,
          preview: image.preview,
          kind: image.kind,
          prediction: data,
        })
      }

      setResults(nextResults)
    } catch {
      setError('Could not reach the server. Make sure the backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPrediction = () => {
    setResults([])
    setError(null)
  }

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault()

    if (loginUsername === DEFAULT_USERNAME && loginPassword === DEFAULT_PASSWORD) {
      setIsAuthenticated(true)
      setActivePage('Dashboard')
      setLoginError('')
      localStorage.setItem(AUTH_STORAGE_KEY, 'true')
      localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, 'Dashboard')
      return
    }

    setLoginError('Invalid username or password.')
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_PAGE_STORAGE_KEY)
    setIsAuthenticated(false)
    setLoginUsername('')
    setLoginPassword('')
    setLoginError('')
    setMenuOpen(false)
    setActivePage('Dashboard')
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        username={loginUsername}
        password={loginPassword}
        error={loginError}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand" aria-label="PoultryCare logo">
            <Logo />
          </div>
          <button type="button" className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close sidebar">
            X
          </button>
        </div>

        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={activePage === (item.pageKey ?? item.label) ? 'active' : ''}
              onClick={() => {
                setActivePage((item.pageKey ?? item.label) as PageKey)
                setMenuOpen(false)
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className={`backdrop ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />

      <main className="main-content">
          <header className="top-nav">
            <div className="top-nav-left">
              <button type="button" className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open sidebar">
                <svg className="menu-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 7h14" />
                  <path d="M5 12h14" />
                  <path d="M5 17h14" />
                </svg>
              </button>
              <strong className="page-title">{pageTitle}</strong>
            </div>
          <div className="top-nav-right">
            <span className="top-nav-divider">|</span>
            <span className="top-nav-user-name">{loggedInFullName}</span>
          </div>

        </header>

        <section
          className={`main-content-scrollable ${
            activePage === 'Flocks' || activePage === 'Cases' || activePage === 'Predict Disease' || activePage === 'Reports' || activePage === 'Settings'
              ? 'page-flocks'
              : ''
          }`}
        >
          {activePage === 'Dashboard' ? (
              <div className="dashboard-overview">
                <section className="dashboard-hero">
                  <div className="hero-card">
                    <p className="section-kicker">Live command center</p>
                    <h1 className="dashboard-title">Poultry Disease Dashboard</h1>
                    <p className="dashboard-desc">
                      Monitor flock health, surface risky disease patterns, and run droppings-based screening from one responsive workspace.
                    </p>
                    <div className="hero-tags">
                      {(dashboardData?.hero_tags ?? []).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="hero-side-card">
                    <div className="mini-stat">
                      <span>Suspected Cases</span>
                      <strong>{dashboardData?.hero_side.suspected_cases ?? '0 active cases'}</strong>
                    </div>
                    <div className="mini-stat">
                      <span>Detection Model</span>
                      <strong className="model-status-indicator">
                        <span className={`model-status-dot ${modelReady ? 'online' : 'offline'}`} aria-hidden="true" />
                        {dashboardData?.hero_side.detection_model ?? (modelReady ? 'Ready' : 'Offline')}
                      </strong>
                    </div>
                    <button type="button" className="ghost-btn" onClick={() => checkStatus()}>
                      Refresh status
                    </button>
                  </div>
                </section>

                <section className="dashboard-cards metric-strip">
                  {(dashboardData?.overview_cards ?? overviewCards).map((card) => (
                    <article key={card.label} className="dashboard-card">
                      <div className={`dashboard-card-icon ${card.icon}`}>{renderDashboardCardIcon(card.icon)}</div>
                      <div className="dashboard-card-label">{card.label}</div>
                      <div className="dashboard-card-value">{card.value}</div>
                      <div className={`dashboard-card-change ${card.trend}`}>{card.change}</div>
                    </article>
                  ))}
                </section>

                <section className="dashboard-mosaic">
                  <section className="chart-card chart-primary">
                    <div className="card-head">
                      <div>
                        <div className="chart-title">Weekly Flock Screening Volume</div>
                        <p className="card-subtitle">Daily droppings sample submissions and screening activity across monitored poultry farms.</p>
                      </div>
                      <span className="chip">This week</span>
                    </div>
                    <div className={`chart-placeholder ${isDashboardLoading ? 'chart-placeholder-loading' : ''}`}>
                      <div className="chart-axis-label chart-axis-label-y">Samples</div>
                      <div className={`chart-bars ${isDashboardLoading ? 'chart-bars-loading' : ''}`}>
                        {weeklyScreeningData.map((value, index, array) => {
                          const maxValue = Math.max(...array, 1)
                          const height = `${Math.max((value / maxValue) * 100, 12)}%`
                          return <div key={`${index}-${value}`} className={`bar ${index % 2 === 1 ? 'alt' : ''}`} style={{ height }} />
                        })}
                      </div>
                      <div className="chart-axis-x">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <div className="side-stack">
                    <section className="chart-card">
                      <div className="chart-title">Field Summary</div>
                      <div className="quick-stats">
                        {(dashboardData?.quick_stats ?? quickStats).map((stat) => (
                          <div key={stat.label} className="quick-stat">
                            <span className="quick-stat-value">{stat.value}</span>
                            <span className="quick-stat-label">{stat.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="chart-card">
                      <div className="chart-title">Batch Health Levels</div>
                      <div className="risk-list">
                        {(dashboardData?.risk_levels ?? riskLevels).map((item) => (
                          <div key={item.label}>
                            <div className="risk-row">
                              <span>{item.label}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="risk-meter">
                              <div className="risk-fill" style={{ width: item.width }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </section>

                <section className="dashboard-bottom">
                  <section className="chart-card">
                    <div className="card-head">
                      <div>
                        <div className="chart-title">Predictions vs Confirmed Alerts</div>
                        <p className="card-subtitle">Comparing model detections against disease alerts raised by flock monitoring teams.</p>
                      </div>
                      <span className="chip neutral">Trend view</span>
                    </div>
                    <div className={`chart-placeholder ${isDashboardLoading ? 'chart-placeholder-loading' : ''}`}>
                      <div className="chart-axis-label chart-axis-label-y">Alerts</div>
                      <svg className={`line-chart ${isDashboardLoading ? 'line-chart-loading' : ''}`} viewBox="0 0 600 240" preserveAspectRatio="none">
                        <polyline
                          fill="none"
                          stroke="#0ea5e9"
                          strokeWidth="4"
                          points={buildPolylinePoints(predictionTrendData)}
                        />
                        <polyline
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="4"
                          points={buildPolylinePoints(alertTrendData, 220, 90)}
                        />
                      </svg>
                      <div className="chart-axis-x chart-axis-x-eight">
                        {['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'].map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="chart-card">
                    <div className="card-head">
                      <div>
                        <div className="chart-title">Case Management Snapshot</div>
                        <p className="card-subtitle">Current flow of disease investigations, treatment follow-ups, and flock review actions.</p>
                      </div>
                    </div>
                      <div className="operations-grid">
                        <div className="risk-list">
                        {(dashboardData?.workflow_rows ?? workflowRows).map((item) => (
                          <div key={item.label} className="risk-row">
                            <span>{item.label}</span>
                            <span>{item.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="insight-list">
                        {(dashboardData?.insight_rows ?? insightRows).map((item) => (
                          <article key={item.title} className="insight-item">
                            <strong>{item.title}</strong>
                            <span>{item.meta}</span>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                </section>
            </div>
          ) : activePage === 'Flocks' ? (
            <FlocksPage />
          ) : activePage === 'Cases' ? (
            <CasesPage />
          ) : activePage === 'Predict Disease' ? (
            <section className="page-layout">
              {results.length === 0 && (
                <div className="page-header">
                  <div>
                    <h1 className="dashboard-title">Predict Disease</h1>
                  </div>
                </div>
              )}

              <PredictionWorkspace
                selectedImages={selectedImages}
                loading={loading}
                error={error}
                results={results}
                uploadingImages={uploadingImages}
                uploadProgress={uploadProgress}
                modelReady={modelReady}
                mode="page"
                selectedFlock={selectedPredictionFlock}
                flockOptions={predictionFlockOptions}
                onFileChange={handleFileChange}
                onAppendImages={appendImages}
                onFlockChange={setSelectedPredictionFlock}
                onClearImages={() => {
                  setSelectedImages((current) => {
                    current.forEach((image) => URL.revokeObjectURL(image.preview))
                    return []
                  })
                  setResults([])
                  setError(null)
                }}
                onRemoveImage={(imageToRemove) => {
                  setSelectedImages((current) => {
                    const nextImages = current.filter(
                      (image) =>
                        !(
                          image.file.name === imageToRemove.file.name &&
                          image.file.lastModified === imageToRemove.file.lastModified &&
                          image.file.size === imageToRemove.file.size
                        ),
                    )

                    if (nextImages.length !== current.length) {
                      URL.revokeObjectURL(imageToRemove.preview)
                    }

                    return nextImages
                  })
                  setResults((current) => current.filter((item) => item.preview !== imageToRemove.preview))
                }}
                onSubmit={handleSubmit}
                onResetResult={handleResetPrediction}
                onRefreshStatus={() => checkStatus()}
              />
            </section>
          ) : activePage === 'Modelling' ? (
            <ModellingPage />
          ) : activePage === 'Reports' ? (
            <ReportsPage />
          ) : activePage === 'Settings' ? (
            <SettingsPage />
          ) : (
            <section className="page-layout">
              <div className="page-header">
                <div>
                  <p className="section-kicker">Coming next</p>
                  <h1 className="dashboard-title">{activePage}</h1>
                  <p className="dashboard-desc">
                    This section is ready for the next round of page design. We can build it in the same shell next.
                  </p>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

function PredictionWorkspace({
  selectedImages,
  loading,
  error,
  results,
  uploadingImages,
  uploadProgress,
  modelReady,
  mode,
  selectedFlock,
  flockOptions,
  onFileChange,
  onAppendImages,
  onFlockChange,
  onClearImages,
  onRemoveImage,
  onSubmit,
  onResetResult,
  onRefreshStatus,
}: {
  selectedImages: SelectedUpload[]
  loading: boolean
  error: string | null
  results: PredictionResultItem[]
  uploadingImages: boolean
  uploadProgress: number
  modelReady: boolean | null
  mode: 'dashboard' | 'page'
  selectedFlock: string
  flockOptions: string[]
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAppendImages: (files: File[]) => void
  onFlockChange: (value: string) => void
  onClearImages: () => void
  onRemoveImage: (image: SelectedUpload) => void
  onSubmit: (e: React.FormEvent) => void
  onResetResult: () => void
  onRefreshStatus: () => void
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const isStandalone = mode === 'page'
  const hasStandaloneResult = isStandalone && results.length > 0
  const latestResult = results[0]?.prediction ?? null
  const diseaseSummary = summarizeDetectedDiseases(results)
  const dominantDisease = diseaseSummary[0]
  const averageConfidence = results.length
    ? Math.round(results.reduce((total, item) => total + item.prediction.confidence, 0) / results.length)
    : 0
  const reportRows = buildReportRows(results, selectedFlock)
  const predictionBlockers = [
    !selectedImages.length ? 'Upload at least one droppings image or video.' : null,
    !selectedFlock ? 'Select the batch for these samples.' : null,
    modelReady === false ? 'Choose an active trained model in Modelling configurations.' : null,
  ].filter((item): item is string => Boolean(item))
  const predictionBlockerNotice =
    predictionBlockers.length > 0 && !loading
      ? `Prediction is unavailable: ${predictionBlockers.join(' ')}`
      : null
  const [activePreview, setActivePreview] = useState<string | null>(null)
  const [imagePendingDelete, setImagePendingDelete] = useState<SelectedUpload | null>(null)
  const [toast, setToast] = useState<PredictToast | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [captureNote, setCaptureNote] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (!cameraOpen) return

    let cancelled = false

    const startCamera = async () => {
      setCameraError(null)
      setCaptureNote(null)
      setCameraReady(false)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setCameraStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
      } catch {
        setCameraError('Camera access failed. Allow camera permission or use file upload instead.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
    }
  }, [cameraOpen])

  useEffect(() => {
    if (!videoRef.current || !cameraStream) return

    videoRef.current.srcObject = cameraStream
    videoRef.current.play().catch(() => undefined)
  }, [cameraStream])

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraReady(false)
    setCameraOpen(false)
    setCaptureNote(null)
  }

  const handleCapture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')

    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      setCameraError('Could not capture the image. Please try again.')
      return
    }

    const file = new File([blob], `droppings-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onAppendImages([file])
    setCaptureNote('Picture added. You can take another one or close the camera.')
  }

  const handleDeleteImage = () => {
    if (!imagePendingDelete) return

    onRemoveImage(imagePendingDelete)
    if (activePreview === imagePendingDelete.preview) {
      setActivePreview(null)
    }
    setImagePendingDelete(null)
    setToast({ text: 'File removed from the batch.', tone: 'success' })
  }

  const handleDownloadResult = async () => {
    if (!results.length) return

    try {
      const response = await fetch(`${API_BASE}/report-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: reportRows }),
      })

      if (!response.ok) {
        setToast({ text: 'Could not generate the Excel report.', tone: 'error' })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'Broiler_Disease_Report.xlsx'
      link.click()
      URL.revokeObjectURL(url)
      setToast({ text: 'Excel report downloaded.', tone: 'success' })
    } catch {
      setToast({ text: 'Could not reach the server for report download.', tone: 'error' })
    }
  }

  if (hasStandaloneResult) {
    return (
      <section className="upload-layout predict-page-layout">
        <div className="page-header predict-page-topbar">
          <div>
            <h1 className="dashboard-title">Results Page</h1>
          </div>
          <div className="predict-page-actions-row">
            <button type="button" className="settings-btn predict-back-to-uploads-btn" onClick={onResetResult}>
              <ButtonIcon name="back" />
              Back to uploads
            </button>
            <button type="button" className="primary-btn predict-download-btn" onClick={handleDownloadResult}>
              <ButtonIcon name="download" />
              Download result
            </button>
          </div>
        </div>

        <section className="chart-card predict-result-page">
          <div className="predict-result-grid">
            <article className="prediction-panel prediction-panel-standalone prediction-results-list">
              {results.map((item) => (
                <section key={item.fileName} className="predict-result-item">
                  {item.kind === 'video' ? (
                    <video src={item.preview} className="predict-result-thumb" controls muted playsInline />
                  ) : (
                    <img src={item.preview} alt={item.fileName} className="predict-result-thumb" />
                  )}
                  <div className="predict-result-content">
                    <div className="prediction-summary">
                      <strong>{item.prediction.disease}</strong>
                      <span>
                        {item.prediction.confidence}% confidence
                        {item.kind === 'video' ? ' from video frames' : ''}
                      </span>
                    </div>
                    <div className="predict-result-file">{item.fileName}</div>
                    {item.prediction.message && <p className="prediction-message">{item.prediction.message}</p>}
                    <div className="probability-list">
                      {Object.entries(item.prediction.probabilities).map(([label, value]) => (
                        <div key={`${item.fileName}-${label}`} className="probability-row">
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
              ))}
            </article>

            <article className="chart-card predict-result-summary-card">
              <div className="chart-title">Broiler Disease Detection Report</div>
              <div className="predict-report-stack">
                <section className="predict-report-block">
                  <div className="predict-report-label">Batch summary</div>
                  <div className="predict-guidance-list">
                    <span>Flock / batch: {selectedFlock || 'Not specified'}.</span>
                    <span>{results.length} sample{results.length > 1 ? 's' : ''} screened in this batch.</span>
                    <span>Average model confidence: {averageConfidence}%.</span>
                    <span>
                      Most frequent detection: {dominantDisease ? `${dominantDisease.disease} (${dominantDisease.count})` : 'No dominant class yet'}.
                    </span>
                  </div>
                </section>

                <section className="predict-report-block">
                  <div className="predict-report-label">Detailed report</div>
                  <div className="predict-disease-summary-list">
                    {reportRows.map((row) => (
                      <article key={row.caseId} className="predict-disease-summary-item">
                        <div className="predict-report-item-head">
                          <strong>{row.disease}</strong>
                          <span>{row.confidence}% confidence</span>
                        </div>
                        <span>Case ID: {row.caseId}</span>
                        <span>Flock: {row.flock}</span>
                        <span>Date: {row.date}</span>
                        <span>Status: {row.status}</span>
                        <span>Recommendation: {row.recommendation}</span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </article>
          </div>
        </section>
      </section>
    )
  }

  return (
    <section className={`upload-layout ${isStandalone ? 'predict-page-layout' : ''}`}>
      {toast && (
        <div className="toast-stack predict-toast-stack">
          <div className={`toast-notice ${toast.tone === 'success' ? 'toast-success' : 'toast-error'}`}>
            <span>{toast.text}</span>
            <button type="button" className="toast-close" onClick={() => setToast(null)}>
              X
            </button>
          </div>
        </div>
      )}
      <section className="chart-card upload-feature">
        <div className="card-head">
          <div>
            {isStandalone ? (
              <>
                <div className="chart-title">Prediction Workspace</div>
                <p className="card-subtitle">Upload droppings images or videos and run prediction.</p>
              </>
            ) : null}
          </div>
          <span className={`chip ${modelReady ? '' : 'neutral'}`}>{modelReady ? 'AI screening' : 'Model offline'}</span>
        </div>

        <div className="upload-feature-grid">
          <form onSubmit={onSubmit} className="predict-form">
            <div className="predict-context-row">
              <label className="predict-context-field">
                <span>Batch / flock</span>
                <select value={selectedFlock} onChange={(e) => onFlockChange(e.target.value)}>
                  <option value="">Select flock or batch</option>
                  {flockOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="upload-dropzone">
              <input
                ref={uploadInputRef}
                className="visually-hidden-input"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={onFileChange}
              />
              <div className="upload-placeholder">
                <strong>{isStandalone ? 'Upload droppings images or short videos, or take fresh pictures' : 'Upload or capture droppings samples'}</strong>
                <span>
                  {selectedImages.length
                    ? `${selectedImages.length} file${selectedImages.length > 1 ? 's' : ''} added to this batch.`
                    : 'PNG, JPG, JPEG, MP4, MOV, and AVI are supported. You can choose multiple sample files in one batch.'}
                </span>
                <div className="upload-option-row">
                  <button
                    type="button"
                    className="upload-option-pill upload-option-pill-upload"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={uploadingImages}
                  >
                    <UploadActionIcon name="upload" />
                    {uploadingImages ? `Uploading ${uploadProgress}%` : 'Upload files'}
                  </button>
                  <button
                    type="button"
                    className="upload-option-pill upload-option-pill-camera"
                    onClick={() => setCameraOpen(true)}
                  >
                    <UploadActionIcon name="camera" />
                    Use camera
                  </button>
                </div>
              </div>
            </div>

              <div className="predict-actions">
                <button type="submit" className="primary-btn" disabled={!selectedImages.length || loading || !modelReady}>
                  {loading ? 'Analyzing...' : `Run prediction${selectedImages.length > 1 ? 's' : ''}`}
                </button>
                <button type="button" className="ghost-btn" onClick={onRefreshStatus}>
                  Refresh status
                </button>
                <button type="button" className="ghost-btn predict-clear-btn" onClick={onClearImages} disabled={!selectedImages.length || loading}>
                  Clear uploads
                </button>
              </div>

            {predictionBlockerNotice && <p className="predict-notice">{predictionBlockerNotice}</p>}
            {error && <p className="inline-error">{error}</p>}

            {isStandalone && (
              <div className="predict-instructions-card">
                <div className="predict-guidance-title">Instructions</div>
                <div className="predict-guidance-list">
                  <span>Take clear photos or short videos of each chicken droppings sample.</span>
                  <span>Keep the sample centered so extracted video frames stay useful for the model.</span>
                  <span>Avoid blur, heavy shadows, and background clutter.</span>
                </div>
              </div>
            )}
          </form>

          <div className={`prediction-panel ${isStandalone ? 'prediction-panel-standalone' : ''}`}>
            <div className="prediction-summary">
              <strong>{latestResult ? latestResult.disease : 'Preview files'}</strong>
              <span>
                {latestResult
                  ? `${latestResult.confidence}% confidence${results[0]?.kind === 'video' ? ' from video frames' : ''}`
                  : selectedImages.length
                    ? `${selectedImages.length} file${selectedImages.length > 1 ? 's' : ''} selected`
                    : 'No file analyzed yet'}
              </span>
            </div>
            {latestResult?.message ? (
              <p className="prediction-message">{latestResult.message}</p>
            ) : (
              isStandalone && <p className="prediction-message">Review the uploaded droppings images or videos here before running prediction.</p>
            )}
            {!latestResult && selectedImages.length > 0 && (
              <div className="prediction-preview-strip">
                {selectedImages.map((image) => (
                  <div key={`${image.file.name}-${image.file.lastModified}`} className="prediction-preview-card">
                    <button
                      type="button"
                      className="prediction-preview-button"
                      onClick={() => setActivePreview(image.preview)}
                      aria-label={`Preview ${image.file.name}`}
                    >
                      {image.kind === 'video' ? (
                        <video src={image.preview} className="prediction-preview-thumb" muted playsInline />
                      ) : (
                        <img src={image.preview} alt={image.file.name} className="prediction-preview-thumb" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="prediction-preview-delete"
                      onClick={() => setImagePendingDelete(image)}
                      aria-label={`Delete ${image.file.name}`}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="probability-list">
              {(latestResult ? Object.entries(latestResult.probabilities) : []).map(([label, value]) => (
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
        </div>
      </section>

      {cameraOpen && (
        <div className="modal-backdrop" onClick={stopCamera}>
          <section className="modal-card modal-card-small camera-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-body camera-modal-body">
              <div className="camera-modal-topbar">
                <button type="button" className="modal-close camera-close-btn" onClick={stopCamera}>
                  X
                </button>
              </div>
              <div className="camera-frame">
                {cameraError ? (
                  <div className="camera-empty-state">{cameraError}</div>
                ) : (
                  <video
                    ref={videoRef}
                    className={`camera-video ${cameraReady ? 'is-ready' : ''}`}
                    muted
                    playsInline
                    onLoadedMetadata={() => setCameraReady(true)}
                  />
                )}
              </div>
              <div className="camera-capture-bar">
                <button
                  type="button"
                  className="camera-capture-btn"
                  onClick={handleCapture}
                  disabled={!cameraReady || Boolean(cameraError)}
                  aria-label="Capture picture"
                />
              </div>
              {captureNote && <p className="camera-note">{captureNote}</p>}
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-btn modal-btn" onClick={stopCamera}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {activePreview && (
        <div className="modal-backdrop" onClick={() => setActivePreview(null)}>
          <section className="modal-card modal-card-small image-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close image-preview-close" onClick={() => setActivePreview(null)}>
              X
            </button>
            <div className="image-preview-body">
              {selectedImages.find((item) => item.preview === activePreview)?.kind === 'video' ? (
                <video src={activePreview} className="image-preview-full" controls autoPlay playsInline />
              ) : (
                <img src={activePreview} alt="Selected preview" className="image-preview-full" />
              )}
            </div>
          </section>
        </div>
      )}

      {imagePendingDelete && (
        <div className="modal-backdrop" onClick={() => setImagePendingDelete(null)}>
          <section className="modal-card modal-card-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Delete file</h2>
                <p>This will remove the selected sample from the prediction batch.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setImagePendingDelete(null)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-copy">{imagePendingDelete.file.name}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-btn modal-btn" onClick={() => setImagePendingDelete(null)}>
                Cancel
              </button>
              <button type="button" className="primary-btn modal-btn danger-solid-btn" onClick={handleDeleteImage}>
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function UploadActionIcon({ name }: { name: 'upload' | 'camera' }) {
  const paths: Record<typeof name, string> = {
    upload: 'M12 3v10M8 9l4 4 4-4M5 17v2h14v-2',
    camera: 'M4 8h3l2-2h6l2 2h3v10H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17.5 10.5h.01',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function LoginScreen({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: {
  username: string
  password: string
  error: string
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}) {
  return (
    <main className="login-shell">
      <section className="login-showcase" />

      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img className="login-brand-logo" src={loginLogoImage} alt="Broiler disease system logo" />
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            <p className="login-welcome">Welcome back, good to see you again!</p>

            <label className="login-field">
              <span>Username</span>
              <input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="Enter your username" />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            {error ? <p className="login-error">{error}</p> : null}

            <button type="submit" className="login-submit-btn">
              Log In
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12M10 11v5M14 11v5" />
    </svg>
  )
}

function ButtonIcon({ name }: { name: 'back' | 'download' }) {
  const paths: Record<'back' | 'download', string> = {
    back: 'M15 6l-6 6 6 6M9 12h10',
    download: 'M12 4v10M8 10l4 4 4-4M5 18h14',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function summarizeDetectedDiseases(results: PredictionResultItem[]): DiseaseSummary[] {
  const summaryMap = new Map<string, DiseaseSummary>()

  results.forEach((item) => {
    const current = summaryMap.get(item.prediction.disease)
    if (current) {
      current.count += 1
      current.highestConfidence = Math.max(current.highestConfidence, item.prediction.confidence)
      return
    }

    summaryMap.set(item.prediction.disease, {
      disease: item.prediction.disease,
      count: 1,
      highestConfidence: item.prediction.confidence,
    })
  })

  return Array.from(summaryMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.highestConfidence - a.highestConfidence
  })
}

function buildReportRows(results: PredictionResultItem[], flock: string): ReportRow[] {
  const today = new Date().toISOString().slice(0, 10)

  return results.map((item, index) => {
    const disease = formatDiseaseName(item.prediction.disease)
    const confidence = Math.round(item.prediction.confidence)
    return {
      caseId: `C${String(index + 1).padStart(3, '0')}`,
      flock: flock || 'Unassigned flock',
      date: today,
      disease,
      confidence,
      status: getReportStatus(item.prediction.disease, confidence),
      recommendation: getReportRecommendation(item.prediction.disease, confidence),
    }
  })
}

function formatDiseaseName(disease: string) {
  const map: Record<string, string> = {
    cocci: 'Coccidiosis',
    healthy: 'Healthy',
    ncd: 'Newcastle Disease',
    salmo: 'Salmonella',
  }

  return map[disease.toLowerCase()] ?? disease
}

function buildPolylinePoints(values: number[], baseline = 210, peak = 55) {
  const maxValue = Math.max(...values, 1)
  const step = values.length > 1 ? 560 / (values.length - 1) : 0

  return values
    .map((value, index) => {
      const x = 20 + step * index
      const y = baseline - ((baseline - peak) * value) / maxValue
      return `${Math.round(x)},${Math.round(y)}`
    })
    .join(' ')
}

function getReportStatus(disease: string, confidence: number) {
  const key = disease.toLowerCase()
  if (key === 'healthy') return 'Healthy'
  if (confidence >= 85) return 'High Risk'
  if (confidence >= 70) return 'Medium Risk'
  return 'Low Risk'
}

function getReportRecommendation(disease: string, confidence: number) {
  const key = disease.toLowerCase()

  if (key === 'healthy') {
    return confidence >= 85 ? 'Continue normal care' : 'No action required'
  }

  if (key === 'cocci') {
    return confidence >= 85 ? 'Start treatment immediately' : 'Monitor flock and confirm with vet review'
  }

  if (key === 'salmo') {
    return 'Monitor and isolate birds'
  }

  if (key === 'ncd') {
    return confidence >= 85 ? 'Emergency intervention' : 'Isolate flock and arrange urgent review'
  }

  return 'Review and confirm the result with field assessment'
}

function renderDashboardCardIcon(name: string) {
  if (name === 'scan') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14v12H5zM8 10l2.2 2.2 2.4-3.2L17 15H7z" />
        <circle cx="9" cy="9" r="1.2" />
      </svg>
    )
  }

  if (name === 'ai') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-6-3.8-6-9a3.5 3.5 0 0 1 6-2.2A3.5 3.5 0 0 1 18 11c0 5.2-6 9-6 9Z" />
      </svg>
    )
  }

  const glyphs: Record<string, string> = {
    alert: '!',
    case: '#',
  }

  return glyphs[name] ?? '*'
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    grid: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
    barn: 'M4 10 12 4l8 6v10h-5v-5H9v5H4z',
    chicken: 'M7.8 13.6c0-3.1 2.2-5.3 5.3-5.3 1.2 0 2.4.3 3.4 1l1.4-.8-.4 1.5 1 1-1.4.4c.2.5.3 1 .3 1.6 0 2.8-2.2 4.9-5.2 4.9h-2l-1.2 2.1-.7-2.1H7.8c-1 0-1.8-.8-1.8-1.8 0-.9.7-1.6 1.6-1.8Zm6-7.1.8-1.5 1 1.1 1.2-.6v1.3l1.4.1-.9 1.2m-5.6 1.4c.5-.8 1.3-1.2 2.3-1.2.7 0 1.4.2 2 .7l-1 .6-.4 1-.8-.5-.8.4Z',
    alert: 'M12 3 2 21h20L12 3zm0 6v5m0 4h.01',
    pulse: 'M3 12h4l2-4 4 8 2-4h6',
    model: 'M4 7h16M4 12h16M4 17h10',
    report: 'M6 3h9l3 3v15H6zM9 12h6M9 16h6M9 8h3',
    gear: 'M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8 3-1.7-.3a6.8 6.8 0 0 0-.7-1.6l1-1.4-1.9-1.9-1.4 1a6.8 6.8 0 0 0-1.6-.7L12.5 4h-1l-.3 1.7a6.8 6.8 0 0 0-1.6.7l-1.4-1-1.9 1.9 1 1.4a6.8 6.8 0 0 0-.7 1.6L4 11.5v1l1.7.3a6.8 6.8 0 0 0 .7 1.6l-1 1.4 1.9 1.9 1.4-1a6.8 6.8 0 0 0 1.6.7l.3 1.7h1l.3-1.7a6.8 6.8 0 0 0 1.6-.7l1.4 1 1.9-1.9-1-1.4a6.8 6.8 0 0 0 .7-1.6l1.7-.3z',
    logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function Logo() {
  return (
    <svg className="brand-logo" data-logo="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 272.02000427246094 42.5537109375" aria-hidden="true">
      <g id="logogram" transform="translate(0, 0.77685546875) rotate(0 45 20.5)">
        <path d="M39.1077 32.8531C36.2133 38.0618 30.3201 40.54 24.3612 40.54H0.452637C25.3415 37.4289 42.6749 24.9844 44.8971 7.65109C47.1193 24.9844 64.4526 37.4289 89.3415 40.54H65.433C59.4741 40.54 53.5808 38.0618 50.6864 32.8531C47.5536 27.2155 45.5577 20.8363 44.8971 13.8733C44.2365 20.8363 42.2405 27.2155 39.1077 32.8531Z" fill="#FFFFFF" />
        <path d="M25.4349 31.0122C24.0388 31.7983 22.5701 32.5366 21.0324 33.2243C20.1589 30.2069 19.8374 27.0411 20.0938 23.8875C20.4329 19.7155 21.7727 15.6934 23.9946 12.1776C26.2165 8.66176 29.2518 5.76059 32.8317 3.73116C36.4116 1.70174 40.4257 0.606653 44.5182 0.542929C48.6108 0.479195 52.6555 1.44879 56.2941 3.36581C59.9328 5.28282 63.0531 8.08807 65.3785 11.5331C67.704 14.9782 69.1629 18.9567 69.6261 23.1162C70.0049 26.5184 69.708 29.9559 68.7618 33.2243C67.224 32.5366 65.7554 31.7982 64.3592 31.0122C64.9478 28.6226 65.1128 26.1368 64.8386 23.6738C64.4651 20.3196 63.2885 17.1114 61.4133 14.3333C59.5381 11.5553 57.0219 9.29305 54.0877 7.74718C51.1534 6.20128 47.8917 5.41942 44.5916 5.4708C41.2913 5.52219 38.0544 6.40527 35.1677 8.04176C32.2808 9.67829 29.8331 12.0178 28.0413 14.853C26.2496 17.6882 25.1692 20.9315 24.8957 24.2959C24.7119 26.5572 24.8965 28.8264 25.4349 31.0122Z" fill="#0074E0" />
      </g>
      <g id="logotype" transform="translate(96, 0.5)">
        <path fill="#ffffff" d="M24.51 34L8.31 34L8.31 8.54L13.52 8.54L13.52 29.68L24.51 29.68L24.51 34ZM34.25 34.38L34.25 34.38Q31.38 34.38 29.27 33.14Q27.17 31.90 26.04 29.68Q24.90 27.47 24.90 24.53L24.90 24.53Q24.90 21.56 26.04 19.35Q27.17 17.13 29.27 15.89Q31.38 14.65 34.25 14.65L34.25 14.65Q37.14 14.65 39.23 15.89Q41.32 17.13 42.46 19.35Q43.60 21.56 43.60 24.53L43.60 24.53Q43.60 27.47 42.46 29.68Q41.32 31.90 39.23 33.14Q37.14 34.38 34.25 34.38ZM34.25 30.34L34.25 30.34Q35.61 30.34 36.54 29.58Q37.46 28.82 37.92 27.50Q38.38 26.17 38.38 24.52L38.38 24.52Q38.38 22.82 37.92 21.51Q37.46 20.19 36.54 19.44Q35.61 18.69 34.25 18.69L34.25 18.69Q32.88 18.69 31.97 19.44Q31.05 20.19 30.59 21.51Q30.13 22.82 30.13 24.52L30.13 24.52Q30.13 26.17 30.59 27.50Q31.05 28.82 31.97 29.58Q32.88 30.34 34.25 30.34ZM53.37 41.55L53.37 41.55Q50.99 41.55 49.22 40.95Q47.44 40.34 46.33 39.28Q45.22 38.22 44.79 36.87L44.79 36.87L49.20 35.64Q49.44 36.17 49.94 36.67Q50.45 37.18 51.28 37.50Q52.12 37.83 53.35 37.83L53.35 37.83Q55.32 37.83 56.44 36.93Q57.56 36.03 57.56 34.14L57.56 34.14L57.56 30.62L57.16 30.62Q56.82 31.39 56.17 32.10Q55.52 32.82 54.47 33.27Q53.42 33.73 51.87 33.73L51.87 33.73Q49.71 33.73 47.95 32.72Q46.19 31.71 45.14 29.64Q44.09 27.57 44.09 24.41L44.09 24.41Q44.09 21.18 45.16 19.01Q46.23 16.84 47.99 15.75Q49.76 14.65 51.88 14.65L51.88 14.65Q53.49 14.65 54.58 15.19Q55.68 15.73 56.35 16.54Q57.03 17.35 57.37 18.11L57.37 18.11L57.59 18.11L57.59 14.89L62.63 14.89L62.63 33.85Q62.63 36.43 61.44 38.14Q60.26 39.86 58.17 40.71Q56.09 41.55 53.37 41.55ZM53.47 29.83L53.47 29.83Q54.79 29.83 55.70 29.18Q56.62 28.53 57.09 27.31Q57.57 26.09 57.57 24.38L57.57 24.38Q57.57 22.69 57.09 21.42Q56.62 20.16 55.70 19.46Q54.79 18.76 53.47 18.76L53.47 18.76Q52.12 18.76 51.21 19.48Q50.29 20.21 49.82 21.47Q49.35 22.74 49.35 24.38L49.35 24.38Q49.35 26.05 49.82 27.28Q50.29 28.50 51.22 29.16Q52.14 29.83 53.47 29.83ZM73.28 34.38L73.28 34.38Q70.41 34.38 68.30 33.14Q66.20 31.90 65.06 29.68Q63.93 27.47 63.93 24.53L63.93 24.53Q63.93 21.56 65.06 19.35Q66.20 17.13 68.30 15.89Q70.41 14.65 73.28 14.65L73.28 14.65Q76.16 14.65 78.26 15.89Q80.35 17.13 81.49 19.35Q82.62 21.56 82.62 24.53L82.62 24.53Q82.62 27.47 81.49 29.68Q80.35 31.90 78.26 33.14Q76.16 34.38 73.28 34.38ZM73.28 30.34L73.28 30.34Q74.64 30.34 75.57 29.58Q76.49 28.82 76.95 27.50Q77.41 26.17 77.41 24.52L77.41 24.52Q77.41 22.82 76.95 21.51Q76.49 20.19 75.57 19.44Q74.64 18.69 73.28 18.69L73.28 18.69Q71.91 18.69 71.00 19.44Q70.08 20.19 69.62 21.51Q69.16 22.82 69.16 24.52L69.16 24.52Q69.16 26.17 69.62 27.50Q70.08 28.82 71.00 29.58Q71.91 30.34 73.28 30.34ZM89.05 34L83.92 34L83.92 14.89L89.05 14.89L89.05 34ZM86.48 12.40L86.48 12.40Q85.32 12.40 84.50 11.63Q83.68 10.86 83.68 9.77L83.68 9.77Q83.68 8.67 84.50 7.90Q85.32 7.13 86.48 7.13L86.48 7.13Q87.65 7.13 88.48 7.90Q89.30 8.66 89.30 9.77L89.30 9.77Q89.30 10.86 88.48 11.63Q87.65 12.40 86.48 12.40ZM96.26 41.14L91.13 41.14L91.13 14.89L96.17 14.89L96.17 18.11L96.41 18.11Q96.77 17.35 97.43 16.55Q98.09 15.75 99.16 15.20Q100.24 14.65 101.86 14.65L101.86 14.65Q103.98 14.65 105.74 15.75Q107.50 16.84 108.55 19.03Q109.61 21.22 109.61 24.48L109.61 24.48Q109.61 27.66 108.58 29.86Q107.55 32.05 105.79 33.19Q104.03 34.32 101.83 34.32L101.83 34.32Q100.27 34.32 99.20 33.79Q98.12 33.27 97.45 32.49Q96.77 31.71 96.41 30.94L96.41 30.94L96.26 30.94L96.26 41.14ZM100.26 30.21L100.26 30.21Q101.59 30.21 102.50 29.47Q103.42 28.74 103.89 27.44Q104.36 26.14 104.36 24.46L104.36 24.46Q104.36 22.79 103.89 21.51Q103.42 20.23 102.51 19.49Q101.61 18.76 100.26 18.76L100.26 18.76Q98.94 18.76 98.02 19.47Q97.10 20.17 96.62 21.45Q96.14 22.72 96.14 24.46L96.14 24.46Q96.14 26.19 96.63 27.48Q97.11 28.77 98.04 29.49Q98.96 30.21 100.26 30.21ZM118.51 34.38L118.51 34.38Q116.20 34.38 114.42 33.72Q112.65 33.06 111.52 31.80Q110.39 30.55 110.06 28.77L110.06 28.77L114.83 27.95Q115.21 29.28 116.15 29.95Q117.09 30.62 118.66 30.62L118.66 30.62Q120.11 30.62 120.97 30.06Q121.82 29.51 121.82 28.65L121.82 28.65Q121.82 27.90 121.22 27.42Q120.61 26.94 119.36 26.69L119.36 26.69L116.06 26.00Q113.29 25.44 111.93 24.08Q110.56 22.72 110.56 20.58L110.56 20.58Q110.56 18.74 111.57 17.41Q112.58 16.09 114.37 15.37Q116.17 14.65 118.59 14.65L118.59 14.65Q120.85 14.65 122.51 15.28Q124.16 15.90 125.19 17.05Q126.21 18.19 126.56 19.75L126.56 19.75L122.01 20.55Q121.72 19.58 120.89 18.95Q120.06 18.33 118.66 18.33L118.66 18.33Q117.40 18.33 116.54 18.86Q115.69 19.39 115.69 20.26L115.69 20.26Q115.69 20.99 116.24 21.49Q116.80 21.99 118.15 22.26L118.15 22.26L121.58 22.94Q124.35 23.51 125.70 24.78Q127.05 26.05 127.05 28.10L127.05 28.10Q127.05 29.98 125.96 31.39Q124.86 32.80 122.94 33.59Q121.02 34.38 118.51 34.38ZM134.83 34.24L134.83 34.24Q132.84 34.24 131.36 33.38Q129.87 32.51 129.06 30.90Q128.25 29.28 128.25 27.04L128.25 27.04L128.25 14.89L133.37 14.89L133.37 26.16Q133.37 27.93 134.30 28.94Q135.22 29.95 136.83 29.95L136.83 29.95Q137.92 29.95 138.76 29.48Q139.59 29.01 140.06 28.11Q140.53 27.22 140.53 25.95L140.53 25.95L140.53 14.89L145.66 14.89L145.66 34L140.82 34L140.76 29.23L141.05 29.23Q140.29 31.64 138.75 32.94Q137.20 34.24 134.83 34.24ZM152.89 34L147.76 34L147.76 14.89L152.51 14.89L152.77 19.64L152.39 19.64Q152.84 17.88 153.70 16.77Q154.56 15.66 155.72 15.13Q156.89 14.60 158.17 14.60L158.17 14.60Q160.24 14.60 161.50 15.91Q162.77 17.22 163.36 19.95L163.36 19.95L162.77 19.95Q163.19 18.12 164.16 16.94Q165.12 15.75 166.45 15.18Q167.77 14.60 169.23 14.60L169.23 14.60Q170.99 14.60 172.36 15.37Q173.74 16.14 174.53 17.59Q175.33 19.03 175.33 21.11L175.33 21.11L175.33 34L170.20 34L170.20 22.09Q170.20 20.46 169.32 19.68Q168.44 18.89 167.16 18.89L167.16 18.89Q166.20 18.89 165.49 19.31Q164.78 19.73 164.40 20.48Q164.01 21.23 164.01 22.24L164.01 22.24L164.01 34L159.06 34L159.06 21.95Q159.06 20.55 158.23 19.72Q157.40 18.89 156.08 18.89L156.08 18.89Q155.18 18.89 154.45 19.30Q153.73 19.71 153.31 20.51Q152.89 21.30 152.89 22.45L152.89 22.45L152.89 34Z" />
      </g>
    </svg>
  )
}

export default App
