'use client';

import { useLayoutEffect, useRef, useState, ReactNode } from 'react';

interface ResponsiveDeviceContainerProps {
  children: ReactNode;
  /** 'fit' scales the panel to the available width; a number is a fixed zoom */
  zoom: 'fit' | number;
  /**
   * On touch screens, let 'fit' shrink the panel a little more (at most 20%) so
   * it ends above the bottom of the screen: a mixer's faders and crossfader stay
   * in view with its EQs. Taller panels keep the width fit and scroll.
   */
  fitHeight?: boolean;
  minScale?: number;
  maxScale?: number;
  onScaleChange?: (scale: number, fitScale: number) => void;
}

/**
 * Scales a fixed-size hardware panel to its container with a CSS transform,
 * and - unlike a bare transform - reserves the *scaled* size in the layout, so
 * nothing overlaps or leaves a gap. When zoomed past "fit" it scrolls sideways.
 */
export default function ResponsiveDeviceContainer({
  children,
  zoom,
  fitHeight = false,
  minScale = 0.35,
  maxScale = 1.25,
  onScaleChange,
}: ResponsiveDeviceContainerProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState({ w: 0, h: 0 });
  const [avail, setAvail] = useState(0);
  // Room below the panel's top edge on a touch screen (0 = don't fit the height)
  const [room, setRoom] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      setAvail(outer.clientWidth);
      const w = inner.offsetWidth;
      const h = inner.offsetHeight;
      setNative(n => (n.w === w && n.h === h ? n : { w, h }));
      const touch = fitHeight && window.matchMedia('(pointer: coarse)').matches;
      // From the page top, so scrolling doesn't change it; 12 px clear of the bottom edge
      setRoom(touch ? window.innerHeight - (outer.getBoundingClientRect().top + window.scrollY) - 12 : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    // A message or toolbar row appearing above moves the panel down without resizing it
    if (fitHeight) ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fitHeight]);

  const widthFit = native.w > 0 && avail > 0 ? Math.max(minScale, Math.min(maxScale, (avail - 8) / native.w)) : 1;
  const heightFit = room > 0 && native.h > 0 ? room / native.h : Infinity;
  const fitBase = Math.min(1, widthFit);
  const fitScale = heightFit < fitBase && heightFit >= fitBase * 0.8 ? heightFit : widthFit;
  const scale = zoom === 'fit' ? Math.min(1, fitScale) : zoom;

  const lastReported = useRef('');
  useLayoutEffect(() => {
    const key = `${scale.toFixed(3)}|${fitScale.toFixed(3)}`;
    if (key !== lastReported.current) {
      lastReported.current = key;
      onScaleChange?.(scale, fitScale);
    }
  }, [scale, fitScale, onScaleChange]);

  const scaledW = native.w * scale;
  const scaledH = native.h * scale;
  const overflow = scaledW > avail + 1;

  return (
    <div ref={outerRef} className="w-full" style={{ overflowX: overflow ? 'auto' : 'visible', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
      <div
        className="relative"
        style={{
          width: native.w ? scaledW : undefined,
          height: native.h ? scaledH + 24 : undefined,
          margin: overflow ? undefined : '0 auto',
        }}
      >
        <div
          ref={innerRef}
          className="absolute left-0 top-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left', visibility: native.w ? 'visible' : 'hidden' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
