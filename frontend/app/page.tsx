'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Search, MapPin, AlertTriangle, Shield, ChevronDown,
  Loader2, Activity, Brain, BarChart3, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Zap, Globe, Landmark, Building2,
  Bookmark, Share2, SlidersHorizontal, Clock3, Sparkles, X, Download
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FacilityResult {
  facility_name: string
  state: string
  district: string
  pin_code: string
  why_recommended: string
  trust_score: number
  trust_reason: string
  flags: string[]
  data_quality: 'high' | 'medium' | 'low' | 'suspect'
  contradiction_severity?: 'none' | 'minor' | 'major' | 'critical'
  blended_rank_score?: number
  data_completeness?: number
  capability_matrix?: Record<string, { status: string; evidence_found: string[] }>
}

interface MedicalDesert {
  detected: boolean
  region: string
  gap: string
  affected_pin_codes: string[]
  severity: 'critical' | 'high' | 'moderate'
}

interface ValidatorCheck {
  primary_agent_reliable: boolean
  concerns: string
  confidence: 'high' | 'medium' | 'low'
}

interface AgentResponse {
  query: string
  chain_of_thought: string
  top_results: FacilityResult[]
  medical_desert_alert: MedicalDesert
  validator_check: ValidatorCheck
  summary: string
  candidates_retrieved: number
  agent_consensus?: {
    endorsed: number
    total: number
    agreement_score: number
    needs_human_review: boolean
  }
  intervention_plan?: {
    priority: string
    actions: string[]
    impact_tier: string
  }
  location_context?: {
    input_pin: string
    pin_matched_results: number
  }
}

type SortMode = 'trust_desc' | 'trust_asc' | 'name_asc'

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  'Find the nearest facility in rural Bihar that can perform emergency appendectomy',
  'Which districts in Jharkhand have NO functional dialysis center?',
  'Find hospitals claiming advanced oncology in UP — verify radiation equipment',
  'Emergency: need NICU for premature birth in rural Rajasthan',
  'Find ICU beds near rural Bihar with 24/7 surgical staff',
]

const TRUST_CONFIG = {
  high: { color: '#27ae60', bg: 'rgba(39,174,96,0.15)', label: 'HIGH TRUST', icon: CheckCircle },
  medium: { color: '#f39c12', bg: 'rgba(243,156,18,0.15)', label: 'MEDIUM TRUST', icon: AlertCircle },
  low: { color: '#e74c3c', bg: 'rgba(231,76,60,0.15)', label: 'LOW TRUST', icon: XCircle },
  suspect: { color: '#8e44ad', bg: 'rgba(142,68,173,0.15)', label: 'SUSPICIOUS', icon: AlertTriangle },
}

function getTrustConfig(score: number) {
  if (score >= 80) return TRUST_CONFIG.high
  if (score >= 50) return TRUST_CONFIG.medium
  if (score >= 30) return TRUST_CONFIG.low
  return TRUST_CONFIG.suspect
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrustScoreRing({ score }: { score: number }) {
  const cfg = getTrustConfig(score)
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference

  return (
    <div className="trust-ring flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={cfg.color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 4px ${cfg.color})` }}
        />
        <text x="36" y="36" textAnchor="middle" dominantBaseline="middle"
          fill={cfg.color} fontSize="14" fontWeight="700">{score}</text>
      </svg>
    </div>
  )
}

function FlagBadge({ flag }: { flag: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg"
      style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)' }}>
      <AlertTriangle size={13} style={{ color: '#e74c3c', flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 12, color: '#fc8181', lineHeight: 1.4 }}>{flag}</span>
    </div>
  )
}

function ChainOfThought({ text }: { text: string }) {
  return (
    <details className="mt-2">
      <summary className="flex items-center gap-2 cursor-pointer select-none"
        style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>
        <Brain size={14} />
        Show Chain of Thought
        <ChevronDown size={14} className="chevron" />
      </summary>
      <div className="mt-3 p-4 rounded-xl" style={{
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.15)',
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        fontFamily: 'monospace',
      }}>
        {text}
      </div>
    </details>
  )
}

function DesertAlert({ desert }: { desert: MedicalDesert }) {
  if (!desert.detected) return null

  const severityColor = {
    critical: '#c0392b', high: '#e74c3c', moderate: '#e67e22'
  }[desert.severity] || '#e74c3c'

  return (
    <div className="relative rounded-2xl p-5 mb-4 desert-pulse overflow-hidden"
      style={{
        background: 'rgba(192,57,43,0.12)',
        border: `1px solid rgba(192,57,43,0.4)`,
      }}>
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(192,57,43,0.2)' }}>
          <AlertTriangle size={22} style={{ color: severityColor }} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fc8181' }}>
              ⚠ MEDICAL DESERT DETECTED
            </span>
            <span className="tag-pill" style={{
              background: `rgba(192,57,43,0.25)`, color: severityColor,
              border: `1px solid ${severityColor}40`
            }}>
              {desert.severity.toUpperCase()}
            </span>
          </div>
          <p style={{ color: '#f87171', fontSize: 14, marginBottom: 8 }}>
            <strong>Region:</strong> {desert.region}
          </p>
          <p style={{ color: '#fca5a5', fontSize: 13 }}>
            <strong>Gap:</strong> {desert.gap}
          </p>
          {desert.affected_pin_codes?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {desert.affected_pin_codes.slice(0, 6).map(pin => (
                <span key={pin} className="tag-pill"
                  style={{ background: 'rgba(192,57,43,0.2)', color: '#fca5a5', border: '1px solid rgba(192,57,43,0.3)' }}>
                  PIN {pin}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FacilityCard({
  result,
  index,
  isSaved,
  onToggleSave,
}: {
  result: FacilityResult
  index: number
  isSaved: boolean
  onToggleSave: (facilityName: string) => void
}) {
  const cfg = getTrustConfig(result.trust_score)
  const Icon = cfg.icon

  return (
    <div className="rounded-2xl p-5 mb-3 animate-fade-in"
      style={{
        background: 'rgba(26,34,53,0.9)',
        border: `1px solid rgba(255,255,255,0.08)`,
        transition: 'all 0.2s ease',
        animationDelay: `${index * 0.1}s`,
      }}>
      <div className="flex items-start gap-4">
        <TrustScoreRing score={result.trust_score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              {result.facility_name}
            </span>
            <span className="tag-pill" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              <Icon size={10} />
              {cfg.label}
            </span>
            <button
              onClick={() => onToggleSave(result.facility_name)}
              className="tag-pill"
              style={{
                background: isSaved ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)',
                color: isSaved ? '#fbbf24' : '#9fb4d1',
                border: isSaved ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <Bookmark size={10} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>

          <div className="flex items-center gap-1 mb-3" style={{ color: '#64748b', fontSize: 13 }}>
            <MapPin size={12} />
            <span>{result.district}, {result.state}</span>
            <span className="ml-2 tag-pill" style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>PIN {result.pin_code}</span>
          </div>

          {/* Citation */}
          <div className="p-3 rounded-xl mb-3" style={{
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <p style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 4, fontWeight: 600 }}>
              📌 JUSTIFICATION (exact quote)
            </p>
            <p style={{ fontSize: 13, color: '#bae6fd', fontStyle: 'italic', lineHeight: 1.5 }}>
              &quot;{result.why_recommended}&quot;
            </p>
          </div>

          {/* Trust reason */}
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>
            <span style={{ color: cfg.color, fontWeight: 600 }}>Score reason: </span>
            {result.trust_reason}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {typeof result.blended_rank_score === 'number' && (
              <span className="tag-pill" style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
                Blended rank {result.blended_rank_score}
              </span>
            )}
            {typeof result.data_completeness === 'number' && (
              <span className="tag-pill" style={{ background: 'rgba(52,211,153,0.12)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.3)' }}>
                Data completeness {result.data_completeness}%
              </span>
            )}
            {result.contradiction_severity && result.contradiction_severity !== 'none' && (
              <span className="tag-pill" style={{ background: 'rgba(248,113,113,0.12)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.3)' }}>
                Contradiction {result.contradiction_severity}
              </span>
            )}
          </div>

          {result.capability_matrix && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(result.capability_matrix).map(([cap, info]) => (
                <div key={cap} className="tag-pill" style={{
                  justifyContent: 'space-between',
                  width: '100%',
                  background: info.status === 'present' ? 'rgba(16,185,129,0.12)' : info.status === 'ambiguous' ? 'rgba(245,158,11,0.14)' : 'rgba(239,68,68,0.12)',
                  color: info.status === 'present' ? '#6ee7b7' : info.status === 'ambiguous' ? '#fcd34d' : '#fda4af',
                  border: '1px solid rgba(148,163,184,0.25)',
                }}>
                  <span>{cap.toUpperCase()}</span>
                  <span>{info.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Flags */}
          {result.flags?.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.flags.map((flag, i) => <FlagBadge key={i} flag={flag} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ValidatorPanel({ check }: { check: ValidatorCheck }) {
  const color = check.primary_agent_reliable ? '#27ae60' : '#e74c3c'
  return (
    <div className="rounded-xl p-4 mb-4" style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div className="flex items-center gap-2 mb-2">
        <Shield size={15} style={{ color }} />
        <span style={{ fontSize: 13, fontWeight: 600, color }}>
          Validator Agent — {check.primary_agent_reliable ? 'Endorses Recommendation' : 'Raises Concerns'}
        </span>
        <span className="tag-pill ml-auto" style={{
          background: `${color}20`, color, border: `1px solid ${color}40`
        }}>
          {check.confidence.toUpperCase()} CONFIDENCE
        </span>
      </div>
      {check.concerns && (
        <p style={{ fontSize: 13, color: '#94a3b8' }}>{check.concerns}</p>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)
  const [result, setResult] = useState<AgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'results' | 'map'>('results')
  const [mapSrc, setMapSrc] = useState('/api/map-file')
  const [minTrust, setMinTrust] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>('trust_desc')
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const [savedFacilities, setSavedFacilities] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [queryCount, setQueryCount] = useState(0)
  const [locationPin, setLocationPin] = useState('')
  const [crisisMode, setCrisisMode] = useState('general')
  const [districtReadiness, setDistrictReadiness] = useState<Array<{ district: string; state: string; readiness_score: number }>>([])
  const [simDistrict, setSimDistrict] = useState('')
  const [simCapability, setSimCapability] = useState('icu')
  const [simAdded, setSimAdded] = useState(1)
  const [simResult, setSimResult] = useState<{ baseline_readiness: number; projected_readiness: number; delta: number } | null>(null)

  const loadMap = () => {
    setMapSrc(`/api/map-file?t=${Date.now()}`)
  }

  useEffect(() => {
    loadMap()
  }, [])

  useEffect(() => {
    try {
      const recent = localStorage.getItem('health_recent_queries')
      const saved = localStorage.getItem('health_saved_facilities')
      const seenGuide = localStorage.getItem('health_seen_guide')
      const count = localStorage.getItem('health_query_count')
      if (recent) setRecentQueries(JSON.parse(recent))
      if (saved) setSavedFacilities(JSON.parse(saved))
      if (count) setQueryCount(Number(count))
      if (!seenGuide) setShowOnboarding(true)
    } catch {
      // no-op for localStorage parsing errors
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('health_recent_queries', JSON.stringify(recentQueries))
  }, [recentQueries])

  useEffect(() => {
    localStorage.setItem('health_saved_facilities', JSON.stringify(savedFacilities))
  }, [savedFacilities])

  useEffect(() => {
    localStorage.setItem('health_query_count', String(queryCount))
  }, [queryCount])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === '/') {
        e.preventDefault()
        const el = document.getElementById('main-query-input') as HTMLInputElement | null
        el?.focus()
      }
      if (e.key.toLowerCase() === 'm') setActiveTab('map')
      if (e.key.toLowerCase() === 'r') setActiveTab('results')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const updateRecentQueries = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setRecentQueries(prev => [trimmed, ...prev.filter(x => x !== trimmed)].slice(0, 6))
  }

  const toggleSavedFacility = (facilityName: string) => {
    setSavedFacilities(prev => {
      const exists = prev.includes(facilityName)
      if (exists) {
        setToast('Removed from saved facilities')
        return prev.filter(n => n !== facilityName)
      }
      setToast('Saved to quick shortlist')
      return [facilityName, ...prev].slice(0, 20)
    })
  }

  const generateMap = async () => {
    setMapLoading(true)
    try {
      await fetch('/api/generate-map')
      loadMap()
      setActiveTab('map')
    } catch (e) {
      console.error(e)
    } finally {
      setMapLoading(false)
    }
  }

  const handleQuery = async (q: string = query) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setQuery(q)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top_k: 10, location_pin: locationPin, crisis_mode: crisisMode }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Agent request failed')
      }
      const data = await res.json()
      setResult(data)
      updateRecentQueries(q)
      setQueryCount((n) => n + 1)
      loadMap()
      setActiveTab('results')
      const capability = crisisMode === 'maternal' ? 'nicu' : crisisMode === 'trauma' ? 'trauma' : crisisMode === 'renal' ? 'dialysis' : 'icu'
      const readRes = await fetch(`/api/district-readiness?capability=${capability}&top_n=6`)
      if (readRes.ok) {
        const readData = await readRes.json()
        setDistrictReadiness(readData.districts || [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const displayedResults = useMemo(() => {
    if (!result?.top_results) return []
    const filtered = result.top_results.filter(r => (r.trust_score ?? 0) >= minTrust)
    return filtered.sort((a, b) => {
      if (sortMode === 'trust_asc') return a.trust_score - b.trust_score
      if (sortMode === 'name_asc') return a.facility_name.localeCompare(b.facility_name)
      return b.trust_score - a.trust_score
    })
  }, [result, minTrust, sortMode])

  const shareSummary = async () => {
    if (!result?.summary) return
    const text = `Healthcare Intelligence Query: ${result.query}\n\nSummary:\n${result.summary}`
    try {
      await navigator.clipboard.writeText(text)
      setToast('Summary copied to clipboard')
    } catch {
      setToast('Could not copy summary')
    }
  }

  const exportResults = (format: 'json' | 'csv') => {
    if (!result) return
    const rows = displayedResults.map((r) => ({
      facility_name: r.facility_name,
      district: r.district,
      state: r.state,
      pin_code: r.pin_code,
      trust_score: r.trust_score,
      blended_rank_score: r.blended_rank_score ?? '',
      contradiction_severity: r.contradiction_severity ?? '',
      data_completeness: r.data_completeness ?? '',
      trust_reason: r.trust_reason,
      why_recommended: r.why_recommended,
      flags: (r.flags || []).join(' | '),
    }))

    let blob: Blob
    let filename: string
    if (format === 'json') {
      blob = new Blob([JSON.stringify({
        query: result.query,
        generated_at: new Date().toISOString(),
        rows,
      }, null, 2)], { type: 'application/json' })
      filename = 'healthcare-results.json'
    } else {
      const header = Object.keys(rows[0] || {
        facility_name: '',
        district: '',
        state: '',
        pin_code: '',
        trust_score: '',
        blended_rank_score: '',
        contradiction_severity: '',
        data_completeness: '',
        trust_reason: '',
        why_recommended: '',
        flags: '',
      })
      const csvRows = [header.join(',')].concat(
        rows.map((row) => header.map((h) => {
          const val = String((row as Record<string, unknown>)[h] ?? '')
          return `"${val.replace(/"/g, '""')}"`
        }).join(','))
      )
      blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      filename = 'healthcare-results.csv'
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setToast(`Exported ${format.toUpperCase()} successfully`)
  }

  const copyShareLink = async () => {
    const q = encodeURIComponent(query || result?.query || '')
    const pin = encodeURIComponent(locationPin || '')
    const crisis = encodeURIComponent(crisisMode || 'general')
    const url = `${window.location.origin}?q=${q}&pin=${pin}&crisis=${crisis}`
    try {
      await navigator.clipboard.writeText(url)
      setToast('Share link copied')
    } catch {
      setToast('Unable to copy share link')
    }
  }

  const closeOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('health_seen_guide', '1')
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    const pin = params.get('pin')
    const crisis = params.get('crisis')
    if (pin) setLocationPin(pin)
    if (crisis) setCrisisMode(crisis)
    if (q) {
      setQuery(q)
      handleQuery(q)
    }
    // intentionally run only on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(191,219,254,0.15)' }}>
        <div className="layout-shell flex items-center justify-between"
          style={{ paddingTop: 18, paddingBottom: 18 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(18,103,214,0.18)', border: '1px solid rgba(125,211,252,0.35)' }}>
              <Activity size={22} style={{ color: '#7cc7ff' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Healthcare Intelligence Maps
              </div>
              <div style={{ fontSize: 11, color: '#adbfdb' }}>
                MIT Challenge 03 · Serving A Nation · 1.4 Billion Lives
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="gov-chip"><Landmark size={12} /> Public Impact</span>
            <span className="gov-chip"><Building2 size={12} /> Private Rigor</span>
          </div>
        </div>
        <div className="layout-shell" style={{ paddingBottom: 12 }}>
          <div className="india-stripe" />
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '48px 0 26px', textAlign: 'center' }}>
        <div className="layout-shell" style={{ maxWidth: 980 }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="tag-pill" style={{
              background: 'rgba(59,130,246,0.12)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.3)',
              fontSize: 12
            }}>
              <Zap size={11} /> AGENTIC AI
            </span>
            <span className="tag-pill" style={{
              background: 'rgba(139,92,246,0.12)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.3)',
              fontSize: 12
            }}>
              <Globe size={11} /> 10,000 FACILITIES
            </span>
          </div>

          <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.2, marginBottom: 16 }}>
            <span className="gradient-text">Building Agentic</span>
            <br />Healthcare Maps
          </h1>

          <p style={{ fontSize: 17, color: '#bed0ea', lineHeight: 1.7, marginBottom: 34 }}>
            In India, a postal code determines a lifespan. This AI agent reads{' '}
            <strong style={{ color: '#f1f5f9' }}>10,000 messy hospital records</strong>,
            scores their trustworthiness, finds medical deserts, and answers complex
            natural language queries in seconds.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-left">
            <div className="metric-tile">
              <div className="metric-label">Coverage</div>
              <div className="metric-value">10K+</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Reasoning Mode</div>
              <div className="metric-value" style={{ fontSize: 16, marginTop: 8 }}>Multi-Attribute</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Trust Output</div>
              <div className="metric-value" style={{ fontSize: 16, marginTop: 8 }}>0-100 + CI</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Map Intelligence</div>
              <div className="metric-value" style={{ fontSize: 16, marginTop: 8 }}>Desert Detection</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-left">
            <div className="metric-tile">
              <div className="metric-label">Queries this device</div>
              <div className="metric-value">{queryCount}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Saved facilities</div>
              <div className="metric-value">{savedFacilities.length}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Recent questions</div>
              <div className="metric-value">{recentQueries.length}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Shortcuts</div>
              <div className="metric-value" style={{ fontSize: 14, marginTop: 8 }}>/ search · M map</div>
            </div>
          </div>

          {/* Search */}
          <div className="search-glow rounded-2xl relative"
            style={{ border: '1px solid rgba(125,211,252,0.25)', background: 'rgba(15,39,69,0.9)' }}>
            <div className="flex items-center gap-3 p-4">
              <Search size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <input
                id="main-query-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuery()}
                placeholder="Find the nearest ICU in rural Bihar with 24/7 surgical staff…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#f1f5f9',
                }}
              />
              <button
                onClick={() => handleQuery()}
                disabled={loading || !query.trim()}
                style={{
                  padding: '10px 22px',
                  borderRadius: 12,
                  background: loading ? 'rgba(31,143,255,0.45)' : 'linear-gradient(120deg, #1f8fff, #19b996)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-2 px-4 pb-4">
              <input
                value={locationPin}
                onChange={(e) => setLocationPin(e.target.value)}
                placeholder="Optional PIN context (e.g., 854311)"
                className="smart-select"
              />
              <select value={crisisMode} onChange={(e) => setCrisisMode(e.target.value)} className="smart-select">
                <option value="general">General mode</option>
                <option value="trauma">Emergency trauma</option>
                <option value="maternal">Maternal / neonatal</option>
                <option value="renal">Dialysis / renal</option>
              </select>
              <div className="gov-chip" style={{ justifyContent: 'center' }}>
                Crisis profile: {crisisMode}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap mt-3">
            <button
              onClick={generateMap}
              disabled={mapLoading}
              className="gov-chip"
              style={{ background: 'rgba(10, 43, 79, 0.85)', color: '#d7e8ff', cursor: mapLoading ? 'not-allowed' : 'pointer' }}
            >
              {mapLoading ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
              {mapLoading ? 'Generating map...' : 'Generate latest crisis map'}
            </button>
            <span className="gov-chip" style={{ background: 'rgba(23,178,106,0.16)', color: '#bbf7d0' }}>
              <CheckCircle size={12} /> Auditable citations enabled
            </span>
          </div>

          {recentQueries.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-center gap-2 mb-2" style={{ color: '#9fc2eb', fontSize: 12 }}>
                <Clock3 size={12} /> Recent queries
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {recentQueries.map((rq, i) => (
                  <button
                    key={`${rq}-${i}`}
                    onClick={() => handleQuery(rq)}
                    className="recent-chip"
                  >
                    {rq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Example queries */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {EXAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => handleQuery(q)}
                className="example-chip rounded-xl px-3 py-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  maxWidth: 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Results area */}
      <section className="layout-shell" style={{ maxWidth: 1120, paddingBottom: 80 }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Brain size={24} style={{ color: '#3b82f6' }} className="animate-float" />
              <span style={{ fontSize: 16, color: '#94a3b8' }}>
                Agent is reasoning over 10,000 facility records…
              </span>
            </div>
            <div className="shimmer rounded-xl" style={{ height: 80, marginBottom: 12 }} />
            <div className="shimmer rounded-xl" style={{ height: 80, marginBottom: 12, opacity: 0.7 }} />
            <div className="shimmer rounded-xl" style={{ height: 80, opacity: 0.4 }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-6 mb-6" style={{
            background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)'
          }}>
            <div className="flex items-center gap-3">
              <XCircle size={20} style={{ color: '#e74c3c' }} />
              <div>
                <p style={{ fontWeight: 600, color: '#fc8181' }}>Agent Error</p>
                <p style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>{error}</p>
                {error.includes('ChromaDB') && (
                  <code style={{
                    display: 'block', marginTop: 8, padding: '6px 12px',
                    background: 'rgba(0,0,0,0.4)', borderRadius: 8,
                    color: '#22d3ee', fontSize: 12
                  }}>
                    cd backend && python data_loader.py
                  </code>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="animate-fade-in">
            {/* Stats bar */}
            <div className="flex items-center gap-4 flex-wrap mb-6 p-4 rounded-2xl"
              style={{ background: 'rgba(16,41,73,0.5)', border: '1px solid rgba(191,219,254,0.2)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 size={16} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  <strong style={{ color: '#f1f5f9' }}>{result.candidates_retrieved}</strong> facilities scanned
                </span>
              </div>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex items-center gap-2">
                <CheckCircle size={16} style={{ color: '#27ae60' }} />
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  <strong style={{ color: '#f1f5f9' }}>{result.top_results?.length || 0}</strong> recommended
                </span>
              </div>
              {result.medical_desert_alert?.detected && (
                <>
                  <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} style={{ color: '#e74c3c' }} />
                    <span style={{ fontSize: 13, color: '#fc8181' }}>Medical desert detected</span>
                  </div>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['results', 'map'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 20px', borderRadius: 10, border: 'none',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    background: activeTab === tab ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: activeTab === tab ? '#fff' : '#94a3b8',
                    transition: 'all 0.2s ease',
                  }}>
                  {tab === 'results' ? '🔍 Results' : '🗺️ Desert Map'}
                </button>
              ))}
            </div>

            {activeTab === 'results' && (
              <div>
                <div className="controls-panel mb-4">
                  <div className="flex items-center gap-2 mb-3" style={{ color: '#c7d9f4', fontSize: 12, fontWeight: 600 }}>
                    <SlidersHorizontal size={14} /> Smart filters
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label style={{ fontSize: 12, color: '#9fc2eb', display: 'block', marginBottom: 6 }}>
                        Minimum trust score: <strong>{minTrust}</strong>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={minTrust}
                        onChange={(e) => setMinTrust(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#9fc2eb', display: 'block', marginBottom: 6 }}>
                        Sort by
                      </label>
                      <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as SortMode)}
                        className="smart-select"
                      >
                        <option value="trust_desc">Trust score (high to low)</option>
                        <option value="trust_asc">Trust score (low to high)</option>
                        <option value="name_asc">Facility name (A-Z)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setMinTrust(0)
                          setSortMode('trust_desc')
                        }}
                        className="smart-btn"
                      >
                        Reset controls
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(13,35,62,0.72)', border: '1px solid rgba(125,211,252,0.18)' }}>
                  <p style={{ fontSize: 12, color: '#9fc2eb' }}>
                    <strong style={{ color: '#dbeafe' }}>Interpretation guide:</strong> High trust scores represent stronger evidence consistency,
                    while lower scores indicate contradictions or missing capability signals that require manual verification.
                  </p>
                </div>
                {result.agent_consensus && (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(15,33,55,0.75)', border: '1px solid rgba(148,163,184,0.25)' }}>
                    <p style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 700, marginBottom: 6 }}>MULTI-AGENT CONSENSUS</p>
                    <p style={{ fontSize: 13, color: '#cbd5e1' }}>
                      Agreement score: <strong>{result.agent_consensus.agreement_score}%</strong> ({result.agent_consensus.endorsed}/{result.agent_consensus.total} endorsed)
                    </p>
                    {result.agent_consensus.needs_human_review && (
                      <p style={{ fontSize: 12, color: '#fda4af', marginTop: 6 }}>Human review recommended due to low validator agreement.</p>
                    )}
                    {result.location_context && (
                      <p style={{ fontSize: 12, color: '#7dd3fc', marginTop: 6 }}>
                        PIN match context: {result.location_context.pin_matched_results} facilities match input PIN {result.location_context.input_pin}.
                      </p>
                    )}
                  </div>
                )}

                {result.intervention_plan && (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(6,44,35,0.45)', border: '1px solid rgba(52,211,153,0.3)' }}>
                    <p style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 700, marginBottom: 6 }}>
                      INTERVENTION PLAN · {result.intervention_plan.priority.toUpperCase()} PRIORITY
                    </p>
                    <ul style={{ fontSize: 13, color: '#d1fae5', lineHeight: 1.7, paddingLeft: 18 }}>
                      {result.intervention_plan.actions?.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {/* Medical Desert Alert */}
                {result.medical_desert_alert && (
                  <DesertAlert desert={result.medical_desert_alert} />
                )}

                {/* Validator */}
                {result.validator_check && (
                  <ValidatorPanel check={result.validator_check} />
                )}

                {/* Facility results */}
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#f1f5f9' }}>
                  Top Recommended Facilities
                </h2>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <button className="smart-btn" onClick={copyShareLink}>
                    <Share2 size={12} /> Share link
                  </button>
                  <button className="smart-btn" onClick={() => exportResults('json')}>
                    <Download size={12} /> Export JSON
                  </button>
                  <button className="smart-btn" onClick={() => exportResults('csv')}>
                    <Download size={12} /> Export CSV
                  </button>
                </div>
                {displayedResults.length === 0 ? (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(10,30,53,0.7)', border: '1px solid rgba(191,219,254,0.18)', color: '#9fc2eb' }}>
                    No facilities match the current trust filter. Lower the threshold to view more options.
                  </div>
                ) : (
                  displayedResults.map((r, i) => (
                    <FacilityCard
                      key={`${r.facility_name}-${i}`}
                      result={r}
                      index={i}
                      isSaved={savedFacilities.includes(r.facility_name)}
                      onToggleSave={toggleSavedFacility}
                    />
                  ))
                )}

                {savedFacilities.length > 0 && (
                  <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(16, 41, 73, 0.5)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <p style={{ fontSize: 12, color: '#fcd34d', marginBottom: 8, fontWeight: 700 }}>
                      QUICK SHORTLIST ({savedFacilities.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {savedFacilities.slice(0, 8).map(name => (
                        <span key={name} className="tag-pill" style={{ background: 'rgba(251,191,36,0.15)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.35)' }}>
                          <Bookmark size={10} /> {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {districtReadiness.length > 0 && (
                  <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(16, 41, 73, 0.5)', border: '1px solid rgba(125,211,252,0.25)' }}>
                    <p style={{ fontSize: 12, color: '#7dd3fc', marginBottom: 8, fontWeight: 700 }}>
                      DISTRICT READINESS SNAPSHOT
                    </p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {districtReadiness.map((d, i) => (
                        <div key={`${d.district}-${i}`} className="tag-pill" style={{ justifyContent: 'space-between', width: '100%', background: 'rgba(8,29,51,0.6)', border: '1px solid rgba(125,211,252,0.2)', color: '#cbd5e1' }}>
                          <span>{d.district}, {d.state}</span>
                          <strong>{d.readiness_score}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl p-4 mt-4" style={{ background: 'rgba(19,30,60,0.65)', border: '1px solid rgba(167,139,250,0.25)' }}>
                  <p style={{ fontSize: 12, color: '#c4b5fd', marginBottom: 8, fontWeight: 700 }}>WHAT-IF SIMULATOR</p>
                  <div className="grid md:grid-cols-4 gap-2">
                    <input className="smart-select" placeholder="District" value={simDistrict} onChange={(e) => setSimDistrict(e.target.value)} />
                    <select className="smart-select" value={simCapability} onChange={(e) => setSimCapability(e.target.value)}>
                      <option value="icu">ICU</option>
                      <option value="dialysis">Dialysis</option>
                      <option value="oncology">Oncology</option>
                      <option value="nicu">NICU</option>
                    </select>
                    <input className="smart-select" type="number" min={1} value={simAdded} onChange={(e) => setSimAdded(Number(e.target.value || 1))} />
                    <button
                      className="smart-btn"
                      onClick={async () => {
                        const res = await fetch('/api/what-if', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ district: simDistrict, capability: simCapability, facilities_added: simAdded }),
                        })
                        const data = await res.json()
                        setSimResult({
                          baseline_readiness: data.baseline_readiness || 0,
                          projected_readiness: data.projected_readiness || 0,
                          delta: data.delta || 0,
                        })
                      }}
                    >
                      Simulate
                    </button>
                  </div>
                  {simResult && (
                    <p style={{ fontSize: 13, color: '#e9d5ff', marginTop: 8 }}>
                      Baseline: <strong>{simResult.baseline_readiness}%</strong> {'->'} Projected: <strong>{simResult.projected_readiness}%</strong> (Delta {simResult.delta >= 0 ? '+' : ''}{simResult.delta}%)
                    </p>
                  )}
                </div>

                {/* Chain of thought */}
                {result.chain_of_thought && (
                  <div className="mt-4 p-4 rounded-2xl" style={{
                    background: 'rgba(26,34,53,0.8)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <ChainOfThought text={result.chain_of_thought} />
                  </div>
                )}

                {/* NGO Summary */}
                {result.summary && (
                  <div className="mt-4 p-5 rounded-2xl" style={{
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>
                        📋 NGO PLANNER SUMMARY
                      </p>
                      <button onClick={shareSummary} className="smart-btn">
                        <Share2 size={12} /> Copy summary
                      </button>
                    </div>
                    <p style={{ fontSize: 14, color: '#bae6fd', lineHeight: 1.7 }}>
                      {result.summary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'map' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                    🗺️ Medical Desert Map
                  </h2>
                  <a
                    href={mapSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                    style={{
                      padding: '8px 16px', borderRadius: 10,
                      background: 'rgba(59,130,246,0.15)',
                      color: '#60a5fa', fontSize: 13, fontWeight: 600,
                      textDecoration: 'none', border: '1px solid rgba(59,130,246,0.3)',
                    }}>
                    <ExternalLink size={14} />
                    Open Full Map
                  </a>
                </div>
                <div className="map-frame" style={{ height: 500 }}>
                  <iframe
                    src={mapSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    title="India Medical Desert Map"
                  />
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 12, textAlign: 'center' }}>
                  Generate a fresh map by posting to{' '}
                  <code style={{ color: '#60a5fa' }}>GET /api/generate-map</code> before loading this view.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <Activity size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: 16 }}>Enter a query above to begin.</p>
            <p style={{ fontSize: 13, marginTop: 8, opacity: 0.7 }}>
              The agent will search 10,000 facility records and return ranked results with trust scores.
            </p>
          </div>
        )}
      </section>
      {showOnboarding && (
        <div className="overlay">
          <div className="onboarding-card">
            <button className="close-btn" onClick={closeOnboarding} aria-label="Close guide">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-2" style={{ color: '#d9e8ff', fontWeight: 700 }}>
              <Sparkles size={15} /> Quick Start Guide
            </div>
            <p style={{ fontSize: 13, color: '#aac3e6', lineHeight: 1.6, marginBottom: 10 }}>
              Ask a complex healthcare need, then use filters to refine trust score quality. Save promising facilities,
              copy NGO summary, and switch to map for visual desert validation.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="gov-chip">/ Focus search</span>
              <span className="gov-chip">R Results tab</span>
              <span className="gov-chip">M Map tab</span>
            </div>
            <button className="smart-btn" onClick={closeOnboarding}>
              Start exploring
            </button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
