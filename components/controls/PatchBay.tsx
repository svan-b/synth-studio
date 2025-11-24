'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface PatchPoint {
  id: string;
  label: string;
  column: number;
  row: number;
  type: 'input' | 'output';
}

interface JackPosition {
  id: string;
  x: number;
  y: number;
}

interface Cable {
  id: string;
  fromId: string;
  toId: string | null;
  color: string;
}

interface PatchBayProps {
  jacks: PatchPoint[];
  onConnection?: (from: string, to: string, color: string) => void;
}

// Cable colors for different signal types
const CABLE_COLORS = {
  audio: '#00ff00',      // Green for audio
  cv: '#ffaa00',         // Orange for CV
  gate: '#ff0000',       // Red for gates/triggers
  clock: '#00ffff',      // Cyan for clock
  modulation: '#ff00ff', // Magenta for modulation
} as const;

const getSignalType = (jackLabel: string): keyof typeof CABLE_COLORS => {
  if (jackLabel.includes('TRIGGER') || jackLabel.includes('GATE') || jackLabel.includes('RUN')) return 'gate';
  if (jackLabel.includes('CLOCK') || jackLabel.includes('ADV')) return 'clock';
  if (jackLabel.includes('CV') || jackLabel.includes('EG') || jackLabel.includes('DECAY') ||
      jackLabel.includes('VELOCITY') || jackLabel.includes('PITCH') || jackLabel.includes('LEVEL') ||
      jackLabel.includes('TEMPO') || jackLabel.includes('FM') || jackLabel.includes('MOD')) return 'cv';
  return 'audio';
};

export default function PatchBay({ jacks, onConnection }: PatchBayProps) {
  const [cables, setCables] = useState<Cable[]>([]);
  const [activeCableFromId, setActiveCableFromId] = useState<string | null>(null);
  const [activeCableColor, setActiveCableColor] = useState<string>('#00ff00');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [jackPositions, setJackPositions] = useState<Record<string, JackPosition>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const jackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Calculate jack positions when component mounts or jacks change
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const positions: Record<string, JackPosition> = {};

      Object.entries(jackRefs.current).forEach(([id, el]) => {
        if (el) {
          const rect = el.getBoundingClientRect();
          positions[id] = {
            id,
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
          };
        }
      });

      setJackPositions(positions);
    };

    // Update on mount and resize
    updatePositions();
    window.addEventListener('resize', updatePositions);

    // Delayed update to ensure layout is complete
    const timeoutId = setTimeout(updatePositions, 100);

    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timeoutId);
    };
  }, [jacks]);

  const handleJackClick = useCallback((jack: PatchPoint) => {
    if (!activeCableFromId) {
      // Start new cable from output jack only
      if (jack.type === 'output') {
        const signalType = getSignalType(jack.label);
        setActiveCableFromId(jack.id);
        setActiveCableColor(CABLE_COLORS[signalType]);
      }
    } else {
      // Complete cable to input jack
      if (jack.type === 'input' && jack.id !== activeCableFromId) {
        const newCable: Cable = {
          id: Date.now().toString(),
          fromId: activeCableFromId,
          toId: jack.id,
          color: activeCableColor,
        };
        setCables(prev => [...prev, newCable]);

        // Notify parent of connection for teaching mode
        onConnection?.(activeCableFromId, jack.id, activeCableColor);

        setActiveCableFromId(null);
      }
    }
  }, [activeCableFromId, activeCableColor, onConnection]);

  const handleCableClick = useCallback((cableId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCables(prev => prev.filter(c => c.id !== cableId));
  }, []);

  const drawCablePath = useCallback((fromPos: JackPosition, toPos: { x: number; y: number }) => {
    const fromX = fromPos.x;
    const fromY = fromPos.y;
    const toX = toPos.x;
    const toY = toPos.y;

    // Create natural cable sag
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const sag = Math.min(distance * 0.3, 40);

    const midX = (fromX + toX) / 2;
    const midY = Math.max(fromY, toY) + sag;

    return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeCableFromId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, [activeCableFromId]);

  const handleContainerClick = useCallback(() => {
    if (activeCableFromId) {
      setActiveCableFromId(null);
    }
  }, [activeCableFromId]);

  // Organize jacks by column (0, 1, 2 for DFAM's 3-column layout)
  const organizedJacks: Record<number, PatchPoint[]> = { 0: [], 1: [], 2: [] };
  jacks.forEach(jack => {
    const col = jack.column;
    if (col >= 0 && col <= 2) {
      if (!organizedJacks[col]) organizedJacks[col] = [];
      organizedJacks[col].push(jack);
    }
  });

  // Sort each column by row
  Object.values(organizedJacks).forEach(col => col.sort((a, b) => a.row - b.row));

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Header: IN / OUT */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '6px',
        padding: '0 4px',
      }}>
        <span style={{ fontSize: '7px', color: '#888', fontWeight: 'bold' }}>IN</span>
        <span style={{ fontSize: '7px', color: '#fff', fontWeight: 'bold' }}>OUT</span>
      </div>

      {/* Jack sockets organized in 3 columns */}
      <div style={{
        display: 'flex',
        gap: '4px',
        position: 'relative',
        zIndex: 10,
      }}>
        {[0, 1, 2].map(colIndex => {
          const isOutputColumn = colIndex === 2;
          return (
            <div
              key={colIndex}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                flex: 1,
                padding: '4px 2px',
                borderRadius: '3px',
                background: isOutputColumn ? '#1a1a1a' : '#0a0a0a',
              }}
            >
              {(organizedJacks[colIndex] || []).map((jack) => (
                <div
                  key={jack.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1px',
                  }}
                >
                  {/* Label above jack */}
                  <div style={{
                    fontSize: '5px',
                    color: isOutputColumn ? '#eee' : '#888',
                    textAlign: 'center',
                    lineHeight: '1.1',
                    maxWidth: '45px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: isOutputColumn ? 'bold' : 'normal',
                  }}>
                    {jack.label}
                  </div>
                  {/* Jack socket */}
                  <div
                    ref={(el) => { jackRefs.current[jack.id] = el; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJackClick(jack);
                    }}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#111',
                      border: `2px solid ${isOutputColumn ? '#888' : '#444'}`,
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isOutputColumn
                        ? '0 0 4px rgba(255, 255, 255, 0.2)'
                        : 'inset 0 1px 3px rgba(0,0,0,0.6)',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.15)';
                      e.currentTarget.style.boxShadow = isOutputColumn
                        ? '0 0 8px rgba(255, 255, 255, 0.4)'
                        : '0 0 6px rgba(100, 200, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = isOutputColumn
                        ? '0 0 4px rgba(255, 255, 255, 0.2)'
                        : 'inset 0 1px 3px rgba(0,0,0,0.6)';
                    }}
                  >
                    {/* Connection indicator */}
                    {cables.some(c => c.fromId === jack.id || c.toId === jack.id) && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: cables.find(c => c.fromId === jack.id || c.toId === jack.id)?.color || '#0f0',
                      }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* SVG overlay for cables */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        {/* Render completed cables */}
        {cables.map(cable => {
          const fromPos = jackPositions[cable.fromId];
          const toPos = cable.toId ? jackPositions[cable.toId] : null;

          if (!fromPos || !toPos) return null;

          return (
            <g key={cable.id}>
              {/* Cable shadow */}
              <path
                d={drawCablePath(fromPos, toPos)}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              {/* Main cable */}
              <path
                d={drawCablePath(fromPos, toPos)}
                stroke={cable.color}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 3px ${cable.color})`,
                  pointerEvents: 'stroke',
                  cursor: 'pointer',
                }}
                onClick={(e) => handleCableClick(cable.id, e)}
              />
              {/* Cable plugs */}
              <circle cx={fromPos.x} cy={fromPos.y} r="6" fill="#333" stroke={cable.color} strokeWidth="2" />
              <circle cx={toPos.x} cy={toPos.y} r="6" fill="#333" stroke={cable.color} strokeWidth="2" />
            </g>
          );
        })}

        {/* Active cable being drawn */}
        {activeCableFromId && jackPositions[activeCableFromId] && (
          <>
            <path
              d={drawCablePath(jackPositions[activeCableFromId], mousePos)}
              stroke={activeCableColor}
              strokeWidth="4"
              fill="none"
              opacity="0.7"
              strokeDasharray="6,4"
              strokeLinecap="round"
            />
            <circle
              cx={jackPositions[activeCableFromId].x}
              cy={jackPositions[activeCableFromId].y}
              r="6"
              fill="#333"
              stroke={activeCableColor}
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Cable type legend */}
      <div style={{
        position: 'absolute',
        bottom: '-22px',
        left: '0',
        right: '0',
        fontSize: '5px',
        color: '#666',
        display: 'flex',
        justifyContent: 'center',
        gap: '6px',
      }}>
        <span style={{ color: '#00ff00' }}>● Audio</span>
        <span style={{ color: '#ffaa00' }}>● CV</span>
        <span style={{ color: '#ff0000' }}>● Gate</span>
        <span style={{ color: '#00ffff' }}>● Clock</span>
      </div>
    </div>
  );
}
