import React from 'react';

interface EyebrowProps {
  label: string;
}

export const Eyebrow: React.FC<EyebrowProps> = ({ label }) => {
  return (
    <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-herb">
      <span className="w-6 h-[1px] bg-herb opacity-60"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-herb inline-block"></span>
      <span>{label}</span>
    </div>
  );
};
