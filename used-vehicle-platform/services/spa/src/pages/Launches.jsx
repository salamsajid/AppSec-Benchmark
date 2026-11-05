import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtPrice } from '../api.js';

export default function Launches() {
  const [launches, setLaunches] = useState([]);
  const [selectedLaunch, setSelectedLaunch] = useState(null);
  const [activeAngle, setActiveAngle] = useState(45);
  const [selectedColor, setSelectedColor] = useState(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioMode, setAudioMode] = useState('');
  const [studioLightMode, setStudioLightMode] = useState('midnight'); // 'midnight' | 'daylight' | 'neon'
  const [headlightsOn, setHeadlightsOn] = useState(true);
  const [activeAeroOn, setActiveAeroOn] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    deliveryCenter: 'Stratos Silicon Valley Flagship',
  });
  const [reservationResult, setReservationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Drag-to-rotate interaction
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const angleAtDragStartRef = useRef(0);

  // Audio Context for synthetic hypercar engine & EV whines
  const audioCtxRef = useRef(null);

  useEffect(() => {
    fetchLaunches();
  }, []);

  const fetchLaunches = async () => {
    try {
      const res = await api('/api/catalog/v1/launches/upcoming');
      if (res.data && res.data.ok && res.data.launches) {
        setLaunches(res.data.launches);
        setSelectedLaunch(res.data.launches[0]);
        if (res.data.launches[0].colors && res.data.launches[0].colors.length > 0) {
          setSelectedColor(res.data.launches[0].colors[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load launches:', err);
    }
  };

  // Auto-rotation timer
  useEffect(() => {
    let timer;
    if (isAutoRotating) {
      timer = setInterval(() => {
        setActiveAngle((prev) => (prev + 45) % 360);
      }, 1400);
    }
    return () => clearInterval(timer);
  }, [isAutoRotating]);

  const handleSelectLaunch = (launch) => {
    setSelectedLaunch(launch);
    setActiveAngle(45);
    setIsAutoRotating(false);
    setActiveHotspot(null);
    if (launch.colors && launch.colors.length > 0) {
      setSelectedColor(launch.colors[0]);
    }
  };

  // Drag interaction
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    angleAtDragStartRef.current = activeAngle;
    setIsAutoRotating(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const step = Math.floor(deltaX / 35); // 35px per 45 deg step
    let nextAngle = (angleAtDragStartRef.current - step * 45) % 360;
    if (nextAngle < 0) nextAngle += 360;
    // snap to nearest 45
    const snapped = Math.round(nextAngle / 45) * 45 % 360;
    if (snapped !== activeAngle) {
      setActiveAngle(snapped);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Realistic synthesized engine acoustics
  const playSoundProfile = (type) => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      setIsPlayingAudio(true);
      setAudioMode(type);

      const now = ctx.currentTime;
      const isV12 = selectedLaunch?.brand === 'Ferrari';
      const isPorsche = selectedLaunch?.brand === 'Porsche';

      if (isV12) {
        // Ferrari 12Cilindri 9,500 RPM V12 Symphony
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.15);

        if (type === 'rev') {
          // 2,000 -> 9,500 RPM scream
          osc1.frequency.setValueAtTime(120, now);
          osc1.frequency.exponentialRampToValueAtTime(740, now + 1.1);
          osc1.frequency.exponentialRampToValueAtTime(320, now + 2.2);

          osc2.frequency.setValueAtTime(240, now);
          osc2.frequency.exponentialRampToValueAtTime(1480, now + 1.1);
          osc2.frequency.exponentialRampToValueAtTime(640, now + 2.2);

          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 2.4);
          osc2.stop(now + 2.4);
        } else if (type === 'launch') {
          // Launch control bang & upshift
          osc1.frequency.setValueAtTime(350, now);
          osc1.frequency.exponentialRampToValueAtTime(880, now + 0.9);
          osc1.frequency.setValueAtTime(450, now + 0.95); // gear shift drop
          osc1.frequency.exponentialRampToValueAtTime(920, now + 1.9);

          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
          osc1.start(now);
          osc1.stop(now + 2.6);
        } else {
          // V12 Idle Purr
          osc1.frequency.setValueAtTime(75, now);
          osc1.frequency.linearRampToValueAtTime(95, now + 0.8);
          osc1.frequency.linearRampToValueAtTime(75, now + 1.8);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
          osc1.start(now);
          osc1.stop(now + 2.0);
        }
      } else {
        // High-frequency EV 800V harmonic whine & inverter
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.1);

        if (type === 'rev') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 1.0);
          osc.frequency.exponentialRampToValueAtTime(240, now + 2.0);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
          osc.start(now);
          osc.stop(now + 2.2);
        } else if (type === 'launch') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 1.6);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
          osc.start(now);
          osc.stop(now + 2.5);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.linearRampToValueAtTime(140, now + 0.7);
          osc.frequency.linearRampToValueAtTime(110, now + 1.5);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
          osc.start(now);
          osc.stop(now + 1.8);
        }
      }

      setTimeout(() => {
        setIsPlayingAudio(false);
        setAudioMode('');
      }, 2400);
    } catch (e) {
      console.warn('Audio playback error', e);
      setIsPlayingAudio(false);
    }
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    if (!reserveForm.customerName || !reserveForm.customerEmail) {
      setErrorMsg('Please enter your full name and valid email address.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        launchId: selectedLaunch.id,
        customerName: reserveForm.customerName,
        customerEmail: reserveForm.customerEmail,
        customerPhone: reserveForm.customerPhone || 'N/A',
        preferredColor: selectedColor?.name || 'Standard Metallic',
        deliveryCenter: reserveForm.deliveryCenter,
      };
      const res = await api('/api/catalog/v1/launches/reserve', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data && res.data.ok) {
        setReservationResult(res.data.reservation);
      } else {
        setErrorMsg(res.data?.error || 'Reservation could not be submitted.');
      }
    } catch (err) {
      setErrorMsg('Network error while securing VIP reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedLaunch) {
    return (
      <div className="am-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="am-spinner" />
        <p style={{ marginTop: 20, color: '#86868b' }}>Loading Stratos Next-Gen Showroom...</p>
      </div>
    );
  }

  // Calculate current angle frame
  const angleIndex = Math.floor(activeAngle / 45) % 8;
  const currentAngleFrame = selectedLaunch.angleFrames && selectedLaunch.angleFrames[angleIndex];
  const displayImage = currentAngleFrame?.url || selectedLaunch.heroImage;
  const isMirrored = activeAngle === 225 || activeAngle === 270 || activeAngle === 315;

  return (
    <div
      className="am-launches-page"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Hero Headline Section */}
      <section className="am-launches-hero">
        <div className="am-launches-hero-badge">
          <span className="am-pulse-dot" /> 2027 Flagship Previews & 360° RotoStage
        </div>
        <h1 className="am-launches-title">Next-Gen Automotive Architecture</h1>
        <p className="am-launches-subtitle">
          Experience real-time 360° turntable inspections with active illumination, dynamic angle physics,
          acoustic rev frequencies, and bespoke paint finishes.
        </p>

        {/* Vehicle Model Selector Tabs */}
        <div className="am-launches-switcher">
          {launches.map((launch) => (
            <button
              key={launch.id}
              className={`am-launch-tab-btn ${selectedLaunch.id === launch.id ? 'active' : ''}`}
              onClick={() => handleSelectLaunch(launch)}
            >
              <span className="am-tab-brand">{launch.brand}</span>
              <span className="am-tab-name">{launch.name}</span>
              <span className="am-tab-quarter">{launch.launchQuarter}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 360° Interactive Turntable Studio Stage */}
      <section className="am-launches-stage-wrapper">
        <div className={`am-launches-stage-card ${studioLightMode}`}>
          {/* Stage Top Bar: Details & Studio Environment Selectors */}
          <div className="am-stage-header">
            <div>
              <span className="am-stage-tagline">{selectedLaunch.tagline}</span>
              <h2 className="am-stage-car-name">{selectedLaunch.name}</h2>
              <div className="am-stage-meta-row">
                <span className="am-stage-powertrain-badge">{selectedLaunch.powertrain}</span>
                <span className="am-stage-status-live">● ROTO-STAGE 360 RIG ONLINE</span>
              </div>
            </div>

            {/* Studio Environment & Lighting Switchers */}
            <div className="am-stage-toggles">
              <div className="am-toggle-group">
                <span className="am-toggle-label">Studio Mood:</span>
                <button
                  type="button"
                  className={`am-mood-btn ${studioLightMode === 'midnight' ? 'active' : ''}`}
                  onClick={() => setStudioLightMode('midnight')}
                  title="Dark Obsidian Showroom"
                >
                  🌙 Midnight
                </button>
                <button
                  type="button"
                  className={`am-mood-btn ${studioLightMode === 'daylight' ? 'active' : ''}`}
                  onClick={() => setStudioLightMode('daylight')}
                  title="Daylight Clean Pavilion"
                >
                  ☀️ Daylight
                </button>
                <button
                  type="button"
                  className={`am-mood-btn ${studioLightMode === 'neon' ? 'active' : ''}`}
                  onClick={() => setStudioLightMode('neon')}
                  title="Cyberpunk Neon Underglow"
                >
                  ⚡ Neon
                </button>
              </div>

              <div className="am-toggle-group">
                <button
                  type="button"
                  className={`am-feature-toggle-btn ${headlightsOn ? 'active' : ''}`}
                  onClick={() => setHeadlightsOn(!headlightsOn)}
                  title="Toggle Headlamp Beams"
                >
                  💡 Lights: {headlightsOn ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  className={`am-feature-toggle-btn ${activeAeroOn ? 'active' : ''}`}
                  onClick={() => setActiveAeroOn(!activeAeroOn)}
                  title="Deploy Active Aerodynamic Wing"
                >
                  🪽 Aero Wing: {activeAeroOn ? 'DEPLOYED' : 'STOWED'}
                </button>
              </div>
            </div>
          </div>

          {/* 360 Turntable Viewport Stage */}
          <div
            className={`am-stage-canvas ${isDragging ? 'grabbing' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            style={{
              borderColor: selectedColor ? `${selectedColor.hex}44` : '#d2d2d7',
            }}
          >
            {/* Ambient Lighting & Color Reflection Glow */}
            <div
              className="am-stage-glow"
              style={{
                backgroundColor: selectedColor ? selectedColor.hex : '#0071e3',
                opacity: studioLightMode === 'daylight' ? 0.08 : 0.22,
              }}
            />

            {/* Projected Headlight Beams */}
            {headlightsOn && (activeAngle === 0 || activeAngle === 45 || activeAngle === 315) && (
              <div
                className={`am-headlight-beams ${activeAngle === 315 ? 'flip' : ''}`}
                style={{
                  opacity: studioLightMode === 'midnight' ? 0.85 : 0.45,
                }}
              />
            )}

            {/* Rotating 3D Turntable Platform Base */}
            <div
              className="am-turntable-3d-base"
              style={{
                transform: `rotateX(62deg) rotateZ(${activeAngle}deg)`,
                borderColor: selectedColor ? selectedColor.hex : '#0071e3',
                boxShadow: `0 0 35px ${selectedColor ? selectedColor.hex : '#0071e3'}44`,
              }}
            >
              <div className="am-turntable-inner-ring" />
              <div className="am-turntable-crosshair" />
              {/* Degree Hash Markers */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <div
                  key={deg}
                  className="am-turntable-hash"
                  style={{ transform: `rotate(${deg}deg)` }}
                >
                  <span style={{ transform: `rotate(-${deg}deg)` }}>{deg}°</span>
                </div>
              ))}
            </div>

            {/* Ground Contact Shadow */}
            <div className="am-car-ground-shadow" />

            {/* Vehicle Display Image with Real 3D Turntable Perspective */}
            <div className="am-stage-image-container">
              <img
                src={displayImage}
                alt={`${selectedLaunch.name} at ${activeAngle}°`}
                className={`am-stage-image ${isMirrored ? 'mirrored' : ''}`}
                draggable={false}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/vehicles/1.jpg';
                }}
              />

              {/* Active Aerodynamic Wing Overlay */}
              {activeAeroOn && (
                <div className="am-aero-wing-deployed-badge">
                  <span>ACTIVE AERO DEPLOYED (+140kg DOWNFORCE)</span>
                </div>
              )}

              {/* Hotspot Interactive Pins */}
              {selectedLaunch.hotspots &&
                selectedLaunch.hotspots.map((spot, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`am-stage-hotspot ${activeHotspot?.title === spot.title ? 'active' : ''}`}
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveHotspot(activeHotspot?.title === spot.title ? null : spot);
                    }}
                    title={spot.title}
                  >
                    <span className="am-hotspot-pulse" />
                    <span className="am-hotspot-dot">+</span>
                  </button>
                ))}

              {/* Hotspot Inspection Popup Card */}
              {activeHotspot && (
                <div
                  className="am-hotspot-card"
                  style={{
                    left: `${Math.min(70, Math.max(15, activeHotspot.x))}%`,
                    top: `${Math.min(65, activeHotspot.y + 8)}%`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="am-hotspot-header">
                    <b>{activeHotspot.title}</b>
                    <button className="am-hotspot-close" onClick={() => setActiveHotspot(null)}>×</button>
                  </div>
                  <p>{activeHotspot.detail || activeHotspot.desc}</p>
                </div>
              )}
            </div>

            {/* 360 Turntable Navigation HUD Overlay */}
            <div className="am-stage-hud">
              <div className="am-hud-angle-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{currentAngleFrame ? currentAngleFrame.label : `${activeAngle}° Azimuth`}</span>
                <span className="am-hud-hint">↔ Drag to Spin</span>
              </div>

              <div className="am-hud-controls">
                <button
                  type="button"
                  className="am-hud-btn"
                  onClick={() => setActiveAngle((prev) => (prev - 45 + 360) % 360)}
                  title="Rotate Left 45°"
                >
                  ◀ 45°
                </button>
                <button
                  type="button"
                  className={`am-hud-btn ${isAutoRotating ? 'active-glow' : ''}`}
                  onClick={() => setIsAutoRotating(!isAutoRotating)}
                  title="Toggle Continuous 360° Turntable Rotation"
                >
                  {isAutoRotating ? '⏸ Pause 360°' : '▶ Auto 360°'}
                </button>
                <button
                  type="button"
                  className="am-hud-btn"
                  onClick={() => setActiveAngle((prev) => (prev + 45) % 360)}
                  title="Rotate Right 45°"
                >
                  45° ▶
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Turntable Angle Scrubber Slider */}
          <div className="am-stage-scrubber-row">
            <span className="am-scrubber-label">0° Front</span>
            <input
              type="range"
              min="0"
              max="315"
              step="45"
              value={activeAngle}
              onChange={(e) => {
                setActiveAngle(Number(e.target.value));
                setIsAutoRotating(false);
              }}
              className="am-angle-slider"
            />
            <span className="am-scrubber-label">315° Driver</span>
          </div>

          {/* Quick Preset Angle Buttons */}
          <div className="am-stage-presets">
            {[
              { deg: 0, label: '0° Front' },
              { deg: 45, label: '45° 3/4 Front' },
              { deg: 90, label: '90° Profile' },
              { deg: 135, label: '135° 3/4 Rear' },
              { deg: 180, label: '180° Tail' },
              { deg: 225, label: '225° 3/4 Rear L' },
              { deg: 270, label: '270° Driver Side' },
              { deg: 315, label: '315° 3/4 Front L' },
            ].map(({ deg, label }) => (
              <button
                key={deg}
                className={`am-preset-chip ${activeAngle === deg ? 'active' : ''}`}
                onClick={() => {
                  setActiveAngle(deg);
                  setIsAutoRotating(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Exterior Color Customizer & Engine Acoustic Simulator Bar */}
          <div className="am-stage-interactive-grid">
            {/* Color Swatches */}
            <div className="am-stage-feature-card">
              <span className="am-feature-card-label">Bespoke Exterior Paint Finish</span>
              <div className="am-color-swatches">
                {selectedLaunch.colors &&
                  selectedLaunch.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`am-color-circle ${selectedColor?.name === c.name ? 'selected' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setSelectedColor(c)}
                      title={`${c.name} (${c.type})`}
                    >
                      {selectedColor?.name === c.name && <span className="am-check-indicator">✓</span>}
                    </button>
                  ))}
              </div>
              <div className="am-color-name-text">
                <b>{selectedColor?.name}</b> — <span>{selectedColor?.type}</span>
              </div>
            </div>

            {/* Powertrain Rev Acoustics Soundboard */}
            <div className="am-stage-feature-card">
              <span className="am-feature-card-label">Acoustic Powertrain Telemetry</span>
              <div className="am-audio-buttons">
                <button
                  type="button"
                  className={`am-sound-btn ${audioMode === 'idle' ? 'playing' : ''}`}
                  onClick={() => playSoundProfile('idle')}
                  disabled={isPlayingAudio}
                >
                  <span className="am-sound-icon">🔉</span>
                  <span>Idle Purr</span>
                </button>
                <button
                  type="button"
                  className={`am-sound-btn ${audioMode === 'rev' ? 'playing' : ''}`}
                  onClick={() => playSoundProfile('rev')}
                  disabled={isPlayingAudio}
                >
                  <span className="am-sound-icon">🔊</span>
                  <span>{selectedLaunch.brand === 'Ferrari' ? '9,500 RPM V12 Scream' : 'Dual-Motor Rev'}</span>
                </button>
                <button
                  type="button"
                  className={`am-sound-btn ${audioMode === 'launch' ? 'playing' : ''}`}
                  onClick={() => playSoundProfile('launch')}
                  disabled={isPlayingAudio}
                >
                  <span className="am-sound-icon">⚡</span>
                  <span>0-60 Launch</span>
                </button>
              </div>
              <div className="am-audio-status">
                {isPlayingAudio ? (
                  <span className="am-audio-active-wave">♫ Auditioning {selectedLaunch.name} Frequency Harmonics...</span>
                ) : (
                  <span>Click above to audition synthetic exhaust, cam profiles & electric inverter frequencies.</span>
                )}
              </div>
            </div>
          </div>

          {/* Performance & Engineering Specification Matrix */}
          <div className="am-specs-terminal">
            <div className="am-spec-tile">
              <span className="am-spec-val">{selectedLaunch.specs?.horsepower || `${selectedLaunch.hp} hp`}</span>
              <span className="am-spec-key">Output Horsepower</span>
            </div>
            <div className="am-spec-tile">
              <span className="am-spec-val">{selectedLaunch.specs?.zeroToSixty || selectedLaunch.zeroToSixty}</span>
              <span className="am-spec-key">0 - 60 mph Acceleration</span>
            </div>
            <div className="am-spec-tile">
              <span className="am-spec-val">{selectedLaunch.specs?.topSpeed || selectedLaunch.topSpeed}</span>
              <span className="am-spec-key">Maximum Track Velocity</span>
            </div>
            <div className="am-spec-tile">
              <span className="am-spec-val">{selectedLaunch.specs?.range || selectedLaunch.range}</span>
              <span className="am-spec-key">Range / Tank Capacity</span>
            </div>
            <div className="am-spec-tile">
              <span className="am-spec-val">{selectedLaunch.powertrain?.split('(')[0] || 'AWD Architecture'}</span>
              <span className="am-spec-key">Powertrain Platform</span>
            </div>
          </div>

          {/* Key Engineering Innovations */}
          <div className="am-innovations-grid">
            {(selectedLaunch.keyHighlights || selectedLaunch.features || []).map((hl, i) => (
              <div key={i} className="am-innovation-card">
                <div className="am-innovation-icon">✦</div>
                <div className="am-innovation-text">{hl}</div>
              </div>
            ))}
          </div>

          {/* VIP Allocation Call to Action Bar */}
          <div className="am-allocation-bar">
            <div>
              <div className="am-allocation-status">
                <span className="am-pulse-badge">VIP Allocation Window Open</span>
                <span className="am-spots-left">
                  <b>{selectedLaunch.spotsRemaining}</b> of {selectedLaunch.productionSlots || 50} Flagship Allocations Left
                </span>
              </div>
              <p className="am-allocation-sub">
                MSRP: <b>{fmtPrice(selectedLaunch.basePrice || selectedLaunch.expectedMSRP)}</b>. Fully refundable deposit: <b>{fmtPrice(selectedLaunch.reservationDeposit)}</b>.
              </p>
            </div>
            <div className="am-allocation-actions">
              <Link to="/studio-360" className="am-btn secondary" style={{ textDecoration: 'none' }}>
                Open 360° Studio
              </Link>
              <button
                type="button"
                className="am-btn primary am-btn-large"
                onClick={() => setReservationModalOpen(true)}
              >
                Reserve VIP Allocation →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* VIP Reservation Modal */}
      {reservationModalOpen && (
        <div className="am-modal-overlay" onClick={() => !isSubmitting && setReservationModalOpen(false)}>
          <div className="am-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-header">
              <div>
                <span className="am-badge-gold">VIP PRIORITY ALLOCATION</span>
                <h3 className="am-modal-title">Pre-Order {selectedLaunch.name}</h3>
              </div>
              <button
                className="am-modal-close-btn"
                onClick={() => setReservationModalOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            {reservationResult ? (
              <div className="am-reservation-success">
                <div className="am-success-icon-badge">✓</div>
                <h4>VIP Priority Reservation Confirmed!</h4>
                <p>
                  Congratulations <b>{reservationResult.customerName}</b>. Your production allocation spot has been
                  secured for the upcoming <b>{reservationResult.modelName}</b>.
                </p>

                <div className="am-reservation-ticket">
                  <div className="am-ticket-row">
                    <span>Reservation Token:</span>
                    <b>{reservationResult.reservationId}</b>
                  </div>
                  <div className="am-ticket-row">
                    <span>Queue Priority Tier:</span>
                    <span className="am-priority-tag"># {reservationResult.queuePriorityNumber} Worldwide</span>
                  </div>
                  <div className="am-ticket-row">
                    <span>Specified Paint:</span>
                    <b>{reservationResult.preferredColor}</b>
                  </div>
                  <div className="am-ticket-row">
                    <span>Delivery Flagship:</span>
                    <b>{reservationResult.deliveryCenter}</b>
                  </div>
                  <div className="am-ticket-row">
                    <span>Deposit Recorded:</span>
                    <b>{fmtPrice(reservationResult.depositPaid)} (Escrow Verified)</b>
                  </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                  <button
                    className="am-btn primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setReservationResult(null);
                      setReservationModalOpen(false);
                    }}
                  >
                    Done & Return to Showroom
                  </button>
                  <Link
                    to="/support"
                    className="am-btn secondary"
                    style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                  >
                    Contact Concierge
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReservationSubmit} className="am-reservation-form">
                {errorMsg && <div className="am-alert-error">{errorMsg}</div>}

                <div className="am-form-grid">
                  <div className="am-form-field">
                    <label>Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Jonathan Harker"
                      value={reserveForm.customerName}
                      onChange={(e) => setReserveForm({ ...reserveForm, customerName: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="am-form-field">
                    <label>Email Address (VIP Updates) *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. client@domain.com"
                      value={reserveForm.customerEmail}
                      onChange={(e) => setReserveForm({ ...reserveForm, customerEmail: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="am-form-field">
                    <label>Direct Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={reserveForm.customerPhone}
                      onChange={(e) => setReserveForm({ ...reserveForm, customerPhone: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="am-form-field">
                    <label>Preferred Delivery Center</label>
                    <select
                      value={reserveForm.deliveryCenter}
                      onChange={(e) => setReserveForm({ ...reserveForm, deliveryCenter: e.target.value })}
                      disabled={isSubmitting}
                    >
                      <option value="Stratos Silicon Valley Flagship">Stratos Silicon Valley Flagship (Palo Alto, CA)</option>
                      <option value="Stratos Manhattan Gallery">Stratos Manhattan Gallery (New York, NY)</option>
                      <option value="Stratos Beverly Hills Salon">Stratos Beverly Hills Salon (Los Angeles, CA)</option>
                      <option value="Stratos London Mayfair Pavilion">Stratos London Mayfair Pavilion (UK)</option>
                      <option value="Stratos Mumbai Flagship">Stratos Mumbai Flagship (Bandra Kurla, IN)</option>
                      <option value="Stratos Direct Enclosed Transport">Direct Enclosed White-Glove Home Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="am-reservation-terms">
                  <div className="am-terms-box">
                    <span>Selected Bespoke Finish:</span>
                    <b>{selectedColor ? `${selectedColor.name} (${selectedColor.type})` : 'Standard'}</b>
                  </div>
                  <div className="am-terms-box">
                    <span>Refundable Escrow Deposit:</span>
                    <b>{fmtPrice(selectedLaunch.reservationDeposit)}</b>
                  </div>
                </div>

                <p className="am-fine-print">
                  * All deposits are held in insured tier-1 banking escrow and are 100% refundable at any time prior to
                  chassis VIN allocation. You will receive an encrypted digital certificate upon submission.
                </p>

                <div className="am-modal-actions">
                  <button
                    type="button"
                    className="am-btn secondary"
                    onClick={() => setReservationModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="am-btn primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Securing Allocation...' : `Confirm VIP Reservation (${fmtPrice(selectedLaunch.reservationDeposit)})`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
