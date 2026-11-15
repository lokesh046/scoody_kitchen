import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

const OUTPUT_SIZE = 800;
const MAX_ZOOM = 3;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika focus-visible:ring-offset-2';

// Lets the owner move and zoom a pet photo so the pet sits well inside the round profile picture. The result is a
// square crop (the round shape is applied wherever the photo is shown), so what fits the circle here fits everywhere.
export function PhotoAdjustModal({ file, onApply, onClose }: {
  file: File;
  onApply: (adjusted: File) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Open the photo.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const probe = new Image();
    probe.onload = () => setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.onerror = () => setError('We could not open this photo. Please try another one.');
    probe.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Size the round frame to the screen.
  useEffect(() => {
    const measure = () => setFrame(Math.max(200, Math.min(320, window.innerWidth - 72)));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Keyboard: Escape closes; focus goes into the window and returns to the button that opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);

  const baseScale = natural ? Math.max(frame / natural.w, frame / natural.h) : 1; // the photo just covers the frame
  const scaleFor = (z: number) => baseScale * z;
  const clamp = (point: { x: number; y: number }, z: number) => {
    if (!natural) return { x: 0, y: 0 };
    const scale = scaleFor(z);
    const maxX = Math.max(0, (natural.w * scale - frame) / 2);
    const maxY = Math.max(0, (natural.h * scale - frame) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, point.x)), y: Math.min(maxY, Math.max(-maxY, point.y)) };
  };

  const changeZoom = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(z);
    setOffset((current) => clamp(current, z));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    setOffset(clamp({ x: start.ox + (event.clientX - start.px), y: start.oy + (event.clientY - start.py) }, zoom));
  };
  const endDrag = () => { drag.current = null; };

  const onFrameKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 12;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      setOffset((current) => clamp({ x: current.x + moves[event.key][0], y: current.y + moves[event.key][1] }, zoom));
    } else if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(zoom + 0.1); }
    else if (event.key === '-') { event.preventDefault(); changeZoom(zoom - 0.1); }
  };

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    setBusy(true);
    const scale = scaleFor(zoom);
    const side = frame / scale; // the square piece of the photo that is inside the frame, in photo pixels
    const sx = (natural.w * scale / 2 - frame / 2 - offset.x) / scale;
    const sy = (natural.h * scale / 2 - frame / 2 - offset.y) / scale;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBusy(false); setError('Your browser could not adjust this photo.'); return; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob((blob) => {
      if (!blob) { setBusy(false); setError('We could not save the adjusted photo. Please try again.'); return; }
      onApply(new File([blob], `pet_photo_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  const scale = scaleFor(zoom);
  const ready = !!natural && !!url;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="photo-adjust-title" tabIndex={-1} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl outline-none">
        <h2 id="photo-adjust-title" className="font-display text-lg font-bold text-ink">Adjust photo</h2>
        <p className="mt-1 font-body text-sm text-ink/70">Drag the photo to move it, and use the slider to zoom, until your pet fits the circle.</p>

        <div className="mt-4 flex justify-center">
          <div
            role="group"
            tabIndex={0}
            aria-label="Photo position. Use the arrow keys to move the photo, and plus or minus to zoom."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onFrameKey}
            style={{ width: frame, height: frame, touchAction: 'none' }}
            className={`relative cursor-grab overflow-hidden rounded-xl bg-paper active:cursor-grabbing ${FOCUS}`}
          >
            {ready && (
              <img
                ref={imgRef}
                src={url}
                alt="Pet photo being adjusted"
                draggable={false}
                style={{ width: natural.w * scale, height: natural.h * scale, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              />
            )}
            {/* The round window: everything outside the circle is dimmed, so it is clear what will be kept. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(255,255,255,0.7)]" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => changeZoom(zoom - 0.2)} aria-label="Zoom out" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cardboard text-ink cursor-pointer hover:bg-paper ${FOCUS}`}><Minus aria-hidden="true" className="h-4 w-4" /></button>
          <input
            type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            aria-label="Zoom" className="h-2 w-full cursor-pointer accent-paprika"
          />
          <button type="button" onClick={() => changeZoom(zoom + 0.2)} aria-label="Zoom in" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cardboard text-ink cursor-pointer hover:bg-paper ${FOCUS}`}><Plus aria-hidden="true" className="h-4 w-4" /></button>
        </div>

        {error && <p role="alert" className="mt-3 font-body text-sm text-rose-800">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={reset} className={`inline-flex min-h-11 items-center gap-1.5 rounded px-2 font-body text-sm font-bold text-ink/80 cursor-pointer hover:text-ink ${FOCUS}`}><RotateCcw aria-hidden="true" className="h-4 w-4" />Reset</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`min-h-11 rounded-lg border border-cardboard bg-white px-4 font-body text-sm font-bold text-ink cursor-pointer hover:bg-paper ${FOCUS}`}>Cancel</button>
            <button type="button" onClick={apply} disabled={!ready || busy} className={`min-h-11 rounded-lg bg-paprika px-4 font-body text-sm font-bold text-white cursor-pointer hover:bg-paprika/90 disabled:opacity-50 ${FOCUS}`}>{busy ? 'Saving…' : 'Use this photo'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
