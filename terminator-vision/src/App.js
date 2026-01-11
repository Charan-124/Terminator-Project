import React, { useState } from 'react';
import TerminatorHUD from './components/TerminatorHUD';
import './components/Terminator.css'; // Ensure styles are loaded

function App() {
  const [systemActive, setSystemActive] = useState(false);

  return (
    <div className="App">
      {!systemActive ? (
        // --- INTRO SCREEN ---
        <div className="t-intro-container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '3rem', margin: 0 }}>SKYNET CORP</h1>
            <p style={{ letterSpacing: '5px', opacity: 0.7 }}>NEURAL DEFENSE SYSTEM</p>
          </div>
          
          <div style={{ width: '300px', height: '2px', background: '#00ff00', margin: '20px 0', boxShadow: '0 0 10px #00ff00' }}></div>
          
          <div style={{ fontFamily: 'monospace', textAlign: 'left', marginBottom: '3rem', fontSize: '0.9rem', opacity: 0.8 }}>
             CHECKING KERNEL.......... OK<br/>
             LOADING NEURAL NET....... OK<br/>
             OPTICAL SENSORS.......... ONLINE<br/>
            WEAPON SYSTEMS........... STANDBY
          </div>

          <button className="t-btn-init" onClick={() => setSystemActive(true)}>
            INITIALIZE SYSTEM
          </button>
        </div>
      ) : (
        // --- MAIN HUD ---
        <TerminatorHUD />
      )}
    </div>
  );
}

export default App;