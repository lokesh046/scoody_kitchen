import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export function LoginDogsVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 768px)');
    const syncPlayback = () => setPlaying(desktop.matches && !preference.matches);
    syncPlayback();
    preference.addEventListener('change', syncPlayback);
    desktop.addEventListener('change', syncPlayback);
    return () => {
      preference.removeEventListener('change', syncPlayback);
      desktop.removeEventListener('change', syncPlayback);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoFailed) return;
    let cancelled = false;
    if (playing) {
      video.play().catch(() => {
        if (!cancelled) setPlaying(false);
      });
    } else {
      video.pause();
    }
    return () => { cancelled = true; };
  }, [playing, videoFailed]);

  return (
    <div className="group relative isolate h-full w-full overflow-hidden rounded-md bg-ink">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-center [filter:saturate(.85)_sepia(.08)]"
        src="/videos/login-dogs.mp4"
        poster="/videos/login-dogs-poster.webp"
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden="true"
        onError={() => { setVideoFailed(true); setPlaying(false); }}
      />
      {videoFailed && (
        <img
          src="/videos/login-dogs-poster.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover [filter:saturate(.85)_sepia(.08)]"
        />
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-7 lg:p-10 xl:p-12">
        <p className="text-balance font-display text-[1.75rem] font-medium leading-[1.08] tracking-[-0.025em] text-paper lg:text-[2.75rem] xl:text-5xl">
          Good food.<br />Happy pets.
        </p>
        {!videoFailed && (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? 'Pause video' : 'Play video'}
            className="mt-6 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-paper/40 bg-ink/30 px-4 text-paper opacity-0 pointer-events-none transition-[opacity,background-color] duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto hover:bg-ink/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper motion-reduce:transition-none"
          >
            {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />}
            <span className="font-body text-xs font-semibold">{playing ? 'Pause video' : 'Play video'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
