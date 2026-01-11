from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import base64

app = FastAPI()

# --- 1. CORS SETTINGS (Crucial for Vercel Connection) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. LOAD AI MODEL ---
try:
    model = YOLO('yolov8n.pt') 
    print("✅ AI Model Loaded Successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")

# --- 3. THREAT LOGIC (Customize this!) ---

THREAT_MAP = {
    "person": "SAFE",          # Humans are now SAFE (Screen stays Green)
    "cell phone": "DANGER",    # Phones trigger RED ALERT (Easy to test)
    "bottle": "CAUTION",       # Bottles trigger YELLOW ALERT
    "cup": "CAUTION",
    "knife": "DANGER",
    "scissors": "DANGER",
    "gun": "DANGER"
}

@app.post("/analyze")
async def analyze_frame(request: Request):
    try:
        # A. Receive Data
        data = await request.json()
        image_data = data.get('image')

        if not image_data:
            return {"threat": "SAFE", "label": "NO DATA"}

        # B. Decode Image (Base64 -> OpenCV)
        encoded_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # C. Run YOLO AI
        results = model(frame, verbose=False)
        
        highest_threat = "SAFE"
        detected_label = "SCANNING..."

        # --- DEBUG PRINT: Shows exactly what YOLO sees in Render Logs ---
        detections = [model.names[int(b.cls[0])] for r in results for b in r.boxes]
        if len(detections) > 0:
            print(f"👀 AI SEES: {detections}")  # Look for this in Render Logs!
        # ---------------------------------------------------------------

        # D. Check Threats
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                
                # Check threat map
                threat = THREAT_MAP.get(label, "SAFE")
                
                # Logic: DANGER > CAUTION > SAFE
                if threat == "DANGER":
                    highest_threat = "DANGER"
                    detected_label = label.upper()
                    break # Stop looking, we found a danger
                
                elif threat == "CAUTION" and highest_threat != "DANGER":
                    highest_threat = "CAUTION"
                    detected_label = label.upper()
                
                elif threat == "SAFE" and highest_threat == "SAFE":
                    detected_label = label.upper()

        return {"threat": highest_threat, "label": detected_label}

    except Exception as e:
        print(f"❌ SERVER ERROR: {e}")
        return {"threat": "SAFE", "label": "ERROR"}

# Needed for Render to start the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)