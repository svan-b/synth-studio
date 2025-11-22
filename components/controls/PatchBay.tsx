'use client';

import { useState, useRef } from 'react';

interface PatchPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'input' | 'output';
}

interface Cable {
  id: string;
  from: PatchPoint;
  to: PatchPoint | null;
  color: string;
  isDrawing: boolean;
}

interface PatchBayProps {
  jacks: PatchPoint[];
  onConnection?: (from: string, to: string, color: string) => void;
}

export default function PatchBay({ jacks, onConnection }: PatchBayProps) {
  const [cables, setCables] = useState<Cable[]>([]);
  const [activeCable, setActiveCable] = useState<Cable | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cable colors for different signal types
  const CABLE_COLORS = {
    audio: '#00ff00',      // Green for audio
    cv: '#ffaa00',         // Orange for CV
    gate: '#ff0000',       // Red for gates/triggers
    clock: '#00ffff',      // Cyan for clock
    modulation: '#ff00ff', // Magenta for modulation
  };

  const getSignalType = (jackName: string): keyof typeof CABLE_COLORS => {
    if (jackName.includes('TRIGGER') || jackName.includes('GATE')) return 'gate';
    if (jackName.includes('CLOCK') || jackName.includes('TEMPO')) return 'clock';
    if (jackName.includes('CV') || jackName.includes('EG')) return 'cv';
    if (jackName.includes('MOD')) return 'modulation';
    return 'audio';
  };

  const handleJackClick = (jack: PatchPoint) => {
    if (!activeCable) {
      // Start new cable from output jack only
      if (jack.type === 'output') {
        const signalType = getSignalType(jack.label);
        const newCable: Cable = {
          id: Date.now().toString(),
          from: jack,
          to: null,
          color: CABLE_COLORS[signalType],
          isDrawing: true,
        };
        setActiveCable(newCable);
      }
    } else {
      // Complete cable to input jack
      if (jack.type === 'input' && jack.id !== activeCable.from.id) {
        const completedCable = {
          ...activeCable,
          to: jack,
          isDrawing: false,
        };
        setCables([...cables, completedCable]);
        setActiveCable(null);

        // Notify parent of connection for teaching mode
        onConnection?.(activeCable.from.id, jack.id, completedCable.color);
      }
    }
  };

  const handleCableClick = (cableId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove cable on click
    setCables(cables.filter(c => c.id !== cableId));
  };

  const drawCable = (cable: Cable, currentMousePos?: { x: number, y: number }) => {
    const fromX = cable.from.x;
    const fromY = cable.from.y;
    const toX = cable.to ? cable.to.x : currentMousePos?.x || mousePos.x;
    const toY = cable.to ? cable.to.y : currentMousePos?.y || mousePos.y;

    // Create natural cable curve
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2 + Math.abs(toX - fromX) * 0.2; // Sag based on distance

    return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeCable) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  const handleContainerClick = () => {
    // Cancel active cable if clicking outside jacks
    if (activeCable) {
      setActiveCable(null);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Jack sockets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        gap: '8px 6px',
        padding: '4px',
        position: 'relative',
        zIndex: 10,
      }}>
        {jacks.map((jack, index) => (
          <div key={jack.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleJackClick(jack);
              }}
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: '#000',
                border: `2px solid ${jack.type === 'output' ? '#666' : '#444'}`,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Connection indicator */}
              {cables.some(c => c.from.id === jack.id || c.to?.id === jack.id) && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#0f0',
                  animation: 'pulse 1s infinite',
                }} />
              )}
            </div>
            {/* Label */}
            <div style={{
              fontSize: '4px',
              color: '#666',
              textAlign: 'center',
              lineHeight: '1',
              maxWidth: '45px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {jack.label}
            </div>
          </div>
        ))}
      </div>

      {/* SVG overlay for cables */}
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: activeCable ? 'all' : 'none',
          zIndex: 5,
        }}
        onMouseMove={handleMouseMove}
      >
        {/* Render completed cables */}
        {cables.map(cable => (
          <g key={cable.id}>
            <path
              d={drawCable(cable)}
              stroke={cable.color}
              strokeWidth="3"
              fill="none"
              opacity="0.8"
              style={{
                filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.5))',
                pointerEvents: 'stroke',
                cursor: 'pointer',
              }}
              onClick={(e) => handleCableClick(cable.id, e)}
            />
            {/* Cable plug ends */}
            <circle cx={cable.from.x} cy={cable.from.y} r="4" fill={cable.color} />
            {cable.to && <circle cx={cable.to.x} cy={cable.to.y} r="4" fill={cable.color} />}
          </g>
        ))}

        {/* Active cable being drawn */}
        {activeCable && (
          <path
            d={drawCable(activeCable, mousePos)}
            stroke={activeCable.color}
            strokeWidth="3"
            fill="none"
            opacity="0.6"
            strokeDasharray="5,5"
            style={{ animation: 'dash 0.5s linear infinite' }}
          />
        )}
      </svg>

      {/* Cable type legend for teaching */}
      <div style={{
        position: 'absolute',
        bottom: '-30px',
        left: '0',
        fontSize: '5px',
        color: '#666',
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#00ff00' }}>● Audio</span>
        <span style={{ color: '#ffaa00' }}>● CV</span>
        <span style={{ color: '#ff0000' }}>● Gate</span>
        <span style={{ color: '#00ffff' }}>● Clock</span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes dash {
          to { stroke-dashoffset: -10; }
        }
      `}</style>
    </div>
  );
}
