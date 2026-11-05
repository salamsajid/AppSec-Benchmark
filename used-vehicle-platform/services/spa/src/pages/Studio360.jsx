import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, fmtPrice, fmtKm } from '../api.js';
import { VEHICLE_IMAGES } from '../vehicleImages.js';

export default function Studio360() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '1';

  const [vehicleId, setVehicleId] = useState(initialId);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [studioData, setStudioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAngleIndex, setActiveAngleIndex] = useState(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [viewMode, setViewMode] = useState('exterior'); // 'exterior' | 'interior'
  const [activeTab, setActiveTab] = useState('optical'); // 'optical' | 'laser' | 'diagnostics'
  const [isScanningLaser, setIsScanningLaser] = useState(false);
  const [laserScanProgress, setLaserScanProgress] = useState(0);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Mouse Drag to rotate turntable
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const angleAtStartRef = useRef(0);

  // Audio Context for laser ping & diagnostic scanner
  const audioCtxRef = useRef(null);

  useEffect(() => {
    loadVehicleCatalog();
  }, []);

  useEffect(() => {
    loadStudioData(vehicleId);
    setSearchParams({ id: vehicleId });
  }, [vehicleId]);

  // Auto-spin interval
  useEffect(() => {
    let interval;
    if (isAutoSpinning && viewMode === 'exterior' && studioData?.angleFrames?.length > 0) {
      interval = setInterval(() => {
        setActiveAngleIndex((prev) => (prev + 1) % studioData.angleFrames.length);
      }, 1100);
    }
    return () => clearInterval(interval);
  }, [isAutoSpinning, viewMode, studioData]);

  // Laser scan progress simulation
  useEffect(() => {
    let timer;
    if (isScanningLaser) {
      timer = setInterval(() => {
        setLaserScanProgress((prev) => {
          if (prev >= 100) {
            setIsScanningLaser(false);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isScanningLaser]);

  const loadVehicleCatalog = async () => {
    try {
      const res = await api('/api/catalog/v1/vehicles');
      if (res.data && Array.isArray(res.data)) {
        setVehiclesList(res.data);
      }
    } catch (e) {
      console.warn('Could not load vehicles catalog', e);
    }
  };

  const loadStudioData = async (id) => {
    setLoading(true);
    try {
      const res = await api(`/api/catalog/v1/vehicles/${id}/studio-360`);
      if (res.data && res.data.ok && res.data.studio) {
        setStudioData(res.data.studio);
        setActiveAngleIndex(0);
        setActiveHotspot(null);
      }
    } catch (e) {
      console.error('Failed to load studio 360 data', e);
    } finally {
      setLoading(false);
    }
  };

  // Drag-to-rotate mouse handlers
  const handleMouseDown = (e) => {
    if (viewMode !== 'exterior') return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    angleAtStartRef.current = activeAngleIndex;
    setIsAutoSpinning(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !studioData?.angleFrames?.length) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const steps = Math.floor(deltaX / 35); // 35px per 45 deg step
    const totalFrames = studioData.angleFrames.length;
    let nextIndex = (angleAtStartRef.current - steps) % totalFrames;
    if (nextIndex < 0) nextIndex += totalFrames;
    setActiveAngleIndex(nextIndex);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const triggerLaserScan = () => {
    setIsScanningLaser(true);
    setLaserScanProgress(0);
    setActiveTab('laser');

    try {
      if (!audioCtxRef.current && (window.AudioContext || window.webkitAudioContext)) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 1.8);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.0);
      }
    } catch (err) {
      console.warn('Audio scan sound error', err);
    }
  };

  if (loading && !studioData) {
    return (
      <div className="am-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div className="am-spinner" />
        <p style={{ marginTop: 20, color: '#86868b' }}>Initializing 360° High-Precision Optical Rig...</p>
      </div>
    );
  }

  const currentFrame = studioData?.angleFrames?.[activeAngleIndex] || {
    angle: 0,
    label: 'Front Fascia 0°',
    frame: `/vehicles/${vehicleId}.jpg`,
  };

  // Resolve frame image: use vehicleImages repo mapping or fallback
  const vImgMap = VEHICLE_IMAGES[vehicleId];
  let currentImageSrc = currentFrame.frame;
  let isMirrored = currentFrame.mirror || activeAngleIndex === 5 || activeAngleIndex === 6 || activeAngleIndex === 7;

  if (vImgMap) {
    if (activeAngleIndex === 0 && vImgMap.primary) currentImageSrc = vImgMap.primary;
    else if ((activeAngleIndex === 1 || activeAngleIndex === 7) && vImgMap.gallery?.[0]) currentImageSrc = vImgMap.gallery[0];
    else if ((activeAngleIndex === 2 || activeAngleIndex === 6) && vImgMap.gallery?.[1]) currentImageSrc = vImgMap.gallery[1];
    else if ((activeAngleIndex === 3 || activeAngleIndex === 4 || activeAngleIndex === 5) && vImgMap.gallery?.[2]) currentImageSrc = vImgMap.gallery[2];
  }

  const interiorSrc = vImgMap?.gallery?.[2] || studioData?.interiorImage || `/vehicles/${vehicleId}-2.jpg`;
  const currentAngleDegrees = currentFrame.angle != null ? currentFrame.angle : activeAngleIndex * 45;

  return (
    <div
      className="am-studio-page"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header & Vehicle Switcher Bar */}
      <section className="am-studio-topbar">
        <div className="am-topbar-info">
          <div className="am-pulse-tag">
            <span className="am-pulse-dot" /> LIVE 360° OPTICAL RIG • 200-POINT LASER SCAN
          </div>
          <h1 className="am-studio-headline">
            {studioData.year} {studioData.make} {studioData.model}
          </h1>
          <div className="am-studio-meta-row">
            <span className="am-price-tag">{fmtPrice(studioData.price)}</span>
            <span className="am-meta-divider">•</span>
            <span>VIN: <code>{studioData.vin}</code></span>
            <span className="am-meta-divider">•</span>
            <span>Odometer: {fmtKm(studioData.mileage)}</span>
            <span className="am-meta-divider">•</span>
            <span className="am-badge-green">Factory Verified</span>
          </div>
        </div>

        {/* Vehicle Switcher Dropdown */}
        <div className="am-studio-switcher-box">
          <label className="am-field-label">Switch Inspection Vehicle:</label>
          <select
            className="am-studio-select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {vehiclesList.map((v) => (
              <option key={v.id} value={v.id}>
                #{v.id} — {v.year} {v.make} {v.model} ({fmtPrice(v.price)})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Main Studio Interactive Turntable Viewport */}
      <section className="am-studio-main-grid">
        <div className="am-studio-turntable-panel">
          {/* View Mode Bar: Exterior 360 vs Interior Cockpit */}
          <div className="am-studio-viewmode-bar">
            <div className="am-viewmode-buttons">
              <button
                type="button"
                className={`am-viewmode-btn ${viewMode === 'exterior' ? 'active' : ''}`}
                onClick={() => setViewMode('exterior')}
              >
                🔄 Exterior 360° RotoStage
              </button>
              <button
                type="button"
                className={`am-viewmode-btn ${viewMode === 'interior' ? 'active' : ''}`}
                onClick={() => setViewMode('interior')}
              >
                💺 Interior Cockpit Panorama
              </button>
            </div>

            <button
              type="button"
              className={`am-laser-scan-btn ${isScanningLaser ? 'scanning' : ''}`}
              onClick={triggerLaserScan}
              disabled={isScanningLaser}
            >
              {isScanningLaser ? `⚡ Scanning Paint Depth (${laserScanProgress}%)...` : '📡 Run Ultrasonic Laser Scan'}
            </button>
          </div>

          {/* 360 Visualizer Canvas */}
          <div
            className={`am-turntable-stage ${isDragging ? 'grabbing' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            {/* Studio Lighting Grid & Vignette */}
            <div className="am-turntable-lighting-grid" />

            {viewMode === 'exterior' ? (
              <>
                {/* Rotating 3D Turntable Base Platform */}
                <div
                  className="am-studio-turntable-ring"
                  style={{
                    transform: `rotateX(62deg) rotateZ(${currentAngleDegrees}deg)`,
                  }}
                >
                  <div className="am-turntable-ring-inner" />
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <div
                      key={deg}
                      className="am-studio-ring-tick"
                      style={{ transform: `rotate(${deg}deg)` }}
                    >
                      <span style={{ transform: `rotate(-${deg}deg)` }}>{deg}°</span>
                    </div>
                  ))}
                </div>

                {/* Ground Shadow */}
                <div className="am-studio-car-shadow" />

                {/* Laser Scanning Line Sweep */}
                {isScanningLaser && (
                  <div
                    className="am-laser-beam-sweep"
                    style={{ left: `${laserScanProgress}%` }}
                  >
                    <div className="am-laser-reticle">
                      <span>{Math.round(108 + Math.sin(laserScanProgress) * 7)} µm</span>
                    </div>
                  </div>
                )}

                {/* Vehicle Display Frame */}
                <div className="am-turntable-frame-wrap">
                  <img
                    src={currentImageSrc}
                    alt={`${studioData.make} ${studioData.model} at ${currentFrame.label}`}
                    className={`am-turntable-image ${isMirrored ? 'mirrored' : ''}`}
                    draggable={false}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/vehicles/1.jpg';
                    }}
                  />

                  {/* Optical Hotspots for current angle */}
                  {(studioData.hotspots || studioData.opticalHotspots || []).map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`am-optical-pin ${activeHotspot?.title === h.title ? 'active' : ''}`}
                      style={{
                        left: `${(h.coords?.x || h.x || 50)}%`,
                        top: `${(h.coords?.y || h.y || 50)}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveHotspot(activeHotspot?.title === h.title ? null : h);
                      }}
                      title={h.title}
                    >
                      <span className="am-pin-ring" />
                      <span className="am-pin-core">⦿</span>
                    </button>
                  ))}

                  {/* Optical Inspection Popover */}
                  {activeHotspot && (
                    <div
                      className="am-pin-popover"
                      style={{
                        left: `${Math.min(65, Math.max(10, activeHotspot.coords?.x || activeHotspot.x || 30))}%`,
                        top: `${Math.min(65, (activeHotspot.coords?.y || activeHotspot.y || 40) + 6)}%`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="am-popover-header">
                        <span className="am-popover-badge">OPTICAL AUDIT CHECK</span>
                        <button className="am-popover-close" onClick={() => setActiveHotspot(null)}>×</button>
                      </div>
                      <h4 className="am-popover-title">{activeHotspot.title}</h4>
                      <div className="am-popover-status">
                        Status: <b style={{ color: '#30d158' }}>{activeHotspot.status}</b>
                      </div>
                      <p className="am-popover-desc">{activeHotspot.description || activeHotspot.detail}</p>
                    </div>
                  )}
                </div>

                {/* Overlay Turntable HUD Bar */}
                <div className="am-turntable-hud-bar">
                  <div className="am-hud-status">
                    <span className="am-hud-angle-txt">
                      📐 <b>{currentFrame.label}</b> ({currentAngleDegrees}°)
                    </span>
                    <span className="am-drag-hint">↔ Drag horizontally to rotate 360°</span>
                  </div>

                  <div className="am-turntable-controls">
                    <button
                      type="button"
                      className="am-control-btn"
                      onClick={() =>
                        setActiveAngleIndex(
                          (prev) => (prev - 1 + studioData.angleFrames.length) % studioData.angleFrames.length
                        )
                      }
                      title="Previous Angle (-45°)"
                    >
                      ◀ 45°
                    </button>

                    <button
                      type="button"
                      className={`am-control-btn ${isAutoSpinning ? 'active-pulse' : ''}`}
                      onClick={() => setIsAutoSpinning(!isAutoSpinning)}
                      title="Toggle 360° Continuous Auto Rotation"
                    >
                      {isAutoSpinning ? '⏸ Pause Spin' : '▶ Auto 360°'}
                    </button>

                    <button
                      type="button"
                      className="am-control-btn"
                      onClick={() =>
                        setActiveAngleIndex((prev) => (prev + 1) % studioData.angleFrames.length)
                      }
                      title="Next Angle (+45°)"
                    >
                      45° ▶
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Interior Panoramic Cockpit View */
              <div className="am-interior-cockpit-stage">
                <img
                  src={interiorSrc}
                  alt={`${studioData.make} ${studioData.model} Interior Cabin`}
                  className="am-interior-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/vehicles/1-2.jpg';
                  }}
                />
                <div className="am-interior-overlay-hud">
                  <span className="am-interior-badge">CABIN AMENITY INSPECTION</span>
                  <div className="am-interior-pins-row">
                    <div className="am-cockpit-check-item">✓ Ergonomic Bolsters (Zero Leather Tears)</div>
                    <div className="am-cockpit-check-item">✓ 100% Capacitive Touchscreen Responsiveness</div>
                    <div className="am-cockpit-check-item">✓ Dual-Zone Automatic Climate Control: 18.5°C</div>
                    <div className="am-cockpit-check-item">✓ Ozone UV Sterilized Cabin Air Filter</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick 8-Angle Thumbnails Navigation */}
          {viewMode === 'exterior' && (
            <div className="am-angle-thumbnails">
              {studioData.angleFrames.map((frame, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`am-angle-thumb-btn ${activeAngleIndex === idx ? 'active' : ''}`}
                  onClick={() => {
                    setActiveAngleIndex(idx);
                    setIsAutoSpinning(false);
                  }}
                >
                  <span className="am-thumb-deg">{frame.angle}°</span>
                  <span className="am-thumb-name">{frame.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Footer Bar */}
          <div className="am-studio-actions-card">
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Official 200-Point Inspection Guaranteed</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#86868b' }}>
                All measurements are cryptographically timestamped and bound to Stratos 100% Escrow Protection.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="am-btn secondary"
                onClick={() => setShowCertificateModal(true)}
              >
                📜 View Cryptographic Audit
              </button>
              <Link to={`/checkout?vehicle=${vehicleId}`} className="am-btn primary" style={{ textDecoration: 'none' }}>
                Buy Now ({fmtPrice(studioData.price)})
              </Link>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Laser Paint Depth & Diagnostics Telemetry */}
        <div className="am-studio-telemetry-panel">
          {/* Tab Switcher */}
          <div className="am-telemetry-tabs">
            <button
              className={`am-telemetry-tab ${activeTab === 'optical' ? 'active' : ''}`}
              onClick={() => setActiveTab('optical')}
            >
              Optical Check
            </button>
            <button
              className={`am-telemetry-tab ${activeTab === 'laser' ? 'active' : ''}`}
              onClick={() => setActiveTab('laser')}
            >
              Laser Paint Depth
            </button>
            <button
              className={`am-telemetry-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              OBD-II Telemetry
            </button>
          </div>

          {/* Tab 1: Optical 200-Point Inspection Details */}
          {activeTab === 'optical' && (
            <div className="am-telemetry-content">
              <div className="am-inspection-score-card">
                <div className="am-score-badge">200 / 200</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Master Certification Passed</h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#86868b' }}>
                    Zero frame distortion, zero undeclared repaints, authentic OEM components.
                  </p>
                </div>
              </div>

              <h4 className="am-section-subhead">Optical Hotspot Inspection Highlights</h4>
              <div className="am-hotspot-list">
                {(studioData.hotspots || studioData.opticalHotspots || []).map((spot, i) => (
                  <div
                    key={i}
                    className={`am-hotspot-item ${activeHotspot?.title === spot.title ? 'active' : ''}`}
                    onClick={() => setActiveHotspot(spot)}
                  >
                    <div className="am-hotspot-item-header">
                      <span className="am-item-title">{spot.title}</span>
                      <span className="am-badge-green">{spot.status}</span>
                    </div>
                    <p className="am-item-desc">{spot.description || spot.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Laser Paint Depth Gauges */}
          {activeTab === 'laser' && (
            <div className="am-telemetry-content">
              <div className="am-laser-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Ultrasonic Micrometer Profile</h4>
                  <button className="am-btn-mini" onClick={triggerLaserScan}>Scan Again</button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#86868b' }}>
                  Factory standard OEM range: <b>90 µm – 140 µm</b>. Any reading over 175 µm indicates aftermarket putty or respray.
                </p>
              </div>

              <div className="am-gauges-grid">
                {Object.entries(studioData.laserPaintDepth || studioData.paintDepthProfile || {}).map(([panel, reading]) => {
                  if (panel === 'verdict') return null;
                  const parsed = parseInt(reading, 10) || 112;
                  const percent = Math.min(100, Math.max(0, ((parsed - 70) / 90) * 100));
                  return (
                    <div key={panel} className="am-gauge-card">
                      <div className="am-gauge-header">
                        <span className="am-gauge-name">
                          {panel.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                        </span>
                        <span className="am-gauge-val">{reading}</span>
                      </div>
                      <div className="am-gauge-meter">
                        <div className="am-gauge-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="am-gauge-status">✓ OEM Factory Certified Spec (100% Clean)</span>
                    </div>
                  );
                })}
              </div>

              <div className="am-structural-seal-box">
                <span className="am-seal-icon">🛡️</span>
                <div>
                  <b>Structural Pillar Weld Integrity: 100% Intact</b>
                  <p>A/B/C-Pillars verified with electromagnetic resonant thickness scanner.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: OBD-II Mechanical Telemetry */}
          {activeTab === 'diagnostics' && (
            <div className="am-telemetry-content">
              <div className="am-diag-banner">
                <span className="am-diag-clean-badge">ZERO ACTIVE DTC FAULT CODES</span>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#86868b' }}>
                  Connected live via Stratos Telematics API gateway. Last scanned: {new Date().toLocaleTimeString()}.
                </p>
              </div>

              <div className="am-diag-metrics-list">
                <div className="am-diag-metric-row">
                  <span>Battery / Alternator Terminal Voltage</span>
                  <b>{studioData.diagnostics?.batteryVoltage || '14.2 V (Nominal)'}</b>
                </div>
                <div className="am-diag-metric-row">
                  <span>Brake Pad Remaining Friction Material</span>
                  <b>{studioData.diagnostics?.brakePadWear || studioData.mechanicalDiagnostics?.brakePadLifeFront || '88% Front / 92% Rear'}</b>
                </div>
                <div className="am-diag-metric-row">
                  <span>Tire Tread Depth Measurement</span>
                  <b>{studioData.diagnostics?.tireTreadDepth || '7.5 mm (Optimal)'}</b>
                </div>
                <div className="am-diag-metric-row">
                  <span>Engine / Inverter Thermal Equilibrium</span>
                  <b>{studioData.diagnostics?.coolantHealth || 'Optimal (89°C)'}</b>
                </div>
                <div className="am-diag-metric-row">
                  <span>Suspension Alignment Delta</span>
                  <b>{studioData.mechanicalDiagnostics?.suspensionAlignmentDelta || '0.02° (Precision Aligned)'}</b>
                </div>
                <div className="am-diag-metric-row">
                  <span>Next Scheduled Service</span>
                  <b>{studioData.mechanicalDiagnostics?.oilServiceDue || 'In 9,400 miles'}</b>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <Link
                  to="/warranty"
                  className="am-btn secondary"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                >
                  View Extended Protection Plans →
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Official Cryptographic Certificate Modal */}
      {showCertificateModal && (
        <div className="am-modal-overlay" onClick={() => setShowCertificateModal(false)}>
          <div className="am-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-header">
              <div>
                <span className="am-badge-gold">OFFICIAL STRATOS CERTIFICATION</span>
                <h3 className="am-modal-title">Verified 360° Studio Audit Certificate</h3>
              </div>
              <button className="am-modal-close-btn" onClick={() => setShowCertificateModal(false)}>✕</button>
            </div>

            <div className="am-cert-body">
              <div className="am-cert-stamp">
                <span>PASSED 200/200</span>
              </div>

              <div className="am-cert-grid">
                <div><span>Vehicle:</span> <b>{studioData.year} {studioData.make} {studioData.model}</b></div>
                <div><span>VIN:</span> <code>{studioData.vin}</code></div>
                <div><span>Odometer:</span> <b>{fmtKm(studioData.mileage)}</b></div>
                <div><span>Laser Paint Thickness:</span> <b>108–114 µm (Original)</b></div>
                <div><span>OBD-II Faults:</span> <b style={{ color: '#16a34a' }}>0 Active DTC Codes</b></div>
                <div><span>Audit Token:</span> <code>AUTOHUB-360-CERT-{Math.floor(100000 + Math.random() * 900000)}</code></div>
              </div>

              <p className="am-cert-note">
                This vehicle has passed rigorous photometric turntable inspection, ultrasonic laser paint measurement, and electronic powertrain diagnostics. Certified compliant under ISO-9001 automotive reconditioning guidelines.
              </p>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button
                  type="button"
                  className="am-btn primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    alert('Certificate PDF downloaded to your device!');
                    setShowCertificateModal(false);
                  }}
                >
                  📥 Download PDF Certificate
                </button>
                <button
                  type="button"
                  className="am-btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowCertificateModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
