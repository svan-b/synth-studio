'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getDFAMEngine, DFAMAudioEngine, DFAMParams } from './dfam-engine';

interface UseDFAMAudioOptions {
  values: Record<string, number | string | boolean>;
  onStepChange?: (step: number) => void;
}

interface UseDFAMAudioReturn {
  isAudioReady: boolean;
  currentStep: number;
  initializeAudio: () => Promise<void>;
  triggerSound: () => void;
}

/**
 * React hook to connect DFAM UI controls to the audio engine
 *
 * Usage:
 * ```tsx
 * const { isAudioReady, currentStep, initializeAudio, triggerSound } = useDFAMAudio({
 *   values: controlValues,
 *   onStepChange: (step) => setActiveStep(step),
 * });
 * ```
 */
export function useDFAMAudio({ values, onStepChange }: UseDFAMAudioOptions): UseDFAMAudioReturn {
  const engineRef = useRef<DFAMAudioEngine | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const prevValuesRef = useRef<Record<string, number | string | boolean>>({});

  // Initialize audio engine (must be called after user interaction)
  const initializeAudio = useCallback(async () => {
    if (engineRef.current?.isReady()) {
      setIsAudioReady(true);
      return;
    }

    try {
      const engine = getDFAMEngine();
      await engine.initialize();

      // Set up step change callback
      engine.setOnStepChange((step) => {
        setCurrentStep(step);
        onStepChange?.(step);
      });

      engineRef.current = engine;
      setIsAudioReady(true);

      // Sync all current values to the engine
      Object.entries(values).forEach(([key, value]) => {
        engine.setParam(key as keyof DFAMParams, value as number | boolean);
      });

      console.log('[useDFAMAudio] Audio initialized and synced');
    } catch (error) {
      console.error('[useDFAMAudio] Failed to initialize audio:', error);
    }
  }, [values, onStepChange]);

  // Sync control value changes to the audio engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.isReady()) return;

    // Find changed values and update them
    Object.entries(values).forEach(([key, value]) => {
      const prevValue = prevValuesRef.current[key];
      if (prevValue !== value) {
        engine.setParam(key as keyof DFAMParams, value as number | boolean);
      }
    });

    // Update previous values ref
    prevValuesRef.current = { ...values };
  }, [values]);

  // Trigger sound manually
  const triggerSound = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.isReady()) {
      console.warn('[useDFAMAudio] Audio not ready, initializing...');
      initializeAudio().then(() => {
        engineRef.current?.triggerEnvelopes();
      });
      return;
    }
    engine.triggerEnvelopes();
  }, [initializeAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't dispose - let the singleton persist for page navigation
      // The engine will be disposed when the page unloads
    };
  }, []);

  return {
    isAudioReady,
    currentStep,
    initializeAudio,
    triggerSound,
  };
}
