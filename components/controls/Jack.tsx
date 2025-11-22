'use client';

import type { JackProps } from '@/types';

export default function Jack({ id, label, value, onChange, highlighted, type = 'input' }: JackProps) {
  const handleClick = () => {
    onChange(!value);
  };

  return (
    <div className="flex items-center gap-2 relative h-[16px]">
      {/* Label - positioned to left of jack */}
      <div
        className="text-[7px] text-hardware-label uppercase font-label tracking-wider text-right leading-none"
        style={{ width: '70px', flexShrink: 0 }}
      >
        {label}
      </div>

      {/* Jack Socket */}
      <div
        onClick={handleClick}
        className={`
          relative cursor-pointer flex-shrink-0
          transition-all duration-150
          ${highlighted ? 'ring-2 ring-teaching-current animate-pulse' : ''}
        `}
        style={{
          width: '16px',
          height: '16px',
        }}
      >
        <div
          className={`
            absolute inset-0
            rounded-full
            border-2
            ${type === 'input' ? 'border-[#666] bg-[#1a1a1a]' : 'border-[#888] bg-[#2a2a2a]'}
            ${value ? 'bg-accent' : ''}
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
              width: '6px',
              height: '6px',
            }}
          />
        </div>

        {/* Connection indicator */}
        {value && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent animate-pulse"
            style={{
              width: '4px',
              height: '4px',
            }}
          />
        )}
      </div>
    </div>
  );
}
