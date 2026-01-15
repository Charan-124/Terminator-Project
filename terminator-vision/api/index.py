from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os

app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load AI Model ---
try:
    model = YOLO('yolov8n.pt')
    print("✅ AI Model Loaded Successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

# --- Threat Mapping ---
THREAT_MAP = {
    "person": "SAFE",
    "cell phone": "CAUTION",
    "bottle": "CAUTION",
    "cup": "CAUTION",
    "knife": "DANGER",
    "scissors": "DANGER",
    "gun": "DANGER"
}

# --- Health Check Endpoint ---
@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "loaded" if model else "not_loaded"}

# --- Main Analysis Endpoint ---
@app.post("/api/analyze")
async def analyze_frame(request: Request):
    try:
        # Receive data
        data = await request.json()
        image_data = data.get('image')

        if not image_data:
            return {"threat": "SAFE", "label": "NO DATA"}

        # Decode image (Base64 -> OpenCV)
        try:
            encoded_data = image_data.split(',')[1] if ',' in image_data else image_data
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as decode_error:
            return {"threat": "SAFE", "error": f"Decode error: {str(decode_error)}"}

        if frame is None:
            return {"threat": "SAFE", "label": "INVALID IMAGE"}

        # Run inference
        if not model:
            return {"threat": "SAFE", "error": "Model not loaded"}

        results = model(frame, conf=0.5)
        detections = results[0].boxes.data.cpu().numpy()

        threat_level = "SAFE"
        detected_objects = []

        for detection in detections:
            class_id = int(detection[5])
            class_name = model.names[class_id]
            confidence = float(detection[4])
            
            detected_objects.append({
                "class": class_name,
                "confidence": round(confidence, 2)
            })

            threat = THREAT_MAP.get(class_name, "SAFE")
            if threat == "DANGER":
                threat_level = "DANGER"
            elif threat == "CAUTION" and threat_level != "DANGER":
                threat_level = "CAUTION"

        return {
            "threat": threat_level,
            "objects": detected_objects,
            "count": len(detected_objects)
        }

    except Exception as e:
        return {"threat": "SAFE", "error": str(e)}

# --- Vercel Serverless Handler ---
from mangum import Mangum

handler = Mangum(app)
