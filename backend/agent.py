"""
agent.py — Claude-powered Healthcare Query Agent

Flow:
  User query → ChromaDB semantic search → top-10 candidates
             → Claude reasoning & ranking → structured JSON response
"""

import json
import re
import os
import anthropic
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

load_dotenv()

_anthropic_client = None
_collection = None


def get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    return _anthropic_client


def get_collection():
    global _collection
    if _collection is None:
        db_path = os.path.join(os.path.dirname(__file__), "chroma_db")
        chroma_client = chromadb.PersistentClient(path=db_path)
        embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        _collection = chroma_client.get_collection(
            name="healthcare_facilities",
            embedding_function=embedding_fn,
        )
    return _collection


# ── Prompt template ──────────────────────────────────────────────────────────

AGENT_PROMPT = """You are an expert healthcare intelligence analyst helping route patients across India.
Your role: read messy, unstructured Indian hospital records and tell the truth about what each facility CAN actually do.

USER QUERY: {user_query}

Below are {top_k} candidate facilities retrieved from a database of 10,000 Indian medical facilities.
Read every word of their notes carefully — do NOT trust facility names or self-reported categories alone.

{candidates_text}

YOUR TASKS:
1. Identify which facilities ACTUALLY match the query based on detailed notes (not just names or categories).
2. Rank the top 3 best matches. For each, quote the EXACT sentence from the notes that justifies the recommendation.
3. Flag contradictions: e.g. claims "Advanced Surgery" but notes list no anesthesiologist.
4. Detect MEDICAL DESERTS: regions where NO facility can genuinely handle this type of need.
5. Assign Trust Scores (0–100):
   - 90–100: Detailed, specific, internally consistent claims
   - 70–89: Mostly credible with minor gaps
   - 50–69: Some vague language or inconsistencies
   - 30–49: Multiple red flags
   - 0–29: Highly suspicious or likely data errors

Respond ONLY with valid JSON matching this schema exactly:
{{
    "chain_of_thought": "Step-by-step reasoning: what you looked for, what you found, how you ranked...",
    "top_results": [
        {{
            "facility_name": "...",
            "state": "...",
            "district": "...",
            "pin_code": "...",
            "why_recommended": "Exact quote from notes that justifies this recommendation",
            "trust_score": 85,
            "trust_reason": "Specific reason for this score — what supports or undermines claims",
            "flags": ["contradiction or concern if any"],
            "data_quality": "high|medium|low|suspect"
        }}
    ],
    "medical_desert_alert": {{
        "detected": true,
        "region": "e.g. rural Bihar",
        "gap": "What critical capability is completely absent",
        "affected_pin_codes": ["800001", "800002"],
        "severity": "critical|high|moderate"
    }},
    "validator_check": {{
        "primary_agent_reliable": true,
        "concerns": "Any issues with the primary recommendation?",
        "confidence": "high|medium|low"
    }},
    "summary": "One paragraph executive summary for an NGO planner — actionable, specific, honest about gaps"
}}"""


def _build_candidates_text(search_results: dict) -> str:
    """Format ChromaDB results into a readable block for the prompt."""
    parts = []
    for i, (doc, meta) in enumerate(
        zip(search_results["documents"][0], search_results["metadatas"][0])
    ):
        parts.append(
            f"""--- FACILITY {i + 1} ---
Name:     {meta.get('facility_name', 'Unknown')}
Location: {meta.get('district', '')}, {meta.get('state', '')} | PIN: {meta.get('pin_code', '')}
Type:     {meta.get('facility_type', '')}
Raw Notes:
{doc}
"""
        )
    return "\n".join(parts)


def _parse_json_response(raw: str) -> dict:
    """Robustly parse JSON even if Claude wraps it in markdown."""
    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    cleaned = re.sub(r"```json\s*", "", raw)
    cleaned = re.sub(r"```\s*", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Extract first {...} block
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {"error": "Failed to parse agent response", "raw_response": raw}


def query_agent(user_query: str, top_k: int = 10) -> dict:
    """
    Main agent function.

    Args:
        user_query: Natural language question from the user.
        top_k:      Number of candidate facilities to retrieve before reasoning.

    Returns:
        Structured dict with top_results, trust scores, medical desert alert, etc.
    """
    # ── Step 1: Semantic search ──────────────────────────────────────────────
    collection = get_collection()
    search_results = collection.query(
        query_texts=[user_query],
        n_results=min(top_k, collection.count()),
    )

    # ── Step 2: Build prompt ─────────────────────────────────────────────────
    candidates_text = _build_candidates_text(search_results)

    prompt = AGENT_PROMPT.format(
        user_query=user_query,
        top_k=top_k,
        candidates_text=candidates_text,
    )

    # ── Step 3: Claude reasoning ─────────────────────────────────────────────
    client = get_anthropic_client()
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    result = _parse_json_response(raw)
    result["query"] = user_query
    result["candidates_retrieved"] = len(search_results["documents"][0])

    return result


# ── Validator Agent (Stretch Goal) ────────────────────────────────────────────

VALIDATOR_PROMPT = """You are a medical data validator checking another AI agent's recommendation.

ORIGINAL QUERY: {query}
RECOMMENDED FACILITY: {facility_name}
RECOMMENDATION REASON: {why_recommended}
FULL FACILITY NOTES:
{notes}

Challenge this recommendation critically:
1. Is the quoted justification actually present in the notes?
2. Are there any red flags the primary agent missed?
3. What would a human verifier need to check before trusting this?

Respond with JSON only:
{{
    "endorses_recommendation": true,
    "confidence": "high|medium|low",
    "missed_flags": ["..."],
    "verification_steps": ["What a human should verify before trusting this"],
    "validator_score_adjustment": 0
}}"""


def validate_recommendation(
    query: str,
    facility_name: str,
    why_recommended: str,
    notes: str,
) -> dict:
    """Secondary validator agent that cross-checks the primary agent's output."""
    client = get_anthropic_client()
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=800,
        messages=[
            {
                "role": "user",
                "content": VALIDATOR_PROMPT.format(
                    query=query,
                    facility_name=facility_name,
                    why_recommended=why_recommended,
                    notes=notes,
                ),
            }
        ],
    )
    return _parse_json_response(response.content[0].text)
