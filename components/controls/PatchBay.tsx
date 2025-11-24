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
  toId: string;
  color: string;
}

interface PatchBayProps {
  jacks: PatchPoint[];
  onConnection?: (from: string, to: string, color: string) => void;
  onDisconnection?: (from: string, to: string) => void;
}

// Cable colors for different signal types (matching DFAM manual conventions)
const CABLE_COLORS = {
  audio: '#22c55e',      // Green for audio signals
  cv: '#f97316',         // Orange for CV/modulation
  gate: '#ef4444',       // Red for gates/triggers
  clock: '#06b6d4',      // Cyan for clock signals
  envelope: '#a855f7',   // Purple for envelope outputs
} as const;

// Determine signal type based on jack label
const getSignalType = (jackLabel: string): keyof typeof CABLE_COLORS => {
  const label = jackLabel.toUpperCase();
  if (label.includes('TRIGGER') || label.includes('GATE') || label.includes('RUN')) return 'gate';
  if (label.includes('CLOCK') || label.includes('ADV')) return 'clock';
  if (label.includes('EG') && !label.includes('AMT')) return 'envelope';
  if (label.includes('VCA') && !label.includes('CV') && !label.includes('DECAY')) return 'audio';
  if (label.includes('VCO 1') || label.includes('VCO 2') || label.includes('EXT AUDIO')) return 'audio';
  return 'cv';
};

export default function PatchBay({ jacks, onConnection, onDisconnection }: PatchBayProps) {
  const [cables, setCables] = useState<Cable[]>([]);
  const [activeCable, setActiveCable] = useState<{
    fromId: string;
    color: string;
  } | null>(null);
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
    const timeoutId = setTimeout(updatePositions, 50);
    window.addEventListener('resize', updatePositions);

    // Use ResizeObserver for more reliable updates
    const observer = new ResizeObserver(updatePositions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [jacks]);

  // Handle clicking on a jack
  const handleJackClick = useCallback((jack: PatchPoint, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!activeCable) {
      // Start a new cable - outputs can start cables, inputs can receive them
      if (jack.type === 'output') {
        const signalType = getSignalType(jack.label);
        setActiveCable({
          fromId: jack.id,
          color: CABLE_COLORS[signalType],
        });
      }
    } else {
      // Complete the cable connection
      if (jack.type === 'input' && jack.id !== activeCable.fromId) {
        // Check if this connection already exists
        const existingConnection = cables.find(
          c => c.fromId === activeCable.fromId && c.toId === jack.id
        );

        if (!existingConnection) {
          const newCable: Cable = {
            id: `${activeCable.fromId}-${jack.id}-${Date.now()}`,
            fromId: activeCable.fromId,
            toId: jack.id,
            color: activeCable.color,
          };
          setCables(prev => [...prev, newCable]);
          onConnection?.(activeCable.fromId, jack.id, activeCable.color);
        }
      }
      setActiveCable(null);
    }
  }, [activeCable, cables, onConnection]);

  // Handle clicking on a cable to remove it
  const handleCableClick = useCallback((cable: Cable, e: React.MouseEvent) => {
    e.stopPropagation();
    setCables(prev => prev.filter(c => c.id !== cable.id));
    onDisconnection?.(cable.fromId, cable.toId);
  }, [onDisconnection]);

  // Handle mouse move for drawing active cable
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeCable && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, [activeCable]);

  // Cancel active cable on background click
  const handleContainerClick = useCallback(() => {
    if (activeCable) {
      setActiveCable(null);
    }
  }, [activeCable]);

  // Draw cable path with natural sag
  const drawCablePath = useCallback((fromPos: JackPosition, toPos: { x: number; y: number }) => {
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Natural cable sag increases with distance
    const sag = Math.min(distance * 0.25, 30);

    const midX = (fromPos.x + toPos.x) / 2;
    const midY = Math.max(fromPos.y, toPos.y) + sag;

    return `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;
  }, []);

  // Check if a jack has a connection
  const getJackConnection = useCallback((jackId: string): Cable | undefined => {
    return cables.find(c => c.fromId === jackId || c.toId === jackId);
  }, [cables]);

  // Organize jacks by column
  const organizedJacks: Record<number, PatchPoint[]> = {};
  jacks.forEach(jack => {
    if (!organizedJacks[jack.column]) {
      organizedJacks[jack.column] = [];
    }
    organizedJacks[jack.column].push(jack);
  });

  // Sort each column by row
  Object.values(organizedJacks).forEach(col => col.sort((a, b) => a.row - b.row));

  // Get max rows across all columns
  const maxRows = Math.max(...Object.values(organizedJacks).map(col => col.length), 0);

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      className="relative select-none"
      style={{
        minHeight: maxRows * 28 + 60,
        cursor: activeCable ? 'crosshair' : 'default',
      }}
    >
      {/* Column Headers */}
      <div className="flex justify-between mb-2 px-1">
        <div className="flex gap-1">
          <span className="text-[6px] text-gray-500 font-bold w-[52px] text-center">INPUT</span>
          <span className="text-[6px] text-gray-500 font-bold w-[52px] text-center">INPUT</span>
        </div>
        <span className="text-[6px] text-white font-bold w-[52px] text-center">OUTPUT</span>
      </div>

      {/* Jack Grid - 3 columns */}
      <div className="flex gap-1 justify-between">
        {[0, 1, 2].map(colIndex => {
          const isOutputColumn = colIndex === 2;
          const columnJacks = organizedJacks[colIndex] || [];

          return (
            <div
              key={colIndex}
              className="flex flex-col gap-1"
              style={{
                background: isOutputColumn ? '#1a1a1a' : '#0d0d0d',
                padding: '6px 4px',
                borderRadius: '4px',
                width: 52,
              }}
            >
              {columnJacks.map((jack) => {
                const connection = getJackConnection(jack.id);
                const isActive = activeCable?.fromId === jack.id;
                const canConnect = activeCable && jack.type === 'input';

                return (
                  <div
                    key={jack.id}
                    className="flex flex-col items-center gap-0.5"
                  >
                    {/* Label */}
                    <span
                      className="text-center leading-tight"
                      style={{
                        fontSize: '5px',
                        color: isOutputColumn ? '#ddd' : '#777',
                        fontWeight: isOutputColumn ? 'bold' : 'normal',
                        maxWidth: 44,
                        lineHeight: 1.1,
                      }}
                    >
                      {jack.label}
                    </span>

                    {/* Jack Socket */}
                    <div
                      ref={(el) => { jackRefs.current[jack.id] = el; }}
                      onClick={(e) => handleJackClick(jack, e)}
                      className="relative transition-transform duration-100"
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 30% 30%, #222 0%, #111 100%)',
                        border: `2px solid ${
                          isActive ? '#fff' :
                          canConnect ? '#6b6' :
                          isOutputColumn ? '#666' : '#444'
                        }`,
                        boxShadow: isOutputColumn
                          ? '0 0 4px rgba(255, 255, 255, 0.15), inset 0 1px 3px rgba(0,0,0,0.6)'
                          : 'inset 0 2px 4px rgba(0,0,0,0.7)',
                        cursor: jack.type === 'output' || canConnect ? 'pointer' : 'default',
                        transform: isActive || canConnect ? 'scale(1.15)' : 'scale(1)',
                      }}
                    >
                      {/* Connection indicator dot */}
                      {connection && (
                        <div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{
                            width: 7,
                            height: 7,
                            background: connection.color,
                            boxShadow: `0 0 4px ${connection.color}`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* SVG Layer for Cables */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Cable shadow filter */}
          <filter id="cableShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Render completed cables */}
        {cables.map(cable => {
          const fromPos = jackPositions[cable.fromId];
          const toPos = jackPositions[cable.toId];

          if (!fromPos || !toPos) return null;

          return (
            <g key={cable.id} style={{ pointerEvents: 'stroke' }}>
              {/* Cable shadow */}
              <path
                d={drawCablePath(fromPos, toPos)}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="7"
                fill="none"
                strokeLinecap="round"
              />
              {/* Main cable */}
              <path
                d={drawCablePath(fromPos, toPos)}
                stroke={cable.color}
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                style={{
                  cursor: 'pointer',
                  filter: `drop-shadow(0 0 3px ${cable.color})`,
                }}
                onClick={(e) => handleCableClick(cable, e as unknown as React.MouseEvent)}
              />
              {/* Cable plugs */}
              <circle
                cx={fromPos.x}
                cy={fromPos.y}
                r="7"
                fill="#222"
                stroke={cable.color}
                strokeWidth="2"
              />
              <circle
                cx={toPos.x}
                cy={toPos.y}
                r="7"
                fill="#222"
                stroke={cable.color}
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* Active cable being drawn */}
        {activeCable && jackPositions[activeCable.fromId] && (
          <g>
            <path
              d={drawCablePath(jackPositions[activeCable.fromId], mousePos)}
              stroke={activeCable.color}
              strokeWidth="5"
              fill="none"
              opacity="0.7"
              strokeDasharray="8,4"
              strokeLinecap="round"
            />
            <circle
              cx={jackPositions[activeCable.fromId].x}
              cy={jackPositions[activeCable.fromId].y}
              r="7"
              fill="#222"
              stroke={activeCable.color}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Cable Color Legend */}
      <div className="absolute -bottom-5 left-0 right-0 flex justify-center gap-3 text-[5px] text-gray-500">
        <span><span style={{ color: CABLE_COLORS.audio }}>●</span> Audio</span>
        <span><span style={{ color: CABLE_COLORS.cv }}>●</span> CV</span>
        <span><span style={{ color: CABLE_COLORS.gate }}>●</span> Gate</span>
        <span><span style={{ color: CABLE_COLORS.clock }}>●</span> Clock</span>
        <span><span style={{ color: CABLE_COLORS.envelope }}>●</span> EG</span>
      </div>

      {/* Instructions tooltip */}
      {!cables.length && !activeCable && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] text-gray-600 text-center pointer-events-none">
          Click OUTPUT jack to start patch
        </div>
      )}
    </div>
  );
}
