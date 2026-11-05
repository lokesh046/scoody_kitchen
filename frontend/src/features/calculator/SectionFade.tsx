// Soft colour hand-offs between the sections of the Count The Calories page: each section ends in a
// fade toward the next section's colour, so there is no hard line where one section meets the next.
const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// Sits in the bottom padding of a section and fades into `to`, the colour the next section starts with.
export function BottomFade({ to }: { to: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-36 md:h-44"
      style={{
        background: `linear-gradient(to bottom, ${rgba(to, 0)} 0%, ${rgba(to, 0.5)} 40%, ${rgba(to, 0.86)} 75%, ${to} 100%)`,
      }}
    />
  );
}
