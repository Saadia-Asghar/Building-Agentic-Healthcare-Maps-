"""
load_data.py — Embed all facilities into ChromaDB (run ONCE).

Actual columns detected from VF_Hackathon_Dataset_India_Large.xlsx:
  name, description, specialties, procedure, equipment, capability,
  address_city, address_stateOrRegion, address_zipOrPostcode,
  facilityTypeId, numberDoctors, capacity, latitude, longitude, ...

Usage:
    python load_data.py --file ../data/VF_Hackathon_Dataset_India_Large.xlsx
"""
import argparse
import pandas as pd
import chromadb
from chromadb.utils import embedding_functions


# ── Column map matched to actual Excel columns ────────────────────────────────
COL_MAP = {
    "facility_name": ["name"],
    "state":         ["address_stateOrRegion"],
    "district":      ["address_city"],
    "pin_code":      ["address_zipOrPostcode"],
    "facility_type": ["facilityTypeId"],
    "equipment":     ["equipment"],
    "staff":         ["numberDoctors", "affiliated_staff_presence"],
    "services":      ["specialties", "procedure", "capability"],
    "notes":         ["description"],
    "availability":  ["capacity"],
    "latitude":      ["latitude"],
    "longitude":     ["longitude"],
}


def get_col(row: dict, key: str, df_columns: list) -> str:
    for c in COL_MAP[key]:
        val = row.get(c)
        if val is not None and pd.notna(val) and str(val).strip():
            return str(val).strip()
    return ""


def main(excel_path: str):
    print(f"Loading {excel_path} ...")
    df = pd.read_excel(excel_path)
    print(f"✅ Loaded {len(df):,} rows")
    print(f"📋 Columns: {list(df.columns)}\n")

    df_cols = list(df.columns)

    client = chromadb.PersistentClient(path="./chroma_db")
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    try:
        client.delete_collection("healthcare_facilities")
        print("⚠  Deleted existing collection — re-embedding.\n")
    except Exception:
        pass

    col = client.create_collection(
        name="healthcare_facilities",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    docs, metas, ids = [], [], []
    BATCH = 500

    for idx, row in df.iterrows():
        r = row.to_dict()

        def g(k): return get_col(r, k, df_cols)

        text = f"""
Facility: {g('facility_name')}
State: {g('state')} | District: {g('district')} | PIN: {g('pin_code')}
Type: {g('facility_type')}
Equipment: {g('equipment')}
Doctors/Staff: {g('staff')}
Specialties/Services: {g('services')}
Capacity/Availability: {g('availability')}
Description/Notes: {g('notes')}
""".strip()

        docs.append(text)
        metas.append({
            "facility_name": g("facility_name"),
            "state":         g("state"),
            "district":      g("district"),
            "pin_code":      g("pin_code"),
            "facility_type": g("facility_type"),
            "latitude":      g("latitude"),
            "longitude":     g("longitude"),
            "row_index":     str(idx),
        })
        ids.append(f"f_{idx}")

        if len(docs) >= BATCH:
            col.add(documents=docs, metadatas=metas, ids=ids)
            docs, metas, ids = [], [], []
            print(f"   ↳ Embedded {idx + 1:,} / {len(df):,} ...")

    if docs:
        col.add(documents=docs, metadatas=metas, ids=ids)

    print(f"\n✅ Done — {len(df):,} facilities embedded.")
    print("   Next: uvicorn main:app --reload --port 8000\n")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--file", default="../data/VF_Hackathon_Dataset_India_Large.xlsx")
    args = p.parse_args()
    main(args.file)
