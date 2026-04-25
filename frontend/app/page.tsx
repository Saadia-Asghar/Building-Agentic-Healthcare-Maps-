'use client'

import { useState } from 'react'
import {
  Search, MapPin, AlertTriangle, Shield, ChevronDown,
  Loader2, Activity, Brain, BarChart3, ExternalLink,
  CheckCircle, XCircle, AlertCircle, Zap, Globe
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
}

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

function FacilityCard({ result, index }: { result: FacilityResult; index: number }) {
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
              "{result.why_recommended}"
            </p>
          </div>

          {/* Trust reason */}
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 3 }}>
            <span style={{ color: cfg.color, fontWeight: 600 }}>Score reason: </span>
            {result.trust_reason}
          </p>

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
  const [result, setResult] = useState<AgentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'results' | 'map'>('results')

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
        body: JSON.stringify({ query: q, top_k: 10 }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Agent request failed')
      }
      const data = await res.json()
      setResult(data)
      setActiveTab('results')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 0' }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Activity size={22} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Healthcare Intelligence Maps
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                MIT Challenge 03 · Serving A Nation · 1.4 Billion Lives
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="india-stripe" style={{ width: 60, borderRadius: 2 }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>🇮🇳 India · 10k Facilities</span>
          </div>
        </div>
        <div className="india-stripe" />
      </header>

      {/* Hero */}
      <section style={{ padding: '60px 32px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
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

          <p style={{ fontSize: 17, color: '#94a3b8', lineHeight: 1.7, marginBottom: 40 }}>
            In India, a postal code determines a lifespan. This AI agent reads{' '}
            <strong style={{ color: '#f1f5f9' }}>10,000 messy hospital records</strong>,
            scores their trustworthiness, finds medical deserts, and answers complex
            natural language queries in seconds.
          </p>

          {/* Search */}
          <div className="search-glow rounded-2xl relative"
            style={{ border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(26,34,53,0.9)' }}>
            <div className="flex items-center gap-3 p-4">
              <Search size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <input
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
                  background: loading ? 'rgba(59,130,246,0.3)' : '#3b82f6',
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
          </div>

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
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 80px' }}>

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
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                {result.top_results?.map((r, i) => (
                  <FacilityCard key={i} result={r} index={i} />
                ))}

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
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>
                      📋 NGO PLANNER SUMMARY
                    </p>
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
                    href="/api/map/preview"
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
                    src="/api/map/preview"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    title="India Medical Desert Map"
                  />
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 12, textAlign: 'center' }}>
                  Generate a fresh map by posting to{' '}
                  <code style={{ color: '#60a5fa' }}>POST /api/map</code> with agent findings.
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
    </div>
  )
}
