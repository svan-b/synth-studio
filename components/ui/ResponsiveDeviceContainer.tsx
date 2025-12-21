'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface UtilityControls {
  onResetControls?: () => void;
  onClearCables?: () => void;
  isAudioReady?: boolean;
}

interface ResponsiveDeviceContainerProps {
  children: ReactNode;
  baseWidth: number;  // The native width of the device in pixels
  minScale?: number;  // Minimum scale factor (default 0.6)
  maxScale?: number;  // Maximum scale factor (default 1.0)
  utilityControls?: UtilityControls;  // Optional utility controls to display
}

/**
 * ResponsiveDeviceContainer
 *
 * Scales the device to fit the viewport while maintaining pixel-perfect
 * internal layout. Uses CSS transform for scaling.
 *
 * For iPad landscape (1024px), a 1005px device will scale to ~0.95
 * For smaller screens, scaling will be more aggressive but never below minScale
 */
export default function ResponsiveDeviceContainer({
  children,
  baseWidth,
  minScale = 0.6,
  maxScale = 1.0,
  utilityControls,
}: ResponsiveDeviceContainerProps) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateScale = () => {
      // Get available width (viewport width minus padding)
      const padding = 48; // 24px on each side
      const availableWidth = window.innerWidth - padding;

      // Calculate scale needed to fit
      let newScale = availableWidth / baseWidth;

      // Clamp to min/max
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      setScale(newScale);
    };

    // Calculate on mount and resize
    calculateScale();
    window.addEventListener('resize', calculateScale);

    return () => window.removeEventListener('resize', calculateScale);
  }, [baseWidth, minScale, maxScale]);

  const hasUtilityControls = utilityControls && (
    utilityControls.onResetControls ||
    utilityControls.onClearCables ||
    utilityControls.isAudioReady !== undefined
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center overflow-visible"
    >
      {/* Utility Control Bar - scales with device */}
      {hasUtilityControls && (
        <div
          className="flex items-center justify-center gap-3 mb-2 px-4 py-1.5 bg-[#1a1a1a] rounded-full border border-[#333]"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center bottom',
          }}
        >
          {utilityControls.onResetControls && (
            <button
              onClick={utilityControls.onResetControls}
              className="px-3 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 text-white rounded-full whitespace-nowrap transition-colors"
              title="Reset all knobs to default values"
            >
              Reset Knobs
            </button>
          )}
          {utilityControls.onClearCables && (
            <button
              onClick={utilityControls.onClearCables}
              className="px-3 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 text-white rounded-full whitespace-nowrap transition-colors"
              title="Remove all patch cables"
            >
              Clear Cables
            </button>
          )}
          {/* Audio status indicator - only show if isAudioReady is explicitly provided */}
          {utilityControls.isAudioReady !== undefined && (
            <div
              className="flex items-center gap-1.5 text-[10px] text-gray-400 px-2"
              title={utilityControls.isAudioReady ? 'Audio engine active' : 'Click any control to enable audio'}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: utilityControls.isAudioReady ? '#22c55e' : '#666',
                  boxShadow: utilityControls.isAudioReady ? '0 0 4px #22c55e' : 'none',
                }}
              />
              <span>{utilityControls.isAudioReady ? 'Audio' : 'Audio OFF'}</span>
            </div>
          )}
        </div>
      )}

      {/* Scaled Device */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
