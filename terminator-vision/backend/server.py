from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from ultralytics import YOLO


app = FastAPI()
model = YOLO('yolov8n.pt') 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImagePayload(BaseModel):
    image: str

THREAT_MAP = {
    "person": "SAFE",          
    "cell phone": "CAUTION",   
    "knife": "DANGER",         
    "scissors": "DANGER",      
    "cup": "SAFE",
    "bottle": "SAFE"
}

@app.post("/analyze")
async def analyze_frame(payload: ImagePayload):
    try:
        header, encoded = payload.image.split(",", 1)
        data = base64.b64decode(encoded)
        np_arr = np.frombuffer(data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        results = model(frame, verbose=False)
        
        highest_threat = "SAFE"
        detected_label = "SCANNING..."
        
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                class_name = model.names[cls_id]
                threat = THREAT_MAP.get(class_name, "SAFE")

                if threat == "DANGER":
                    highest_threat = "DANGER"
                    detected_label = class_name.upper()
                elif threat == "CAUTION" and highest_threat != "DANGER":
                    highest_threat = "CAUTION"
                    detected_label = class_name.upper()

        return {"threat": highest_threat, "label": detected_label}

    except Exception as e:
        print(f"Error: {e}")
        return {"threat": "SAFE", "label": "ERROR"}