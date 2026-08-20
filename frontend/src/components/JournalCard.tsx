import React from 'react';

interface StatItem {
  label: string;
  value: string;
}

interface JournalCardProps {
  tabLabel: string;
  title?: string;
  stats: StatItem[];
  children?: React.ReactNode;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  tabLabel,
  title,
  stats,
  children,
}) => {
  return (
    <div className="relative border border-cardboard bg-paperLight p-6 pt-8 rounded-sm shadow-sm mt-4">
      {/* Top Border-Breaking Tab */}
      <div className="absolute -top-3 left-6 bg-paper px-3 py-0.5 border border-cardboard font-mono text-[10px] tracking-wider uppercase text-ink">
        {tabLabel}
      </div>

      {title && (
        <h3 className="font-display text-xl mb-4 text-ink italic">{title}</h3>
      )}

      {children && <div className="mb-4 text-ink text-sm leading-relaxed">{children}</div>}

      {/* Dashed internal divider ("stitch") */}
      {stats.length > 0 && (
        <>
          <div className="border-t border-dashed border-cardboard my-4"></div>
          <ul className="space-y-2">
            {stats.map((stat, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center font-mono text-xs text-ink"
              >
                <span className="opacity-75">{stat.label}</span>
                <span className="font-bold">{stat.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
