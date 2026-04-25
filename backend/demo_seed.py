"""
demo_seed.py — P8: Seed 20 hardcoded facilities for offline demo mode.

Usage:
    python demo_seed.py           # Load demo data into ChromaDB
    GET /api/demo-mode?enable=true  # Switch agent to demo collection
"""
import chromadb
from chromadb.utils import embedding_functions

DEMO_FACILITIES = [
    # ── HIGH TRUST (5) ──────────────────────────────────────────────────────
    {
        "facility_name": "Patna Medical College & Hospital",
        "state": "Bihar", "district": "Patna", "pin_code": "800004",
        "facility_type": "Government Tertiary",
        "trust_score": 92,
        "notes": "Full ICU with 12 ventilators and continuous monitoring. "
                 "Resident anesthesiologist on-site 24/7. NICU with 8 incubators "
                 "and neonatologist. Blood bank with 24hr refrigerated storage. "
                 "Advanced surgery including cardiac, neuro, and orthopedic. "
                 "Oncology department with chemotherapy and radiation unit.",
    },
    {
        "facility_name": "Ram Manohar Lohia Hospital",
        "state": "Uttar Pradesh", "district": "Lucknow", "pin_code": "226010",
        "facility_type": "Government Tertiary",
        "trust_score": 88,
        "notes": "ICU with 20 beds, ventilators, and cardiac monitoring. "
                 "Emergency trauma center with 2 trauma surgeons available round the clock. "
                 "Dialysis unit with 6 machines. Specialist doctors across 18 departments. "
                 "Blood bank operational 24 hours. Ambulance fleet for rural pickup.",
    },
    {
        "facility_name": "SMS Medical College",
        "state": "Rajasthan", "district": "Jaipur", "pin_code": "302004",
        "facility_type": "Government Tertiary",
        "trust_score": 90,
        "notes": "Premier regional hospital. NICU with trained neonatologist and 12 incubators. "
                 "Radiation oncology with linear accelerator. MRI and CT scan 24/7. "
                 "Anesthesiology department with 4 consultants. "
                 "Burns unit, dialysis (10 machines), and renal transplant capability.",
    },
    {
        "facility_name": "Rajendra Institute of Medical Sciences",
        "state": "Jharkhand", "district": "Ranchi", "pin_code": "834009",
        "facility_type": "Government Tertiary",
        "trust_score": 85,
        "notes": "ICU with ventilators and oxygen supply confirmed operational. "
                 "Surgical complex with OT and resident anesthesiologist. "
                 "Oncology outpatient services, chemotherapy administered on-site. "
                 "24/7 emergency with trauma team and orthopedic surgeon.",
    },
    {
        "facility_name": "SCB Medical College",
        "state": "Odisha", "district": "Cuttack", "pin_code": "753007",
        "facility_type": "Government Tertiary",
        "trust_score": 87,
        "notes": "Largest hospital in Odisha. ICU 30 beds with ventilators. "
                 "NICU with 15 incubators and 2 neonatologists on staff. "
                 "Blood bank 24hr with refrigerated component therapy. "
                 "Dialysis unit 8 machines. Cardiac catheterization lab.",
    },

    # ── MEDIUM TRUST — one flag each (5) ─────────────────────────────────────
    {
        "facility_name": "District Hospital Muzaffarpur",
        "state": "Bihar", "district": "Muzaffarpur", "pin_code": "842001",
        "facility_type": "Government District",
        "trust_score": 68,
        "notes": "Claims ICU facility with oxygen supply. Monitoring equipment listed "
                 "but ventilator availability not confirmed in last audit. "
                 "Surgery department with general surgeon. Part-time anesthesiologist visits "
                 "three days per week. Blood bank operational during daytime only.",
    },
    {
        "facility_name": "Community Health Centre Bahraich",
        "state": "Uttar Pradesh", "district": "Bahraich", "pin_code": "271801",
        "facility_type": "Government CHC",
        "trust_score": 61,
        "notes": "Basic surgical facility. Claims 24/7 availability but staffed by "
                 "visiting doctors on rotation. Emergency OPD open round the clock. "
                 "No specialist listed on permanent staff. Oxygen cylinders available. "
                 "Maternity ward functional, no NICU equipment confirmed.",
    },
    {
        "facility_name": "Private Nursing Home Deoghar",
        "state": "Jharkhand", "district": "Deoghar", "pin_code": "814112",
        "facility_type": "Private Nursing Home",
        "trust_score": 58,
        "notes": "Small private nursing home. Claims dialysis services — one machine listed "
                 "but nephrologist visits only twice weekly. General physician on-site daily. "
                 "X-ray and basic lab available. Refers critical cases to Ranchi.",
    },
    {
        "facility_name": "Taluka Hospital Barmer",
        "state": "Rajasthan", "district": "Barmer", "pin_code": "344001",
        "facility_type": "Government Taluka",
        "trust_score": 63,
        "notes": "Functional OPD and minor surgery. No oncology specialist. "
                 "Claims emergency trauma care but trauma surgeon last posted in 2022. "
                 "Ambulance available. Oxygen supply maintained. "
                 "Maternity services available with trained midwife.",
    },
    {
        "facility_name": "Sub-District Hospital Malkangiri",
        "state": "Odisha", "district": "Malkangiri", "pin_code": "764048",
        "facility_type": "Government Sub-District",
        "trust_score": 55,
        "notes": "Remote tribal area hospital. Basic OPD services. Claims blood bank — "
                 "however last inspection noted storage refrigerator non-functional. "
                 "One general doctor on duty. Surgical capacity limited. "
                 "Patients requiring ICU transferred 280km to Koraput.",
    },

    # ── LOW TRUST — contradictions (5) ───────────────────────────────────────
    {
        "facility_name": "Shree Nursing Home Araria",
        "state": "Bihar", "district": "Araria", "pin_code": "854311",
        "facility_type": "Private Nursing Home",
        "trust_score": 28,
        "notes": "Claims Advanced Surgical Center and ICU. "
                 "No anesthesiologist listed anywhere in staff records. "
                 "No ventilator mentioned. OT listed but last operational status unknown. "
                 "Doctor roster shows general physician only. Claims 24/7 but "
                 "registration documents list visiting hours 9am-5pm.",
    },
    {
        "facility_name": "Modern Medical Centre Pakur",
        "state": "Jharkhand", "district": "Pakur", "pin_code": "816107",
        "facility_type": "Private Clinic",
        "trust_score": 22,
        "notes": "Advertises full ICU, NICU, and Emergency Trauma Center. "
                 "Staff list shows one MBBS doctor and two nurses. "
                 "No neonatologist, no trauma surgeon, no anesthesiologist found. "
                 "Blood bank claimed — no refrigeration infrastructure listed. "
                 "Likely a basic OPD clinic with overstated capabilities.",
    },
    {
        "facility_name": "Apex Hospital Sheohar",
        "state": "Bihar", "district": "Sheohar", "pin_code": "843329",
        "facility_type": "Private Hospital",
        "trust_score": 31,
        "notes": "Claims dialysis unit and oncology department. "
                 "No dialysis machine listed in equipment inventory. "
                 "No nephrologist or oncologist on staff. "
                 "Advanced surgery claimed but operation theatre unverified. "
                 "24/7 emergency claimed — on-call doctor arrangement only.",
    },
    {
        "facility_name": "City Care Hospital Bijapur",
        "state": "Chhattisgarh", "district": "Bijapur", "pin_code": "494444",
        "facility_type": "Private Hospital",
        "trust_score": 19,
        "notes": "Claims complete tertiary care including ICU, NICU, oncology, "
                 "trauma surgery, and dialysis. Staff: 2 doctors, 4 nurses. "
                 "No specialist of any kind listed. Equipment: basic BP monitor, stethoscope. "
                 "Website claims 500-bed hospital — local records show 12 beds. "
                 "Multiple contradictions detected across all service claims.",
    },
    {
        "facility_name": "Welfare Hospital Dhubri",
        "state": "Assam", "district": "Dhubri", "pin_code": "783301",
        "facility_type": "Private Nursing Home",
        "trust_score": 35,
        "notes": "Claims ICU and advanced surgical capabilities. "
                 "Oxygen cylinder listed but no ventilator or cardiac monitor found. "
                 "Surgery claimed — anesthesiologist not on staff, visiting arrangements unclear. "
                 "Blood bank: refrigerator listed but certification not mentioned. "
                 "Mostly handles OPD and minor procedures based on discharge records.",
    },

    # ── MEDICAL DESERT — critical gaps (5) ───────────────────────────────────
    {
        "facility_name": "PHC Gadchiroli Forest Block",
        "state": "Maharashtra", "district": "Gadchiroli", "pin_code": "442605",
        "facility_type": "Government PHC",
        "trust_score": 72,
        "notes": "Primary Health Centre serving 45,000 tribal population in forest area. "
                 "No ICU, no surgery, no dialysis within 180km. "
                 "One doctor, two ANMs. Basic medicines and OPD only. "
                 "Nearest hospital with ICU is Nagpur — 6-hour journey on unpaved road. "
                 "Maternal mortality high due to lack of emergency obstetric care.",
    },
    {
        "facility_name": "PHC Sukma Remote",
        "state": "Chhattisgarh", "district": "Sukma", "pin_code": "494111",
        "facility_type": "Government PHC",
        "trust_score": 69,
        "notes": "Serves remote Maoist-affected area. Road access seasonal. "
                 "No specialist available. No blood bank within 120km. "
                 "Basic OPD and immunization only. Trauma cases must be airlifted. "
                 "Last surgical procedure performed here was 2019. "
                 "Serious cases travel 4-5 hours to Jagdalpur.",
    },
    {
        "facility_name": "CHC Washim Rural",
        "state": "Maharashtra", "district": "Washim", "pin_code": "444505",
        "facility_type": "Government CHC",
        "trust_score": 58,
        "notes": "Community Health Centre without specialist doctors since 2021. "
                 "No oncology, no dialysis, no ICU. Claims 24/7 emergency — "
                 "one doctor covers 24 hours for 3 consecutive days. "
                 "No NICU — premature babies referred to Akola 90km away. "
                 "Farmer suicides in region — no psychiatric services available.",
    },
    {
        "facility_name": "Sub-Centre Naxalbari Corridor",
        "state": "West Bengal", "district": "Darjeeling", "pin_code": "734429",
        "facility_type": "Government Sub-Centre",
        "trust_score": 75,
        "notes": "Sub-centre in tea-garden worker community. One ANM only. "
                 "No doctor, no medicines beyond basic kit. No blood bank within 60km. "
                 "Tea garden workers have no transport for emergencies. "
                 "Malaria and TB cases common — no diagnostic lab. "
                 "Nearest hospital Siliguri 55km — no ambulance service from village.",
    },
    {
        "facility_name": "PHC Kalahandi Tribal Block",
        "state": "Odisha", "district": "Kalahandi", "pin_code": "766001",
        "facility_type": "Government PHC",
        "trust_score": 66,
        "notes": "Serves 12 villages. One doctor, intermittent. "
                 "No dialysis within 200km. Cancer patients go undiagnosed for months. "
                 "No ICU in entire district — all critical cases to Bhawanipatna. "
                 "Sickle cell disease prevalent in tribal population — no specialist. "
                 "Water-borne disease season overloads the facility annually.",
    },
]


def seed_demo():
    client = chromadb.PersistentClient(path="./chroma_db")
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    try:
        client.delete_collection("demo_facilities")
    except Exception:
        pass

    col = client.create_collection(
        name="demo_facilities",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    docs, metas, ids = [], [], []
    for i, f in enumerate(DEMO_FACILITIES):
        doc = (
            f"Facility: {f['facility_name']}\n"
            f"State: {f['state']} | District: {f['district']} | PIN: {f['pin_code']}\n"
            f"Type: {f['facility_type']}\n"
            f"Notes: {f['notes']}"
        )
        docs.append(doc)
        metas.append({
            "facility_name": f["facility_name"],
            "state": f["state"],
            "district": f["district"],
            "pin_code": f["pin_code"],
            "facility_type": f["facility_type"],
            "trust_score": str(f["trust_score"]),
            "latitude": "",
            "longitude": "",
            "row_index": str(i),
        })
        ids.append(f"demo_{i}")

    col.add(documents=docs, metadatas=metas, ids=ids)
    print(f"✅ Demo mode ready — {len(DEMO_FACILITIES)} facilities seeded.")
    print("   Toggle via: GET /api/demo-mode?enable=true")


if __name__ == "__main__":
    seed_demo()
