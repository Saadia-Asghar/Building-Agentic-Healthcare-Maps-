# Run in this exact order

Step 1:  `cd backend && pip install -r requirements.txt`
Step 2:  `python warmup.py`
Step 3:  `python load_data.py --file ../data/VF_Hackathon_Dataset_India_Large.xlsx`  
         (takes 10-15 min, runs once)
Step 4:  `python generate_map.py`
Step 5:  `uvicorn main:app --reload --port 8000`
Step 6:  Open new terminal -> `cd frontend && npm install && npm run dev`
Step 7:  Open browser -> `http://localhost:3000`
Step 8:  For MLflow: open new terminal -> `mlflow ui --port 5000`
