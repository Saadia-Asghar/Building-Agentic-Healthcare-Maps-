"""
generate_map.py — P4: Real India Folium Map with trust-scored facility dots + desert zones.

Run standalone:  python generate_map.py
Or called via:   GET /api/generate-map
"""
import os
import folium
from folium.plugins import MarkerCluster

DESERT_ZONES = [
    {"name": "Araria, Bihar",         "lat": 26.15, "lng": 87.47, "gap": "No ICU",        "sev": "critical"},
    {"name": "Sheohar, Bihar",        "lat": 26.52, "lng": 85.30, "gap": "No Dialysis",   "sev": "critical"},
    {"name": "Pakur, Jharkhand",      "lat": 24.64, "lng": 87.84, "gap": "No Trauma Care","sev": "high"},
    {"name": "Barmer, Rajasthan",     "lat": 25.75, "lng": 71.39, "gap": "No Oncology",   "sev": "high"},
    {"name": "Bahraich, UP",          "lat": 27.57, "lng": 81.59, "gap": "No NICU",       "sev": "critical"},
    {"name": "Malkangiri, Odisha",    "lat": 18.35, "lng": 81.90, "gap": "No Blood Bank", "sev": "high"},
    {"name": "Bijapur, Chhattisgarh", "lat": 18.84, "lng": 80.80, "gap": "No Surgery",   "sev": "critical"},
]


def build_map(output_path: str = None):
    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(__file__), "..", "frontend", "map.html"
        )

    m = folium.Map(
        location=[20.5937, 78.9629],
        zoom_start=5,
        tiles="CartoDB dark_matter",
    )

    # Try to plot real facilities from ChromaDB if available
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        client = chromadb.PersistentClient(path="./chroma_db")
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        col = client.get_collection(name="healthcare_facilities", embedding_function=ef)
        sample = col.get(limit=500, include=["metadatas"])
        cluster = MarkerCluster(name="Facilities").add_to(m)

        for meta in sample["metadatas"]:
            lat = meta.get("latitude", "")
            lng = meta.get("longitude", "")
            try:
                lat, lng = float(lat), float(lng)
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    continue
            except (ValueError, TypeError):
                continue

            name = meta.get("facility_name", "Unknown")
            state = meta.get("state", "")
            district = meta.get("district", "")

            folium.CircleMarker(
                location=[lat, lng],
                radius=5,
                color="#22c55e",
                fill=True,
                fill_color="#22c55e",
                fill_opacity=0.7,
                popup=folium.Popup(
                    f"<b>{name}</b><br>{district}, {state}", max_width=220
                ),
            ).add_to(cluster)

    except Exception as e:
        print(f"⚠  Could not load ChromaDB facilities: {e}")

    # Desert zone overlays
    for z in DESERT_ZONES:
        color = "#ef4444" if z["sev"] == "critical" else "#eab308"
        folium.Circle(
            location=[z["lat"], z["lng"]],
            radius=80_000,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.18,
            popup=folium.Popup(
                f"<b style='color:{color}'>⚠ MEDICAL DESERT</b><br>"
                f"{z['name']}<br>Gap: {z['gap']}<br>Severity: {z['sev'].upper()}",
                max_width=260,
            ),
            tooltip=f"⚠ Desert: {z['name']}",
        ).add_to(m)

        folium.CircleMarker(
            location=[z["lat"], z["lng"]],
            radius=6,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=1,
        ).add_to(m)

    # Legend
    legend = """
    <div style="position:fixed;bottom:30px;right:30px;z-index:9999;
                background:rgba(17,20,24,0.92);backdrop-filter:blur(8px);
                border:1px solid #2e3540;border-radius:10px;
                padding:14px 18px;font-family:monospace;font-size:12px;color:#e8eaed;">
      <div style="font-size:10px;letter-spacing:.12em;color:#6b7280;
                  text-transform:uppercase;margin-bottom:10px;">Trust Score</div>
      <div><span style="color:#22c55e">●</span> Facility (mapped)</div>
      <div style="margin-top:6px"><span style="color:#ef4444">◉</span> Critical Desert</div>
      <div style="margin-top:4px"><span style="color:#eab308">◉</span> High-Risk Desert</div>
    </div>
    """
    m.get_root().html.add_child(folium.Element(legend))

    folium.LayerControl().add_to(m)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    m.save(output_path)
    print(f"✅ Map saved to {output_path}")
    return output_path


if __name__ == "__main__":
    build_map()
