"""
map_generator.py — Interactive India Healthcare Map

Generates a Folium map showing:
- All facilities color-coded by trust score / data quality
- Medical desert zones (red circles)
- Heatmap of suspicious data clusters
"""

import folium
from folium.plugins import HeatMap, MarkerCluster
import pandas as pd
import json
import os
from typing import Optional

# Approximate center coordinates for Indian states
STATE_COORDS: dict[str, list[float]] = {
    "Andaman and Nicobar Islands": [11.7401, 92.6586],
    "Andhra Pradesh": [15.9129, 79.7400],
    "Arunachal Pradesh": [28.2180, 94.7278],
    "Assam": [26.2006, 92.9376],
    "Bihar": [25.0961, 85.3131],
    "Chandigarh": [30.7333, 76.7794],
    "Chhattisgarh": [21.2787, 81.8661],
    "Dadra and Nagar Haveli": [20.1809, 73.0169],
    "Daman and Diu": [20.4283, 72.8397],
    "Delhi": [28.7041, 77.1025],
    "Goa": [15.2993, 74.1240],
    "Gujarat": [22.2587, 71.1924],
    "Haryana": [29.0588, 76.0856],
    "Himachal Pradesh": [31.1048, 77.1734],
    "Jammu and Kashmir": [33.7782, 76.5762],
    "Jharkhand": [23.6102, 85.2799],
    "Karnataka": [15.3173, 75.7139],
    "Kerala": [10.8505, 76.2711],
    "Ladakh": [34.1526, 77.5770],
    "Lakshadweep": [10.5667, 72.6417],
    "Madhya Pradesh": [22.9734, 78.6569],
    "Maharashtra": [19.7515, 75.7139],
    "Manipur": [24.6637, 93.9063],
    "Meghalaya": [25.4670, 91.3662],
    "Mizoram": [23.1645, 92.9376],
    "Nagaland": [26.1584, 94.5624],
    "Odisha": [20.9517, 85.0985],
    "Puducherry": [11.9416, 79.8083],
    "Punjab": [31.1471, 75.3412],
    "Rajasthan": [27.0238, 74.2179],
    "Sikkim": [27.5330, 88.5122],
    "Tamil Nadu": [11.1271, 78.6569],
    "Telangana": [18.1124, 79.0193],
    "Tripura": [23.9408, 91.9882],
    "Uttar Pradesh": [26.8467, 80.9462],
    "Uttarakhand": [30.0668, 79.0193],
    "West Bengal": [22.9868, 87.8550],
}

QUALITY_COLORS = {
    "high": "#27ae60",      # Green
    "medium": "#f39c12",    # Amber
    "low": "#e74c3c",       # Red
    "suspect": "#8e44ad",   # Purple
    "unknown": "#95a5a6",   # Grey
}

TRUST_TO_QUALITY = {
    range(80, 101): "high",
    range(50, 80): "medium",
    range(30, 50): "low",
    range(0, 30): "suspect",
}


def _trust_to_quality(score: int) -> str:
    for r, q in TRUST_TO_QUALITY.items():
        if score in r:
            return q
    return "unknown"


def generate_medical_desert_map(
    facilities_df: Optional[pd.DataFrame] = None,
    agent_findings: Optional[dict] = None,
    output_path: str = "medical_desert_map.html",
) -> str:
    """
    Generate an interactive India map.

    Args:
        facilities_df:   DataFrame with lat/lon + trust scores (optional).
        agent_findings:  Output from query_agent() (optional).
        output_path:     Where to save the HTML file.

    Returns:
        Absolute path to the saved HTML file.
    """

    # ── Base map ─────────────────────────────────────────────────────────────
    india_map = folium.Map(
        location=[20.5937, 78.9629],
        zoom_start=5,
        tiles="CartoDB positron",
    )

    # ── Title ─────────────────────────────────────────────────────────────────
    title_html = """
    <div style="position:fixed; top:10px; left:50%; transform:translateX(-50%);
                z-index:9999; background:rgba(255,255,255,0.95);
                padding:12px 24px; border-radius:10px;
                box-shadow:0 2px 12px rgba(0,0,0,0.2);
                font-family:'Segoe UI',sans-serif; text-align:center;">
      <span style="font-size:18px; font-weight:700; color:#1a1a2e;">
        🏥 India Healthcare Intelligence Map
      </span><br>
      <span style="font-size:12px; color:#555;">Medical Desert Analysis · Powered by Agentic AI</span>
    </div>
    """
    india_map.get_root().html.add_child(folium.Element(title_html))

    # ── Facility markers ──────────────────────────────────────────────────────
    if facilities_df is not None and not facilities_df.empty:
        cluster = MarkerCluster(name="All Facilities").add_to(india_map)

        heatmap_data = []

        for _, row in facilities_df.iterrows():
            lat = row.get("latitude")
            lon = row.get("longitude")

            if pd.isna(lat) or pd.isna(lon):
                continue

            lat, lon = float(lat), float(lon)
            quality = row.get("data_quality", "unknown")
            trust_score = int(row.get("trust_score", 50))
            color = QUALITY_COLORS.get(quality, "#95a5a6")

            folium.CircleMarker(
                location=[lat, lon],
                radius=5,
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.8,
                popup=folium.Popup(
                    f"""<div style="font-family:Arial; min-width:200px;">
                    <b>{row.get('facility_name', 'Unknown')}</b><br>
                    <span style="color:#666">{row.get('district','')}, {row.get('state','')}</span><br>
                    PIN: {row.get('pin_code','N/A')}<br>
                    <hr style="margin:4px 0">
                    Trust Score: <b style="color:{color}">{trust_score}/100</b><br>
                    Quality: <b>{quality.upper()}</b><br>
                    Type: {row.get('facility_type','N/A')}
                    </div>""",
                    max_width=280,
                ),
            ).add_to(cluster)

            # Build heatmap from low-trust facilities
            if trust_score < 50:
                heatmap_data.append([lat, lon, (50 - trust_score) / 50])

        # Add heatmap layer for suspicious data clusters
        if heatmap_data:
            HeatMap(
                heatmap_data,
                name="Suspicious Data Heatmap",
                radius=20,
                blur=15,
                gradient={0.4: "blue", 0.65: "orange", 1: "red"},
            ).add_to(india_map)

    # ── Medical desert overlays from agent ────────────────────────────────────
    if agent_findings:
        desert = agent_findings.get("medical_desert_alert", {})
        if desert.get("detected"):
            region = desert.get("region", "")
            gap = desert.get("gap", "Unknown gap")
            severity = desert.get("severity", "high")

            fill_opacity = {"critical": 0.35, "high": 0.25, "moderate": 0.15}.get(
                severity, 0.2
            )

            # Match region to state coordinates
            matched = False
            for state, coords in STATE_COORDS.items():
                if state.lower() in region.lower() or region.lower() in state.lower():
                    folium.Circle(
                        location=coords,
                        radius=180_000,  # ~180 km
                        color="#c0392b",
                        fill=True,
                        fill_color="#e74c3c",
                        fill_opacity=fill_opacity,
                        popup=folium.Popup(
                            f"""<div style="font-family:Arial; min-width:220px;">
                            <b style="color:#c0392b;">⚠️ MEDICAL DESERT DETECTED</b><br>
                            Region: <b>{region}</b><br>
                            Gap: <b>{gap}</b><br>
                            Severity: <b>{severity.upper()}</b><br>
                            <hr style="margin:4px 0">
                            <i style="color:#666">Urgent: NGO intervention needed</i>
                            </div>""",
                            max_width=300,
                        ),
                        tooltip=f"⚠️ Medical Desert: {region}",
                    ).add_to(india_map)
                    matched = True
                    break

            # Fallback: generic pin-code markers
            if not matched:
                for pin in desert.get("affected_pin_codes", [])[:5]:
                    folium.Marker(
                        location=[20.5937, 78.9629],  # India center fallback
                        icon=folium.Icon(color="red", icon="exclamation-sign"),
                        popup=f"Medical Desert — PIN {pin}: {gap}",
                    ).add_to(india_map)

        # Top result markers from agent
        for result in agent_findings.get("top_results", []):
            state = result.get("state", "")
            coords = STATE_COORDS.get(state)
            if coords:
                score = result.get("trust_score", 50)
                color = "green" if score >= 70 else "orange" if score >= 40 else "red"
                folium.Marker(
                    location=coords,
                    icon=folium.Icon(color=color, icon="plus-sign", prefix="glyphicon"),
                    popup=folium.Popup(
                        f"""<div style="font-family:Arial; min-width:220px;">
                        <b>🏥 {result.get('facility_name','Unknown')}</b><br>
                        {result.get('district','')}, {result.get('state','')}<br>
                        Trust: <b>{score}/100</b><br>
                        <i>{result.get('why_recommended','')[:120]}…</i>
                        </div>""",
                        max_width=300,
                    ),
                    tooltip=f"Agent Pick: {result.get('facility_name','')}",
                ).add_to(india_map)

    # ── Layer control ─────────────────────────────────────────────────────────
    folium.LayerControl().add_to(india_map)

    # ── Legend ────────────────────────────────────────────────────────────────
    legend_html = """
    <div style="position:fixed; bottom:30px; right:30px; z-index:1000;
                background:white; padding:15px 18px; border-radius:10px;
                box-shadow:0 2px 10px rgba(0,0,0,0.25);
                font-family:'Segoe UI',Arial; font-size:13px; min-width:180px;">
      <b style="font-size:14px;">Trust Score</b><br><br>
      <span style="color:#27ae60; font-size:16px;">●</span> High Trust (80–100)<br>
      <span style="color:#f39c12; font-size:16px;">●</span> Medium Trust (50–79)<br>
      <span style="color:#e74c3c; font-size:16px;">●</span> Low Trust (30–49)<br>
      <span style="color:#8e44ad; font-size:16px;">●</span> Suspicious Data (0–29)<br>
      <span style="color:#95a5a6; font-size:16px;">●</span> Unknown<br>
      <hr style="margin:8px 0">
      <span style="color:#c0392b; font-size:16px;">◉</span> Medical Desert Zone
    </div>
    """
    india_map.get_root().html.add_child(folium.Element(legend_html))

    # ── Save ──────────────────────────────────────────────────────────────────
    abs_path = os.path.abspath(output_path)
    india_map.save(abs_path)
    print(f"✅ Map saved to {abs_path}")
    return abs_path
