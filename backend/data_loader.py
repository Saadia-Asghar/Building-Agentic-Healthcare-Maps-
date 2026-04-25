"""
data_loader.py — Load Excel → ChromaDB
Run this ONCE to embed all 10,000 facility records.
Takes ~10-15 minutes depending on your machine.
"""

import pandas as pd
import chromadb
from chromadb.utils import embedding_functions
import os
import sys


def load_and_embed(excel_path: str, db_path: str = "./chroma_db"):
    """
    Load the Excel file and embed all facilities into ChromaDB.
    Run this ONCE. Subsequent runs skip already-embedded records.
    """
    if not os.path.exists(excel_path):
        print(f"❌ Dataset not found at: {excel_path}")
        print("   Please place VF_Hackathon_Dataset_India_Large.xlsx in the data/ folder.")
        sys.exit(1)

    print("📂 Loading Excel file...")
    df = pd.read_excel(excel_path)

    print(f"✅ Loaded {len(df)} facilities")
    print(f"📋 Columns detected: {df.columns.tolist()}\n")

    # Normalise column names to lowercase + underscores for safety
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # ── ChromaDB setup ──────────────────────────────────────────────────────
    client = chromadb.PersistentClient(path=db_path)

    # Free local embeddings — no API cost, runs on CPU
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    collection = client.get_or_create_collection(
        name="healthcare_facilities",
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )

    existing_count = collection.count()
    if existing_count > 0:
        print(f"ℹ️  ChromaDB already contains {existing_count} records.")
        print("   Delete ./chroma_db to re-embed from scratch.\n")
        return collection

    # ── Build searchable text documents ─────────────────────────────────────
    documents = []
    metadatas = []
    ids = []

    BATCH_SIZE = 500

    for idx, row in df.iterrows():
        # Helper: safe string extraction
        def g(col):
            val = row.get(col, "")
            return "" if pd.isna(val) else str(val).strip()

        doc_text = f"""
Facility: {g('facility_name')}
State: {g('state')}
District: {g('district')}
PIN Code: {g('pin_code')}
Type: {g('facility_type')}
Equipment: {g('equipment')}
Staff: {g('staff_specialties')}
Services: {g('services')}
Notes: {g('unstructured_notes')}
Availability: {g('availability_24_7')}
Beds: {g('bed_count')}
Ownership: {g('ownership_type')}
""".strip()

        documents.append(doc_text)

        metadatas.append(
            {
                "facility_name": g("facility_name"),
                "state": g("state"),
                "district": g("district"),
                "pin_code": g("pin_code"),
                "facility_type": g("facility_type"),
                "latitude": g("latitude"),
                "longitude": g("longitude"),
                "row_index": int(idx),
            }
        )

        ids.append(f"facility_{idx}")

        # Flush in batches
        if len(documents) >= BATCH_SIZE:
            collection.add(documents=documents, metadatas=metadatas, ids=ids)
            documents, metadatas, ids = [], [], []
            print(f"   ↳ Embedded {idx + 1:,} / {len(df):,} facilities …")

    # Flush remainder
    if documents:
        collection.add(documents=documents, metadatas=metadatas, ids=ids)

    print(f"\n✅ Done! All {len(df):,} facilities embedded into ChromaDB.")
    print(f"   Database stored at: {os.path.abspath(db_path)}\n")
    return collection


if __name__ == "__main__":
    excel_path = os.path.join(
        os.path.dirname(__file__), "..", "data",
        "VF_Hackathon_Dataset_India_Large.xlsx",
    )
    load_and_embed(excel_path)
