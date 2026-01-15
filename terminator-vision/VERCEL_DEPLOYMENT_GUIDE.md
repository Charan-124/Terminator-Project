# Vercel Deployment Guide: Terminator Vision

This guide covers deploying your **React frontend** and **Python FastAPI backend** to Vercel.

---

## 📋 Overview

Your project has two parts:
- **Frontend**: React app (in root, built to `build/` or `dist/`)
- **Backend**: Python FastAPI server (in `/backend`)

**Deployment Strategy:**
- ✅ Frontend → Vercel (automatic, easy)
- ✅ Backend → Vercel Serverless Functions (Python support)
- ✅ Auto-deploy on git push

---

## 🚀 Step 1: Prepare Your Project

### 1a. Verify Project Structure
```
terminator-vision/
├── package.json (Frontend deps)
├── pnpm-lock.yaml
├── public/
├── src/
├── build/ (or dist/ — production build)
├── backend/
│   ├── requirements.txt
│   ├── server.py
│   └── yolov8n.pt
└── vercel.json (← Create this)
```

### 1b. Create Vercel Configuration

Create `/terminator-vision/vercel.json` at the root:

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "build",
  "framework": "react",
  "env": {
    "REACT_APP_API_URL": "@react-app-api-url"
  },
  "functions": {
    "backend/**": {
      "runtime": "python3.11",
      "memory": 3008,
      "maxDuration": 60
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/api.py"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html",
      "status": 200
    }
  ]
}
```

### 1c. Update Frontend Environment Variables

Update your React code to use the Vercel API URL. In your component (e.g., `TerminatorHUD.jsx`):

```javascript
// OLD: hardcoded
// const API_URL = "http://localhost:8000";

// NEW: environment-aware
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Use API_URL in your fetch calls:
fetch(`${API_URL}/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image: imageData })
})
```

### 1d. Create Python Serverless Function

Create `/api/analyze.py` (Vercel looks for functions in the `api/` folder):

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Model (cached in Vercel)
try:
    model = YOLO('yolov8n.pt')
    print("✅ Model Loaded")
except Exception as e:
    print(f"❌ Error: {e}")

THREAT_MAP = {
    "person": "SAFE",
    "cell phone": "CAUTION",
    "bottle": "CAUTION",
    "cup": "CAUTION",
    "knife": "DANGER",
    "scissors": "DANGER",
    "gun": "DANGER"
}

@app.post("/api/analyze")
async def analyze_frame(request: Request):
    try:
        data = await request.json()
        image_data = data.get('image')

        if not image_data:
            return {"threat": "SAFE", "label": "NO DATA"}

        # Decode image
        encoded_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Run inference
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

# Vercel Serverless handler
from fastapi import FastAPI
from mangum import Mangum

handler = Mangum(app)
```

### 1e. Update Backend Requirements for Vercel

Update `/backend/requirements.txt` to include serverless support:

```txt
fastapi
uvicorn
ultralytics
opencv-python-headless
numpy
pydantic
python-multipart
mangum
```

> **Note:** `mangum` is the ASGI-to-Lambda adapter that allows FastAPI to run on Vercel.

---

## 🔧 Step 2: Configure Git & Push to GitHub

### 2a. Initialize Git (if not already done)
```bash
cd /Users/charanjitsingh/Desktop/Project-1/terminator-vision
git init
git add .
git commit -m "Initial commit: React frontend + Python backend"
```

### 2b. Push to GitHub
```bash
git remote add origin https://github.com/Charan-124/Terminator-Project.git
git branch -M main
git push -u origin main
```

---

## 🌐 Step 3: Deploy to Vercel

### 3a. Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Authorize Vercel to access your GitHub repos

### 3b. Import Project
1. Click **"Add New..."** → **"Project"**
2. Select your GitHub repo: `Terminator-Project`
3. Vercel auto-detects it as a React project
4. **Configure:**
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `build`
   - **Root Directory:** `./` (or leave blank)

### 3c. Set Environment Variables
In the Vercel dashboard, go to **Settings → Environment Variables**:

```
REACT_APP_API_URL = https://your-project.vercel.app
```

This tells your frontend where to find the backend API.

### 3d. Deploy
Click **Deploy** and wait 2–5 minutes.

---

## 🔌 Step 4: Connect Frontend to Backend

Update your `TerminatorHUD.jsx` or wherever you call the API:

```javascript
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Example fetch call
async function sendFrame(imageData) {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: imageData })
    });
    
    const result = await response.json();
    console.log("Threat Level:", result.threat);
    return result;
  } catch (error) {
    console.error("API Error:", error);
    return { threat: "SAFE" };
  }
}
```

---

## ⚙️ Step 5: Handle Model File (`yolov8n.pt`)

### ⚠️ Problem:
The YOLO model is **~26 MB**. Vercel has limits:
- **Max function size:** 250 MB (uncompressed)
- **Deploy time:** Should be OK, but may take time

### Solution Options:

#### Option A: Download Model at Runtime (Recommended)
Update `/api/analyze.py`:
```python
from ultralytics import YOLO

# First run: downloads ~26 MB, cached after
model = YOLO('yolov8n.pt')  # Auto-downloads if not found
```
YOLO will auto-download on first request. **Downside:** First request is slow (~30s).

#### Option B: Compress & Include
```bash
# On your machine (optional)
tar -czf yolov8n.pt.tar.gz backend/yolov8n.pt
# Upload to Vercel (if size allows)
```

#### Option C: Use External Storage (S3)
```python
import urllib.request
urllib.request.urlretrieve(
    "https://your-bucket.s3.amazonaws.com/yolov8n.pt",
    "/tmp/yolov8n.pt"
)
model = YOLO('/tmp/yolov8n.pt')
```

**👉 Recommended:** Use Option A (auto-download) for simplicity.

---

## 📦 Step 6: Verify Deployment

### Test Frontend
```
https://your-project.vercel.app
```
You should see your React app.

### Test API
```bash
curl -X POST https://your-project.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'
```

---

## 🐛 Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'ultralytics'"
**Solution:** Ensure `requirements.txt` is in `/backend/` and Vercel picks it up.

### Issue: API returns 404
**Solution:** 
1. Check `vercel.json` routes are correct
2. Ensure `/api/analyze.py` exists
3. Frontend URL matches deployment URL

### Issue: Model download timeout
**Solution:**
- Increase `maxDuration` in `vercel.json` to 60s
- Or pre-download model and include in repo

### Issue: CORS errors in browser
**Solution:** Already handled in your FastAPI code with `CORSMiddleware`.

---

## 📝 Local Testing Before Deploy

### 1. Test Frontend Build Locally
```bash
cd /Users/charanjitsingh/Desktop/Project-1/terminator-vision
pnpm run build
pnpm install -g serve
serve -s build
```
Open `http://localhost:3000`

### 2. Test Backend Locally
```bash
cd backend
pip install -r requirements.txt
python server.py
```
In another terminal, test the API:
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'
```

---

## 🚀 Final Checklist

- [ ] `vercel.json` created at project root
- [ ] `/api/analyze.py` created with FastAPI handler
- [ ] `mangum` added to `requirements.txt`
- [ ] Frontend updated to use `REACT_APP_API_URL` env var
- [ ] GitHub repo connected to Vercel
- [ ] Environment variables set in Vercel dashboard
- [ ] Initial deployment successful
- [ ] Frontend + API communication tested

---

## 💡 Next Steps

1. **Monitor Performance:** Check Vercel dashboard for function duration, memory usage
2. **Optimize:** Consider caching model, reducing image size before sending
3. **Scale:** If you hit Vercel limits, consider Railway.app or Render.com for Python backend
4. **CI/CD:** Auto-deployments are enabled when you push to `main` branch

---

## 📞 Support

- **Vercel Docs:** https://vercel.com/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **YOLO Docs:** https://docs.ultralytics.com/

Good luck! 🎉
