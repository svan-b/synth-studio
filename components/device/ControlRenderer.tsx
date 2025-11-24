'use client';

import type { ControlSpec, KnobSpec, SwitchSpec, ButtonSpec } from '@/types';
import Knob from '@/components/controls/Knob';
import Switch from '@/components/controls/Switch';
import Button from '@/components/controls/Button';

interface ControlRendererProps {
  id: string;
  spec: ControlSpec;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
  highlighted?: boolean;
  targetValue?: number | string | boolean;
  showTarget?: boolean;
}

/**
 * ControlRenderer - Renders the appropriate control component based on spec type
 * This is the core of the data-driven architecture
 */
export default function ControlRenderer({
  id,
  spec,
  value,
  onChange,
  highlighted = false,
  targetValue,
  showTarget = false,
}: ControlRendererProps) {
  switch (spec.type) {
    case 'knob':
      return (
        <Knob
          id={id}
          spec={spec as KnobSpec}
          value={value as number}
          onChange={onChange as (v: number) => void}
          highlighted={highlighted}
          targetValue={targetValue as number | undefined}
          showTarget={showTarget}
        />
      );

    case 'switch':
      return (
        <Switch
          id={id}
          spec={spec as SwitchSpec}
          value={value as number}
          onChange={onChange as (v: number) => void}
          highlighted={highlighted}
          targetValue={targetValue as number | undefined}
        />
      );

    case 'button':
      return (
        <Button
          id={id}
          spec={spec as ButtonSpec}
          value={value as boolean}
          onChange={onChange as (v: boolean) => void}
          highlighted={highlighted}
        />
      );

    case 'jack':
      // Jacks are handled separately in the PatchBay component
      return null;

    default:
      console.warn(`Unknown control type: ${(spec as ControlSpec).type}`);
      return null;
  }
}
