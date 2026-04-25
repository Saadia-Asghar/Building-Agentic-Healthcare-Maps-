"""
main.py — Aarogya Healthcare Intelligence Agent
All prompts implemented:
  ✅ P2: Validator Agent (self-correction loop)
  ✅ P3: MLflow Tracing
  ✅ P5: Serve Folium map via /api/map-file
  ✅ P6: NGO Report Export
  ✅ P7: Confidence intervals on trust scores
"""
import os, json, re, math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import anthropic
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
import mlflow

load_dotenv()

app = FastAPI(title="Aarogya — Healthcare Intelligence Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/app", StaticFiles(directory=frontend_dir, html=True), name="frontend")

mlflow.set_experiment("healthcare-agent")

_ai = None
_col = None
_demo_col = None
_demo_mode = False


def get_ai():
    global _ai
    if _ai is None:
        _ai = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _ai


def get_collection(demo=False):
    global _col, _demo_col
    name = "demo_facilities" if demo else "healthcare_facilities"
    target = _demo_col if demo else _col
    if target is None:
        client = chromadb.PersistentClient(path="./chroma_db")
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        target = client.get_collection(name=name, embedding_function=ef)
        if demo:
            _demo_col = target
        else:
            _col = target
    return target


def parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        cleaned = re.sub(r"```json\s*|```\s*", "", text)
        try:
            return json.loads(cleaned)
        except Exception:
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except Exception:
                    pass
    return {}


def add_confidence_intervals(results: list) -> list:
    """P7: Add trust_min, trust_max, confidence to each result."""
    for r in results:
        flags = r.get("flags", [])
        score = r.get("trust_score", 50)
        if len(flags) > 2:
            margin, conf = 20, "low"
        elif len(flags) == 1:
            margin, conf = 10, "medium"
        else:
            margin, conf = 5, "high"
        r["trust_min"] = max(0, score - margin)
        r["trust_max"] = min(100, score + margin)
        r["confidence"] = conf
        r["trust_margin"] = margin
    return results


def validate_results(results: list, candidates_text: str, query: str) -> list:
    """P2: Validator Agent — challenges each recommendation."""
    if not results:
        return results

    top3 = json.dumps(results[:3], indent=2)
    prompt = f"""You are a medical data VALIDATOR challenging another AI agent's recommendations.

ORIGINAL QUERY: {query}

PRIMARY AGENT RECOMMENDED:
{top3}

RAW FACILITY NOTES SEARCHED:
{candidates_text[:3000]}

For each recommended facility, challenge the recommendation:
1. Is the quoted justification actually present in the notes?
2. Are there red flags the primary agent missed?
3. What should a human verify?

Return ONLY valid JSON array (same length as input, in same order):
[
  {{
    "facility_name": "...",
    "endorses": true,
    "validator_note": "One sentence challenge or endorsement",
    "missed_flags": ["any flag the primary agent missed"],
    "score_adjustment": 0
  }}
]"""

    resp = get_ai().messages.create(
        model="claude-opus-4-5",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text
    # Parse array
    try:
        arr = json.loads(raw)
    except Exception:
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        arr = json.loads(m.group()) if m else []

    if isinstance(arr, list):
        for i, v in enumerate(arr):
            if i < len(results):
                results[i]["validator_note"] = v.get("validator_note", "")
                results[i]["validator_endorses"] = v.get("endorses", True)
                # Apply score adjustment
                adj = v.get("score_adjustment", 0)
                results[i]["trust_score"] = max(0, min(100,
                    results[i].get("trust_score", 50) + adj))
                # Merge missed flags
                for f in v.get("missed_flags", []):
                    if f and f not in results[i].get("flags", []):
                        results[i].setdefault("flags", []).append(f)
    return results


# ── Models ────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    top_k: int = 8
    demo: bool = False


class TrustRequest(BaseModel):
    facility_name: str
    notes: str


class ExportRequest(BaseModel):
    query: str
    top_results: list
    medical_desert: dict = {}
    summary: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "agent": "Aarogya v2.0", "model": "claude-opus-4-5"}


@app.post("/api/query")
def query_facilities(req: QueryRequest):
    with mlflow.start_run():
        mlflow.log_param("query", req.query[:200])
        mlflow.log_param("top_k", req.top_k)
        mlflow.log_param("demo_mode", req.demo)

        # Semantic search
        try:
            col = get_collection(demo=req.demo)
            total = col.count()
            if total == 0:
                raise RuntimeError("Vector collection is empty.")
            results = col.query(
                query_texts=[req.query],
                n_results=min(req.top_k, total),
            )
        except Exception as e:
            return {
                "query": req.query,
                "top_results": [],
                "chain_of_thought": "Database not ready. Run load_data.py first.",
                "medical_desert": {"detected": False},
                "summary": str(e),
                "error": True,
            }

        # Build candidate text
        candidates = ""
        for i, (doc, meta) in enumerate(zip(
            results["documents"][0], results["metadatas"][0]
        )):
            candidates += (
                f"\n--- FACILITY {i+1} ---\n"
                f"Name: {meta.get('facility_name','?')}\n"
                f"Location: {meta.get('district','?')}, {meta.get('state','?')} "
                f"| PIN: {meta.get('pin_code','?')}\n"
                f"Notes:\n{doc}\n"
            )

        # Primary agent
        resp = get_ai().messages.create(
            model="claude-opus-4-5",
            max_tokens=2500,
            messages=[{"role": "user", "content": f"""You are an expert healthcare analyst for rural India.
Read messy hospital records and tell the truth about what each facility CAN actually do.

USER QUERY: {req.query}

CANDIDATES:
{candidates}

Return ONLY valid JSON:
{{
  "chain_of_thought": "Step-by-step reasoning (3-4 sentences)",
  "top_results": [
    {{
      "facility_name": "string",
      "state": "string",
      "district": "string",
      "pin_code": "string",
      "why_recommended": "Exact quote from raw notes",
      "trust_score": 0,
      "trust_reason": "Why this score",
      "flags": ["contradiction if any"],
      "data_quality": "high|medium|low|suspect"
    }}
  ],
  "medical_desert": {{
    "detected": false,
    "region": "",
    "gap": "",
    "severity": "critical|high|medium"
  }},
  "summary": "One paragraph for NGO planners"
}}

Scoring: 90+=verified, 70-89=likely, 50-69=uncertain, <50=suspicious.
Flag contradictions: claims X but no evidence of Y.
Detect medical_desert if NO facility genuinely handles the need."""}],
        )

        data = parse_json(resp.content[0].text)
        top = data.get("top_results", [])

        # P2: Validator Agent
        top = validate_results(top, candidates, req.query)

        # Keep trust_score stable for UI and scoring.
        for r in top:
            score = r.get("trust_score", 50)
            try:
                score = int(round(float(score)))
            except Exception:
                score = 50
            r["trust_score"] = max(0, min(100, score))

        # P7: Confidence intervals
        top = add_confidence_intervals(top)

        data["top_results"] = top
        data["query"] = req.query
        data["candidates_retrieved"] = len(results["documents"][0])
        data.setdefault("chain_of_thought", "")
        data.setdefault("summary", "")
        data.setdefault(
            "medical_desert",
            {"detected": False, "region": "", "gap": "", "severity": "medium"},
        )
        # Backward-compat for current frontend key.
        data["medical_desert_alert"] = data["medical_desert"]

        # MLflow metrics
        mlflow.log_metric("results_count", len(top))
        desert = data.get("medical_desert", {})
        mlflow.log_metric("desert_detected", 1 if desert.get("detected") else 0)
        avg_trust = sum(r.get("trust_score", 0) for r in top) / max(len(top), 1)
        mlflow.log_metric("avg_trust_score", round(avg_trust, 1))

        return data


@app.post("/api/trust")
def trust_score(req: TrustRequest):
    RULES = [
        ("advanced surgery",  ["anesthesiologist", "anaesthetist", "OT", "operation theatre"]),
        ("icu",               ["ventilator", "oxygen", "monitoring", "icu bed"]),
        ("24/7",              ["part-time", "visiting", "on-call only"]),
        ("nicu",              ["neonatologist", "neonatal specialist", "incubator"]),
        ("blood bank",        ["blood storage", "refrigerat", "blood unit"]),
        ("oncology",          ["oncologist", "chemotherapy", "radiation"]),
        ("dialysis",          ["dialysis machine", "nephrologist", "haemodialysis"]),
    ]
    notes_lower = req.notes.lower()
    auto_flags = [
        f"Claims '{claim}' but lacks supporting equipment/staff"
        for claim, evidence in RULES
        if claim in notes_lower and not any(e in notes_lower for e in evidence)
    ]

    resp = get_ai().messages.create(
        model="claude-opus-4-5",
        max_tokens=400,
        messages=[{"role": "user", "content": f"""Score trustworthiness of this Indian medical facility.
Facility: {req.facility_name}
Notes: {req.notes}
Pre-detected flags: {auto_flags}

Return ONLY JSON:
{{
  "trust_score": 0,
  "trust_reason": "one sentence",
  "flags": ["specific issues"],
  "data_quality": "high|medium|low|suspect",
  "recommendation": "trust|verify|avoid"
}}"""}],
    )
    result = parse_json(resp.content[0].text)
    for f in auto_flags:
        if f not in result.get("flags", []):
            result.setdefault("flags", []).append(f)

    # P7: confidence interval
    flags = result.get("flags", [])
    score = result.get("trust_score", 50)
    try:
        score = int(round(float(score)))
    except Exception:
        score = 50
    score = max(0, min(100, score))
    result["trust_score"] = score
    margin = 20 if len(flags) > 2 else 10 if len(flags) == 1 else 5
    result["trust_min"] = max(0, score - margin)
    result["trust_max"] = min(100, score + margin)
    result["confidence"] = "low" if margin == 20 else "medium" if margin == 10 else "high"
    return result


@app.get("/api/deserts")
def get_deserts():
    DESERT_DATA = [
        {"state": "Bihar",         "district": "Araria",     "pin": "854311", "gap": "No ICU",        "severity": "critical", "lat": 26.15, "lng": 87.47},
        {"state": "Bihar",         "district": "Sheohar",    "pin": "843329", "gap": "No Dialysis",   "severity": "critical", "lat": 26.52, "lng": 85.30},
        {"state": "Jharkhand",     "district": "Pakur",      "pin": "816107", "gap": "No Trauma",     "severity": "high",     "lat": 24.64, "lng": 87.84},
        {"state": "Rajasthan",     "district": "Barmer",     "pin": "344001", "gap": "No Oncology",   "severity": "high",     "lat": 25.75, "lng": 71.39},
        {"state": "Uttar Pradesh", "district": "Bahraich",   "pin": "271801", "gap": "No NICU",       "severity": "critical", "lat": 27.57, "lng": 81.59},
        {"state": "Odisha",        "district": "Malkangiri", "pin": "764048", "gap": "No Blood Bank", "severity": "high",     "lat": 18.35, "lng": 81.90},
        {"state": "Chhattisgarh", "district": "Bijapur",    "pin": "494444", "gap": "No Surgery",    "severity": "critical", "lat": 18.84, "lng": 80.80},
        {"state": "Assam",         "district": "Dhubri",     "pin": "783301", "gap": "No ICU",        "severity": "high",     "lat": 26.02, "lng": 89.97},
        {"state": "Madhya Pradesh","district": "Sheopur",    "pin": "476337", "gap": "No Specialist", "severity": "high",     "lat": 25.66, "lng": 76.70},
        {"state": "Uttar Pradesh", "district": "Shravasti",  "pin": "271831", "gap": "No Dialysis",   "severity": "critical", "lat": 27.52, "lng": 81.74},
    ]
    return {"deserts": DESERT_DATA, "total": len(DESERT_DATA)}


@app.get("/api/generate-map")
def generate_map():
    """P4+P5: Generate Folium map and save to frontend/map.html."""
    try:
        import subprocess, sys
        result = subprocess.run(
            [sys.executable, "generate_map.py"],
            capture_output=True, text=True, cwd=os.path.dirname(__file__)
        )
        if result.returncode != 0:
            raise HTTPException(500, result.stderr)
        return {"path": "map.html", "status": "generated"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/map-file")
def get_map_file():
    """P5: Serve the generated Folium map HTML."""
    map_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "map.html")
    if not os.path.exists(map_path):
        # Auto-generate if not present
        try:
            import generate_map  # noqa
            generate_map.build_map()
        except Exception:
            raise HTTPException(404, "Map not generated. Call /api/generate-map first.")
    return FileResponse(map_path, media_type="text/html")


@app.post("/api/export")
def export_report(req: ExportRequest):
    """P6: NGO Report Export — 300-word briefing document."""
    top3 = req.top_results[:3]
    facilities_text = "\n".join([
        f"- {r.get('facility_name','?')} ({r.get('district','?')}, {r.get('state','?')}) "
        f"— Trust: {r.get('trust_score','?')}/100. {r.get('why_recommended','')}"
        for r in top3
    ])
    desert = req.medical_desert
    desert_text = (
        f"Medical Desert DETECTED: {desert.get('region','?')} — "
        f"Gap: {desert.get('gap','?')} — Severity: {desert.get('severity','?').upper()}"
        if desert.get("detected") else "No medical desert detected for this query."
    )

    prompt = f"""Write a 300-word NGO briefing document in Markdown for the following healthcare intelligence report.

QUERY: {req.query}

TOP FACILITIES:
{facilities_text}

MEDICAL DESERT STATUS:
{desert_text}

AGENT SUMMARY:
{req.summary}

Structure the report with these sections:
## Executive Summary
## Top 3 Recommended Facilities
## Medical Desert Alert
## Recommended Interventions

Be specific, actionable, and honest about data quality concerns."""

    resp = get_ai().messages.create(
        model="claude-opus-4-5",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"report": resp.content[0].text}


@app.get("/api/mlflow-url")
def mlflow_url():
    return {"url": "http://localhost:5000", "command": "mlflow ui --port 5000"}


@app.get("/api/demo-mode")
def toggle_demo(enable: bool = True):
    """P8: Toggle demo mode."""
    global _demo_mode
    _demo_mode = enable
    return {"demo_mode": _demo_mode}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
