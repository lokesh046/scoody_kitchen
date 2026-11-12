import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Checks a chosen photo; returns a message when it can't be used. */
const photoProblem = (f: File): string | null => {
  if (!OK_TYPES.includes(f.type)) return 'Use a JPG, PNG or WebP photo.';
  if (f.size > MAX_BYTES) return 'The photo is too large (max 8 MB).';
  return null;
};

/**
 * Vaccine card photo: "Upload photo" (choose a file) or "Take photo" (camera). The photo is
 * required wherever a dose is recorded. On phones "Take photo" opens the camera app directly; on
 * a computer it opens a small webcam window.
 */
export function VaccineCardPhotoPicker({ file, onChange, label = 'Vaccine card photo' }: {
  file: File | null;
  onChange: (f: File | null) => void;
  label?: string;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = (f: File | undefined | null) => {
    if (!f) return;
    const p = photoProblem(f);
    setProblem(p ?? '');
    if (!p) onChange(f);
  };

  const takePhoto = () => {
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (touch) captureRef.current?.click();
    else setCameraOpen(true);
  };

  return (
    <div className="font-body text-sm text-ink">
      <div className="mb-2">{label} <span className="text-paprika">*</span></div>
      {file && preview ? (
        <div className="flex items-center gap-3 border border-cardboard rounded-[12px] p-3 bg-white">
          <img src={preview} alt="Vaccine card" className="w-14 h-14 object-cover rounded-[10px] border border-cardboard" />
          <div className="min-w-0 flex-1 truncate">{file.name}</div>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove photo"
            className="w-11 h-11 shrink-0 border border-cardboard rounded-[12px] flex items-center justify-center cursor-pointer hover:bg-paperLight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => uploadRef.current?.click()}
            className="min-h-11 px-4 border border-dashed border-herb/40 rounded-[12px] bg-white text-paprika font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-herb/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
            <ImagePlus className="w-4 h-4" /> Upload photo
          </button>
          <button type="button" onClick={takePhoto}
            className="min-h-11 px-4 border border-dashed border-herb/40 rounded-[12px] bg-white text-paprika font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-herb/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
            <Camera className="w-4 h-4" /> Take photo
          </button>
        </div>
      )}
      <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={captureRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
      {problem && <div className="text-paprika mt-1">{problem}</div>}
      {cameraOpen && <WebcamCapture onClose={() => setCameraOpen(false)} onCapture={(f) => { setCameraOpen(false); accept(f); }} />}
    </div>
  );
}

function WebcamCapture({ onCapture, onClose }: { onCapture: (f: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch {
        setError("We couldn't open the camera. Allow camera access, or use Upload photo instead.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `vaccine-card-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-ink bg-opacity-70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Take a photo of the vaccine card">
      <div className="w-full max-w-md bg-paper border border-cardboard rounded-sm p-4 space-y-3">
        {error ? (
          <p className="text-paprika text-sm">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted className="w-full rounded-sm bg-black aspect-video object-cover" />
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-9 px-3 border border-cardboard rounded-sm font-mono text-[10px] uppercase font-bold cursor-pointer">Cancel</button>
          {!error && (
            <button type="button" disabled={!ready} onClick={snap} className="h-9 px-4 bg-paprika text-white rounded-sm font-mono text-[10px] uppercase font-bold cursor-pointer disabled:opacity-50 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
