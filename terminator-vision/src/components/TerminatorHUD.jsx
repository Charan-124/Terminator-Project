import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Cpu, Wifi, Activity, ShieldAlert, ShieldCheck, AlertTriangle, Camera, CameraOff } from 'lucide-react';
import './Terminator.css';

const TerminatorHUD = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [logs, setLogs] = useState([]);
  
  // States
  const [threatLevel, setThreatLevel] = useState('SAFE');
  const [targetLabel, setTargetLabel] = useState('SCANNING...');
  const [isCameraOn, setIsCameraOn] = useState(true);

  // --- 1. Dynamic Color Logic ---
  const getTheme = () => {
    switch (threatLevel) {
      case 'SAFE':
        return { color: '#00ff00', hue: '90deg', label: 'SYSTEM SAFE', icon: <ShieldCheck size={16} /> };
      case 'CAUTION':
        return { color: '#ffff00', hue: '40deg', label: 'CAUTION', icon: <AlertTriangle size={16} /> };
      case 'DANGER':
      default:
        return { color: '#ff0000', hue: '-50deg', label: 'THREAT DETECTED', icon: <ShieldAlert size={16} /> };
    }
  };
  const theme = getTheme();

  // Apply CSS Variables
  useEffect(() => {
    document.documentElement.style.setProperty('--hud-color', theme.color);
    document.documentElement.style.setProperty('--hue-rotate', theme.hue);
  }, [threatLevel, theme]);

  // --- 2. Logs & Time ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
      const hex = Math.random().toString(16).substr(2, 8).toUpperCase();
      const newLog = `SYS_CORE_${threatLevel}: 0x${hex} // ${isCameraOn ? 'PROCESSING...' : 'OFFLINE'}`;
      setLogs(prev => [newLog, ...prev.slice(0, 5)]);
    }, 800);
    return () => clearInterval(interval);
  }, [threatLevel, isCameraOn]);

  // --- 3. Camera Start/Stop Logic ---
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera Error:", err);
        setIsCameraOn(false);
      }
    };
    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (isCameraOn) startCamera();
    else stopCamera();

    return () => stopCamera();
  }, [isCameraOn]);

  // --- 4. Python Connection Loop (FIXED) ---
  useEffect(() => {
    // Define the function inside useEffect to fix dependency warning
    const analyzeFrame = async () => {
      if (!videoRef.current || !canvasRef.current || !isCameraOn) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Ensure video has loaded data before drawing
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = canvas.toDataURL('image/jpeg', 0.5);

          try {
              // Send to Python Backend
              const response = await fetch('http://127.0.0.1:8000/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image: imageData }),
              });

              if (response.ok) {
                  const data = await response.json();
                  console.log("AI Response:", data); // Check Console for this!
                  setThreatLevel(data.threat);
                  setTargetLabel(data.label);
              }
          } catch (error) {
              console.warn("Backend disconnected. Is server.py running?");
          }
      }
    };

    // Run the loop every 500ms
    const intervalId = setInterval(analyzeFrame, 500);
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [isCameraOn]); // Re-run only if camera state changes


  return (
    <div className="t-container">
      {/* Hidden Canvas for Image Processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Video Layer */}
      {isCameraOn ? (
        <video ref={videoRef} autoPlay playsInline muted className="t-video-layer" />
      ) : (
        <div className="t-video-layer" style={{ 
            background: `repeating-linear-gradient(0deg, transparent, transparent 2px, #111 2px, #111 4px), black`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="t-icon-pulse" style={{ fontSize: '2rem', letterSpacing: '5px', opacity: 0.5 }}>
                {'// OPTICAL SENSOR OFFLINE //'}
            </div>
        </div>
      )}

      {/* Overlays */}
      <div className="t-grid-overlay"></div>
      <div className="t-scan-bar"></div>

      {/* UI Layer */}
      <div className="t-ui-layer">
        
        {/* Header */}
        <div className="t-header">
          <div className="t-header-block">
            <h1 className="t-header-title">SKYNET_OS v8.2</h1>
            <p className="t-header-subtitle">
              {`MODE: ${threatLevel} // TARGET: ${targetLabel}`}
            </p>
          </div>

          <div className="t-interactive flex flex-col items-end gap-2">
             <button onClick={() => setIsCameraOn(!isCameraOn)} style={{
                 display: 'flex', alignItems: 'center', gap: '5px',
                 background: 'black', color: theme.color, 
                 border: `1px solid ${theme.color}`, padding: '5px 15px', 
                 cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
               }}>
                {isCameraOn ? <Camera size={14} /> : <CameraOff size={14} />}
                {isCameraOn ? 'CAM: ON' : 'CAM: OFF'}
             </button>
          </div>

          <div className="t-stats-row">
            <div className="t-stat-item"><Wifi size={24} className={isCameraOn ? "t-icon-pulse" : ""} /><span style={{fontSize:'10px'}}>UPLINK</span></div>
            <div className="t-stat-item"><Cpu size={24} className="t-icon-pulse" /><span style={{fontSize:'10px'}}>CPU</span></div>
          </div>
        </div>

        {/* Reticle & Target Box (Only if Camera is ON) */}
        {isCameraOn && (
          <>
            <div className="t-reticle-container">
               <Crosshair className="t-reticle-spin" />
               <div className="t-reticle-center"><div className="t-dot"></div></div>
            </div>

            <div className="t-target-box">
                <div className="t-target-label">{theme.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.color, marginBottom: '4px' }}>
                    {theme.icon}
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {threatLevel === 'SAFE' ? 'NO THREATS' : threatLevel === 'CAUTION' ? 'SUSPICIOUS OBJECT' : 'LETHAL FORCE AUTHORIZED'}
                    </span>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    OBJ: {targetLabel}<br/>
                    CONFIDENCE: {threatLevel === 'SAFE' ? '100%' : '98.2%'}
                </div>
                <div className="t-corner tl"></div><div className="t-corner tr"></div>
                <div className="t-corner bl"></div><div className="t-corner br"></div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="t-footer">
          <div className="t-log-box">
             <div className="t-log-title"><Activity size={18} /><span>SYSTEM LOGS</span></div>
             <div className="t-log-list">
                {logs.map((log, i) => <div key={i}>{`> ${log}`}</div>)}
             </div>
          </div>
          <div className="t-footer-info">
             <div className="t-time-big">{time}</div>
             <div style={{ letterSpacing: '2px', fontSize: '12px' }}>SECURE CONNECTION</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TerminatorHUD;