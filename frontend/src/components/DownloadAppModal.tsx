import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { APP_DOWNLOAD_PATH } from '../constants/appLinks';
import { AppStoreBadges } from './AppStoreBadges';

interface DownloadAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadAppModal({ open, onClose }: DownloadAppModalProps) {
  if (!open) return null;

  const downloadUrl = `${window.location.origin}${APP_DOWNLOAD_PATH}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-app-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-paper rounded-2xl shadow-2xl px-6 py-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-ink/60 hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="download-app-modal-title" className="font-display font-bold text-xl text-ink mb-1">
          Get the Hearth &amp; One App
        </h2>
        <p className="font-body text-sm text-ink/70 mb-6">
          Scan with your phone's camera to download, or use the links below.
        </p>

        <div className="flex justify-center mb-6">
          <div className="p-3 bg-white rounded-xl border border-ink/10">
            <QRCodeSVG value={downloadUrl} size={176} level="M" />
          </div>
        </div>

        <AppStoreBadges className="flex flex-col sm:flex-row items-center justify-center gap-3" />
      </div>
    </div>
  );
}
