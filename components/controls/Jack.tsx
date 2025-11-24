'use client';

import type { JackSpec } from '@/types';

export interface JackProps {
  id: string;
  spec: JackSpec;
  isConnected: boolean;
  onConnect?: () => void;
  highlighted?: boolean;
}

export default function Jack({ id, spec, isConnected, onConnect, highlighted }: JackProps) {
  const { label, jackType } = spec;

  const handleClick = () => {
    onConnect?.();
  };

  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      {/* Jack Socket */}
      <div
        onClick={handleClick}
        className={`
          relative cursor-pointer flex-shrink-0
          transition-all duration-150
          ${highlighted ? 'ring-2 ring-teaching-current animate-pulse' : ''}
        `}
        style={{
          width: '14px',
          height: '14px',
        }}
        title={spec.description}
      >
        <div
          className={`
            absolute inset-0
            rounded-full
            border-2
            ${jackType === 'input' ? 'border-[#666] bg-[#1a1a1a]' : 'border-[#888] bg-[#2a2a2a]'}
            ${isConnected ? 'bg-accent' : ''}
            shadow-inner
          `}
          style={{
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {/* Center hole */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
            style={{
              width: '5px',
              height: '5px',
            }}
          />
        </div>

        {/* Connection indicator */}
        {isConnected && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent animate-pulse"
            style={{
              width: '3px',
              height: '3px',
            }}
          />
        )}
      </div>

      {/* Label - below jack, very small */}
      <div
        className="text-[5px] text-hardware-label uppercase font-label tracking-tight text-center leading-none"
        style={{ maxWidth: '45px', wordWrap: 'break-word' }}
      >
        {label}
      </div>
    </div>
  );
}
