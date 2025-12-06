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

// Cable colors - cycle through these for each new cable
const CABLE_COLOR_PALETTE = [
  '#22c55e',  // Green
  '#f97316',  // Orange
  '#ef4444',  // Red
  '#06b6d4',  // Cyan
  '#a855f7',  // Purple
  '#eab308',  // Yellow
  '#ec4899',  // Pink
  '#3b82f6',  // Blue
  '#14b8a6',  // Teal
  '#f43f5e',  // Rose
];

export default function PatchBay({ jacks, onConnection, onDisconnection }: PatchBayProps) {
  const [cables, setCables] = useState<Cable[]>([]);
  const [activeCable, setActiveCable] = useState<{
    fromId: string;
    color: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [jackPositions, setJackPositions] = useState<Record<string, JackPosition>>({});
  const [colorIndex, setColorIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const jackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Get next color in the palette
  const getNextColor = useCallback(() => {
    const color = CABLE_COLOR_PALETTE[colorIndex % CABLE_COLOR_PALETTE.length];
    setColorIndex(prev => prev + 1);
    return color;
  }, [colorIndex]);

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
    const timeoutId = setTimeout(updatePositions, 100);
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

  // Handle clicking on a jack - allow any-to-any connections
  const handleJackClick = useCallback((jack: PatchPoint, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!activeCable) {
      // Start a new cable from any jack
      const color = getNextColor();
      setActiveCable({
        fromId: jack.id,
        color,
      });
    } else {
      // Complete the cable connection - allow any-to-any, just not same jack
      if (jack.id !== activeCable.fromId) {
        // Check if this exact connection already exists (in either direction)
        const existingConnection = cables.find(
          c => (c.fromId === activeCable.fromId && c.toId === jack.id) ||
               (c.fromId === jack.id && c.toId === activeCable.fromId)
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
  }, [activeCable, cables, onConnection, getNextColor]);

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
    const sag = Math.min(distance * 0.3, 40);

    const midX = (fromPos.x + toPos.x) / 2;
    const midY = Math.max(fromPos.y, toPos.y) + sag;

    return `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;
  }, []);

  // Check if a jack has a connection
  const getJackConnections = useCallback((jackId: string): Cable[] => {
    return cables.filter(c => c.fromId === jackId || c.toId === jackId);
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
        minHeight: maxRows * 32 + 40,
        cursor: activeCable ? 'crosshair' : 'default',
      }}
    >
      {/* Header - matches DFAM manual styling */}
      <div className="flex justify-center mb-2 px-1">
        <span className="text-[8px] font-bold">
          <span className="text-gray-400">IN</span>
          <span className="text-gray-500"> / </span>
          <span className="bg-white text-black px-1 rounded-sm">OUT</span>
        </span>
      </div>

      {/* Jack Grid - 3 columns */}
      <div className="flex gap-1 justify-between">
        {[0, 1, 2].map(colIndex => {
          const columnJacks = organizedJacks[colIndex] || [];

          return (
            <div
              key={colIndex}
              className="flex flex-col gap-1"
              style={{
                background: '#0d0d0d',
                padding: '6px 2px',
                borderRadius: '4px',
                width: 60,
              }}
            >
              {columnJacks.map((jack) => {
                const connections = getJackConnections(jack.id);
                const isActive = activeCable?.fromId === jack.id;
                const canConnect = activeCable && jack.id !== activeCable.fromId;
                const isOutput = jack.type === 'output';

                return (
                  <div
                    key={jack.id}
                    className="flex flex-col items-center gap-0.5"
                  >
                    {/* Label - outputs get black background with white text based on jack.type */}
                    <span
                      className="text-center leading-tight whitespace-nowrap overflow-visible"
                      style={{
                        fontSize: '5px',
                        color: isOutput ? '#fff' : '#888',
                        fontWeight: 'bold',
                        lineHeight: 1.1,
                        // All labels get same padding for alignment, but only outputs get visible background
                        padding: '1px 3px',
                        borderRadius: '2px',
                        background: isOutput ? '#000' : 'transparent',
                        border: isOutput ? '1px solid #444' : '1px solid transparent',
                      }}
                    >
                      {jack.label}
                    </span>

                    {/* Jack Socket */}
                    <div
                      ref={(el) => { jackRefs.current[jack.id] = el; }}
                      onClick={(e) => handleJackClick(jack, e)}
                      className="relative transition-all duration-100"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 30% 30%, #333 0%, #111 100%)',
                        border: `2px solid ${
                          isActive ? '#fff' :
                          canConnect ? '#8f8' :
                          '#444'
                        }`,
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7)',
                        cursor: 'pointer',
                        transform: isActive || canConnect ? 'scale(1.2)' : 'scale(1)',
                      }}
                    >
                      {/* Connection indicator - show first cable color */}
                      {connections.length > 0 && (
                        <div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                          style={{
                            width: 8,
                            height: 8,
                            background: connections[0].color,
                            boxShadow: `0 0 6px ${connections[0].color}`,
                          }}
                        />
                      )}
                      {/* Show connection count if multiple */}
                      {connections.length > 1 && (
                        <div
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white text-black text-[6px] font-bold flex items-center justify-center"
                        >
                          {connections.length}
                        </div>
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
        style={{ overflow: 'visible', zIndex: 10 }}
      >
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
                stroke="rgba(0,0,0,0.6)"
                strokeWidth="8"
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
                  filter: `drop-shadow(0 0 4px ${cable.color})`,
                }}
                onClick={(e) => handleCableClick(cable, e as unknown as React.MouseEvent)}
              />
              {/* Cable plugs */}
              <circle
                cx={fromPos.x}
                cy={fromPos.y}
                r="8"
                fill="#222"
                stroke={cable.color}
                strokeWidth="2"
              />
              <circle
                cx={toPos.x}
                cy={toPos.y}
                r="8"
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
              opacity="0.8"
              strokeDasharray="10,5"
              strokeLinecap="round"
            />
            <circle
              cx={jackPositions[activeCable.fromId].x}
              cy={jackPositions[activeCable.fromId].y}
              r="8"
              fill="#222"
              stroke={activeCable.color}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Instructions tooltip - hidden by default, shows on hover */}

      {/* Cable count */}
      {cables.length > 0 && (
        <div className="absolute bottom-1 right-1 text-[7px] text-gray-500">
          {cables.length} cable{cables.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
