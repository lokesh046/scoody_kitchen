import { useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, PawPrint, ScanLine, Upload } from 'lucide-react';

interface PetBreedScanUploadProps {
  previewUrl: string | null;
  fileName?: string;
  isScanning: boolean;
  onUpload: () => void;
  onCamera: () => void;
  onSelect: (file: File) => void;
  onScan: () => void;
}

export function PetBreedScanUpload({ previewUrl, fileName, isScanning, onUpload, onCamera, onSelect, onScan }: PetBreedScanUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const buttonFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric focus-visible:ring-offset-2';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)] gap-8 lg:gap-12 items-center">
      <div className="min-w-0">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!isScanning) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file && !isScanning) onSelect(file);
          }}
          className={`rounded-2xl border bg-paper/70 p-5 sm:p-8 transition-colors duration-200 ${isDragging ? 'border-turmeric bg-turmeric/10' : 'border-cardboard hover:border-turmeric/70'}`}
        >
          {previewUrl ? (
            <div className="space-y-4">
              <img src={previewUrl} alt="Selected pet photo for the breed scan" className="h-56 sm:h-64 w-full rounded-xl object-contain bg-cardboard/20" />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-base text-ink">{isScanning ? 'Looking at your pet’s photo' : 'Check your photo'}</p>
                  <p className="mt-1 truncate font-body text-xs text-ink/65">{fileName || 'Your selected photo'}</p>
                </div>
                <button type="button" onClick={onUpload} disabled={isScanning} className={`shrink-0 min-h-11 px-2 font-body font-bold text-sm text-paprika underline underline-offset-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded ${buttonFocus}`}>
                  Change photo
                </button>
              </div>
              <button type="button" onClick={onScan} disabled={isScanning} className={`w-full min-h-12 rounded-lg bg-paprika px-5 py-3 font-body font-bold text-sm text-white hover:bg-paprika/90 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-wait ${buttonFocus}`}>
                {isScanning ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ScanLine aria-hidden="true" className="h-4 w-4" />}
                {isScanning ? 'Scanning photo…' : 'Scan photo'}
              </button>
              <p role="status" aria-live="polite" className="font-body text-xs leading-relaxed text-center text-ink/65">
                {isScanning ? 'Finding possible breed matches. Your results will appear here.' : 'You can review and edit the suggested breed before saving.'}
              </p>
            </div>
          ) : (
            <div className="min-h-[280px] flex flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-turmeric border border-cardboard/60">
                <ImagePlus aria-hidden="true" className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h4 className="font-display font-semibold text-xl sm:text-2xl text-ink">Start with a photo of your pet</h4>
              <p className="mt-2 max-w-xs font-body text-sm leading-relaxed text-ink/70">Drag a photo here, choose a file, or take one with your camera.</p>
              <div className="mt-6 flex w-full max-w-sm flex-col sm:flex-row gap-3">
                <button type="button" onClick={onUpload} className={`flex-1 min-h-12 rounded-lg bg-paprika text-white px-4 py-3 font-body font-bold text-sm hover:bg-paprika/90 flex items-center justify-center gap-2 transition-colors cursor-pointer ${buttonFocus}`}>
                  <Upload aria-hidden="true" className="h-4 w-4" />Upload photo
                </button>
                <button type="button" onClick={onCamera} className={`flex-1 min-h-12 rounded-lg border border-cardboard bg-white text-ink px-4 py-3 font-body font-bold text-sm hover:border-turmeric flex items-center justify-center gap-2 transition-colors cursor-pointer ${buttonFocus}`}>
                  <Camera aria-hidden="true" className="h-4 w-4" />Use camera
                </button>
              </div>
              <p className="mt-4 font-body text-xs text-ink/60">JPG, PNG or WebP</p>
            </div>
          )}
        </div>
        <p className="mt-4 font-body text-sm leading-relaxed text-ink/70"><span className="font-bold text-ink">For the best result:</span> use a clear, well-lit photo showing your pet’s face and body, with one pet in the frame.</p>
      </div>

      <aside className="min-w-0 space-y-5" aria-label="Example of your pet’s passport">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-display font-semibold text-lg text-ink">A little more about your companion</h4>
          <span className="shrink-0 rounded-full border border-cardboard px-2.5 py-1 font-body text-xs text-ink/60">Example</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-cardboard bg-paper">
          <div className="flex items-center justify-between gap-3 bg-ink px-5 py-4 text-paper">
            <span className="font-display font-semibold text-base">Companion passport</span>
            <PawPrint aria-hidden="true" className="h-5 w-5 text-turmeric" />
          </div>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 p-5">
            <img src="/images/pet-timeline/traits.webp" alt="A Doberman shown in the example passport" width={96} height={112} className="h-28 w-24 rounded-lg object-cover" />
            <div className="space-y-2">
              <p className="font-display font-semibold text-xl text-ink">Your pet</p>
              <p className="font-body text-xs text-ink/60">Possible breed</p>
              <p className="font-display font-semibold text-sm text-ink">Doberman</p>
              <p className="font-body text-xs text-ink/65">Breed background & traits</p>
            </div>
          </div>
          <p className="border-t border-cardboard/70 px-5 py-3 font-body text-xs text-ink/60">An example only. Your passport will reflect your results.</p>
        </div>
        <ul className="space-y-3 font-body text-sm text-ink/75">
          {['Explore possible breed matches', 'Discover breed background and traits', 'Review details and create a pet profile'].map((text) => (
            <li key={text} className="flex items-start gap-2.5"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-paprika" />{text}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
