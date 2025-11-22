'use client';

interface IndicatorProps {
  type: 'current' | 'optional' | 'correct' | 'wrong';
  children: React.ReactNode;
}

export default function Indicator({ type, children }: IndicatorProps) {
  const classNames = {
    current: 'teaching-current',
    optional: 'teaching-optional',
    correct: 'teaching-correct',
    wrong: 'teaching-wrong',
  };

  return (
    <div className={classNames[type]}>
      {children}
    </div>
  );
}
