'use client';

import type { JackProps } from '@/types';

export default function Jack({ id, label, value, onChange, highlighted, type = 'input' }: JackProps) {
  const handleClick = () => {
    onChange(!value);
  };

  return (
    <div className="flex flex-col items-center gap-1 relative">
      <div
        onClick={handleClick}
        className={`
          relative cursor-pointer
          transition-all duration-150
          ${highlighted ? 'ring-2 ring-teaching-current animate-pulse' : ''}
        `}
        style={{
          width: '16px',
          height: '16px',
        }}
      >
        {/* Jack Socket */}
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

      {/* Label */}
      <div
        className="text-[7px] text-hardware-label uppercase font-label tracking-wider text-center leading-tight"
        style={{ maxWidth: '50px' }}
      >
        {label}
      </div>
    </div>
  );
}
