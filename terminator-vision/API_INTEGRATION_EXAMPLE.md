// Example: How to update your React component to use the Vercel API

// ===== BEFORE (Local Development) =====
// const API_URL = "http://localhost:8000";

// ===== AFTER (Vercel Deployment Ready) =====
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ===== Example Usage in TerminatorHUD.jsx =====

async function sendFrameToAnalyzer(imageData) {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: imageData }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    // result contains:
    // {
    //   "threat": "SAFE" | "CAUTION" | "DANGER",
    //   "objects": [{"class": "person", "confidence": 0.95}, ...],
    //   "count": 1
    // }

    return result;
  } catch (error) {
    console.error("API Error:", error);
    return { threat: "SAFE", error: error.message };
  }
}

// ===== Usage in Video Capture =====
// Example: Capturing video frame and sending to API

function captureAndAnalyze(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0);
  
  // Convert to base64
  const imageData = canvas.toDataURL("image/jpeg", 0.8); // 0.8 = quality
  
  // Send to API
  sendFrameToAnalyzer(imageData).then((result) => {
    console.log("Threat Level:", result.threat);
    
    // Update UI based on threat level
    if (result.threat === "DANGER") {
      // Play alarm, show red screen, etc.
    } else if (result.threat === "CAUTION") {
      // Show yellow warning
    } else {
      // Show green (safe)
    }
  });
}

// ===== Integration with useEffect =====
// Example: Send frame every 500ms

import { useEffect, useRef, useState } from "react";

function TerminatorHUD() {
  const videoRef = useRef(null);
  const [threatLevel, setThreatLevel] = useState("SAFE");
  const [detectedObjects, setDetectedObjects] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const imageData = videoRef.current.toDataURL("image/jpeg", 0.7);
        
        fetch(`${API_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imageData }),
        })
        .then((res) => res.json())
        .then((data) => {
          setThreatLevel(data.threat);
          setDetectedObjects(data.objects || []);
        })
        .catch((err) => console.error("API call failed:", err));
      }
    }, 500); // Analyze every 500ms

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`hud ${threatLevel.toLowerCase()}`}>
      <video ref={videoRef} style={{ display: "none" }} />
      <div className={`threat-indicator ${threatLevel.toLowerCase()}`}>
        {threatLevel}
      </div>
      <div className="detected-objects">
        {detectedObjects.map((obj, idx) => (
          <div key={idx}>{obj.class} ({(obj.confidence * 100).toFixed(0)}%)</div>
        ))}
      </div>
    </div>
  );
}

export default TerminatorHUD;
