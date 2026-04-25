"""
main.py — FastAPI Application Entry Point

Endpoints:
  POST /api/query        → Natural language facility search
  POST /api/trust-score  → Score a single facility
  GET  /api/map          → Generate medical desert map
  GET  /api/health       → Health check
"""

import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from agent import query_agent, validate_recommendation
from trust_scorer import score_trust, batch_score
from map_generator import generate_medical_desert_map

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="🏥 India Healthcare Intelligence Agent",
    description=(
        "Agentic system that reads 10,000 messy Indian hospital records, "
        "scores their trustworthiness, and finds medical deserts on a map of India."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(
        ...,
        example="Find the nearest facility in rural Bihar that can perform emergency appendectomy",
        description="Natural language healthcare query",
    )
    top_k: int = Field(
        default=10,
        ge=5,
        le=25,
        description="Number of candidate facilities to retrieve before reasoning",
    )


class TrustRequest(BaseModel):
    facility_notes: str = Field(..., description="Raw facility notes text")
    facility_name: str = Field(..., description="Facility name for context")


class ValidateRequest(BaseModel):
    query: str
    facility_name: str
    why_recommended: str
    notes: str


class MapRequest(BaseModel):
    agent_findings: dict | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Service health check."""
    return {
        "status": "running",
        "agent": "India Healthcare Intelligence v1.0",
        "model": "claude-opus-4-5",
        "endpoints": ["/api/query", "/api/trust-score", "/api/validate", "/api/map"],
    }


@app.post("/api/query")
async def query_facilities(request: QueryRequest):
    """
    Main agent endpoint — natural language query to ranked facility recommendations.

    Returns:
    - Top 3 recommended facilities with trust scores & justification quotes
    - Chain of Thought reasoning
    - Medical desert alert if applicable
    - Validator agent cross-check
    - Executive summary for NGO planners
    """
    try:
        result = query_agent(request.query, request.top_k)
        return result
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail=(
                "ChromaDB not initialized. "
                "Please run: cd backend && python data_loader.py"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/trust-score")
async def trust_score_endpoint(request: TrustRequest):
    """
    Score a single facility's trustworthiness (0–100) with contradiction detection.
    """
    try:
        result = score_trust(request.facility_notes, request.facility_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validate")
async def validate_endpoint(request: ValidateRequest):
    """
    Validator Agent — cross-checks the primary agent's recommendation.
    Stretch goal: self-correction loop.
    """
    try:
        result = validate_recommendation(
            query=request.query,
            facility_name=request.facility_name,
            why_recommended=request.why_recommended,
            notes=request.notes,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/map")
async def generate_map(request: MapRequest):
    """
    Generate an interactive India map HTML file.
    Returns the map as an HTML response.
    """
    try:
        output_path = os.path.join(os.path.dirname(__file__), "medical_desert_map.html")
        generate_medical_desert_map(
            agent_findings=request.agent_findings,
            output_path=output_path,
        )
        return FileResponse(
            output_path,
            media_type="text/html",
            filename="medical_desert_map.html",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/map/preview", response_class=HTMLResponse)
async def map_preview():
    """Quick preview of the last generated map."""
    map_path = os.path.join(os.path.dirname(__file__), "medical_desert_map.html")
    if not os.path.exists(map_path):
        return HTMLResponse(
            "<h2>No map generated yet. POST to /api/map first.</h2>", status_code=404
        )
    with open(map_path, encoding="utf-8") as f:
        return HTMLResponse(f.read())


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
