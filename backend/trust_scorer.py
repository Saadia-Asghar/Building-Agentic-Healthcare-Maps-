"""
trust_scorer.py — Facility Trust Scoring Engine

Combines:
1. Fast rule-based contradiction detection (free, instant)
2. Claude deep-assessment for nuanced inconsistencies
"""

import json
import os
import re
import anthropic
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


# ── Contradiction rules ───────────────────────────────────────────────────────
# Format: (CLAIM keyword, EVIDENCE keywords, human-readable message)
# If CLAIM is present but NONE of the EVIDENCE keywords are found → flag it.

CONTRADICTION_RULES = [
    (
        "advanced surgery",
        ["anesthesiologist", "anaesthesiologist", "anesthesia", "anaesthesia"],
        "Claims 'Advanced Surgery' but no anesthesiologist or anesthesia equipment found",
    ),
    (
        "icu",
        ["ventilator", "oxygen concentrator", "monitoring", "icu bed", "intensive care"],
        "Claims ICU but no ICU-grade equipment mentioned",
    ),
    (
        "24/7",
        ["resident doctor", "on-site", "24 hour", "round the clock", "always available"],
        "Claims 24/7 availability but only part-time or visiting staff mentioned",
    ),
    (
        "nicu",
        ["neonatologist", "neonatal", "incubator", "premature"],
        "Claims NICU but no neonatal specialist or equipment listed",
    ),
    (
        "blood bank",
        ["blood storage", "refrigeration", "blood transfusion", "blood unit"],
        "Claims Blood Bank but no storage infrastructure mentioned",
    ),
    (
        "emergency trauma",
        ["trauma surgeon", "orthopedic", "emergency surgeon", "casualty"],
        "Claims Emergency Trauma but no trauma surgeon listed",
    ),
    (
        "oncology",
        ["oncologist", "chemotherapy", "radiation", "radiotherapy", "cancer specialist"],
        "Claims Oncology services but no oncologist or treatment equipment mentioned",
    ),
    (
        "dialysis",
        ["dialysis machine", "nephrologist", "renal", "haemodialysis", "hemodialysis"],
        "Claims Dialysis services but no dialysis machine or nephrologist listed",
    ),
    (
        "radiation therapy",
        ["linear accelerator", "linac", "radiation oncologist", "radiotherapy machine"],
        "Claims Radiation Therapy but no relevant equipment or specialist listed",
    ),
    (
        "mri",
        ["mri machine", "magnetic resonance", "radiologist"],
        "Claims MRI facility but no MRI machine or radiologist listed",
    ),
]


def _rule_based_check(notes: str) -> list[str]:
    """Fast, free contradiction detection using keyword rules."""
    flags = []
    notes_lower = notes.lower()

    for claim, evidence_list, message in CONTRADICTION_RULES:
        if claim in notes_lower:
            evidence_present = any(e in notes_lower for e in evidence_list)
            if not evidence_present:
                flags.append(message)

    # Additional heuristics
    if len(notes.strip()) < 50:
        flags.append("Extremely sparse notes — facility data appears incomplete")

    if notes.lower().count("not available") > 3:
        flags.append("Multiple 'not available' entries suggest severely limited capabilities")

    return flags


TRUST_PROMPT = """You are a medical data quality auditor assessing an Indian healthcare facility report.

FACILITY NAME: {facility_name}
FULL NOTES:
{facility_notes}

PRE-DETECTED RULE-BASED FLAGS:
{flags}

Evaluate the trustworthiness of this report on a scale of 0–100:
  90–100 → Detailed, specific, internally consistent — claims match evidence
  70–89  → Mostly credible with minor vague language or small gaps
  50–69  → Some suspicious claims, inconsistencies, or missing supporting evidence
  30–49  → Multiple red flags, claims clearly don't match reported equipment/staff
  0–29   → Highly suspicious — likely data errors, overstatement, or fabrication

Respond with ONLY valid JSON:
{{
    "trust_score": <integer 0-100>,
    "trust_reason": "<one clear sentence explaining the score>",
    "flags": ["<specific contradiction or concern>"],
    "data_quality": "high|medium|low|suspect",
    "key_strengths": ["<what makes this report credible>"],
    "verification_needed": ["<what a human should verify before trusting this facility>"]
}}"""


def score_trust(facility_notes: str, facility_name: str) -> dict:
    """
    Score a single facility's trustworthiness.

    Returns:
        {
            trust_score: int,
            trust_reason: str,
            flags: list[str],
            data_quality: str,
            key_strengths: list[str],
            verification_needed: list[str]
        }
    """
    # Step 1: Fast rule-based check
    rule_flags = _rule_based_check(facility_notes)

    # Step 2: Claude deep assessment
    prompt = TRUST_PROMPT.format(
        facility_name=facility_name,
        facility_notes=facility_notes[:3000],  # cap to avoid token overflow
        flags=rule_flags if rule_flags else ["None detected"],
    )

    client = _get_client()
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text

    # Parse JSON
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = re.sub(r"```json\s*|```\s*", "", raw)
        try:
            result = json.loads(cleaned)
        except Exception:
            result = {
                "trust_score": 50,
                "trust_reason": "Could not fully assess — please review manually",
                "flags": rule_flags,
                "data_quality": "unknown",
                "key_strengths": [],
                "verification_needed": ["Manual review required"],
            }

    # Merge rule-based flags that Claude may have missed
    existing_flags = result.get("flags", [])
    for flag in rule_flags:
        if flag not in existing_flags:
            existing_flags.append(flag)
    result["flags"] = existing_flags

    return result


def batch_score(facilities: list[dict]) -> list[dict]:
    """
    Score multiple facilities.

    Args:
        facilities: List of dicts with 'facility_name' and 'notes' keys.

    Returns:
        Same list with trust scores added.
    """
    results = []
    for f in facilities:
        score = score_trust(
            facility_notes=f.get("notes", ""),
            facility_name=f.get("facility_name", "Unknown"),
        )
        results.append({**f, **score})
    return results
