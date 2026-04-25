# 🏥 Building Agentic Healthcare Maps for 1.4 Billion Lives

> **MIT Hackathon — Challenge 03: Serving A Nation**  
> *In collaboration with MIT Club of Northern California and MIT Club of Germany*  
> *Powered by Databricks Data Intelligence Platform*

---

## 🎯 What This Builds

An **Agentic Healthcare Intelligence System** that reads 10,000 messy Indian hospital records, scores their trustworthiness, finds medical deserts on a map of India, and answers natural language queries like *"Find the nearest ICU in rural Bihar."*

```
┌─────────────────────────────────────────┐
│         FRONTEND (Next.js)              │
│   Search bar + Results + Map + Trust    │
├─────────────────────────────────────────┤
│         AGENT LAYER (Python/FastAPI)    │
│   Query → Search → Reason → Score      │
├─────────────────────────────────────────┤
│         DATA LAYER                      │
│   Excel → ChromaDB vector store        │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/Saadia-Asghar/Building-Agentic-Healthcare-Maps-.git
cd Building-Agentic-Healthcare-Maps-

python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r backend/requirements.txt
```

### 2. Configure API Keys

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY
```

### 3. Add the Dataset

Place `VF_Hackathon_Dataset_India_Large.xlsx` in the `data/` folder.

### 4. Load Data (Run Once)

```bash
cd backend
python warmup.py
python load_data.py --file ../data/VF_Hackathon_Dataset_India_Large.xlsx
```

This embeds all 10,000 facility records into ChromaDB (~10-15 minutes).

### 5. Start Backend

```bash
cd backend
uvicorn main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 6. Start Frontend

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:3000
```

---

## 📁 Project Structure

```
challenge03/
│
├── backend/
│   ├── main.py              # FastAPI app — REST API server
│   ├── data_loader.py       # Load Excel → ChromaDB embeddings
│   ├── agent.py             # Query agent (Claude-powered reasoning)
│   ├── trust_scorer.py      # Trust scoring with contradiction detection
│   ├── map_generator.py     # Medical desert map generation
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment template
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main search UI
│   │   ├── layout.tsx       # App layout
│   │   └── globals.css      # Styles
│   ├── components/
│   │   ├── QueryPanel.tsx   # Search + results
│   │   ├── TrustBadge.tsx   # Trust score display
│   │   ├── ChainOfThought.tsx # Reasoning display
│   │   └── DesertAlert.tsx  # Medical desert alert
│   ├── package.json
│   └── next.config.js
│
├── data/
│   └── VF_Hackathon_Dataset_India_Large.xlsx  # ← Place dataset here
│
└── README.md
```

---

## 🧠 Core Features

### 1. Semantic Search (10k Facilities)
- ChromaDB vector store with `all-MiniLM-L6-v2` embeddings
- Handles messy Hindi-English notes, abbreviations, inconsistent naming
- Returns top-10 candidates for every query

### 2. Gemini-Powered Reasoning Agent
- Multi-attribute query resolution (not just keyword matching)
- Step-by-step Chain of Thought visible to users
- Row-level citations — every recommendation links to the exact sentence

### 3. Trust Scorer
- 0–100 trust score for every facility
- Rule-based contradiction detection (e.g., claims ICU but no ventilator listed)
- Claude deep-assessment for complex inconsistencies

### 4. Medical Desert Detection
- Identifies regions with NO capable facility for a given need
- Highlighted on interactive India map
- Actionable insights for NGO planners

### 5. Interactive India Map
- All 10,000 facilities color-coded by trust score
- Medical desert zones highlighted in red
- Clickable popups with facility details

---

## 🔍 Example Queries

```
"Find the nearest facility in rural Bihar that can perform emergency appendectomy"

"Which districts in Jharkhand have NO functional dialysis center?"

"Find hospitals claiming advanced oncology in UP — verify radiation equipment"

"Emergency: need NICU for premature birth in rural Rajasthan"

"Find ICU beds near rural Bihar with 24/7 surgical staff"
```

---

## 📊 Scoring Breakdown

| Category | Weight | What We Built |
|----------|--------|---------------|
| Discovery & Verification | 35% | Agent double-checks claims, flags contradictions |
| Intelligent Document Parsing | 30% | Semantic embeddings + Claude reasoning on messy notes |
| Social Impact & Utility | 25% | Medical desert map, NGO-ready summaries |
| UX & Transparency | 10% | Chain of Thought display, trust score explanations |

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| Python + FastAPI | Backend agent & REST API |
| ChromaDB | Vector database for semantic search |
| Google Gemini API | Reasoning, extraction, trust scoring |
| Sentence Transformers | Free local embeddings |
| Folium | Interactive India map |
| Next.js | Frontend UI |
| Pandas | Excel processing |

---

## 🏆 Stretch Goals Implemented

- [x] **Agentic Traceability** — Row-level citations for every recommendation
- [x] **Self-Correction Loops** — Validator agent cross-references primary agent output
- [x] **Dynamic Crisis Mapping** — Interactive map with medical desert highlighting
- [x] **Confidence Scoring** — Statistical framing of data quality per region

---

## 🌏 Why It Matters

In a country of 1.4 billion people, a postal code determines a lifespan. This system turns a static list of 10,000 buildings into a **living intelligence network** — one that knows where the help is and where it urgently needs to go.

---

*Built for MIT Hackathon Challenge 03 — Serving A Nation*
