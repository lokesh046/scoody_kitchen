import React, { useState } from 'react';
import { 
  Download, 
  Share2, 
  Sparkles, 
  ShieldCheck, 
  Globe2, 
  Dna, 
  Award, 
  Check, 
  Flame, 
  Heart, 
  Eye, 
  Waves, 
  Gauge
} from 'lucide-react';
import type { BreedHeritage } from '../api/vision';

interface PetHeritagePassportProps {
  petName?: string;
  breedName: string;
  species: string;
  photoUrl?: string;
  heritage: BreedHeritage;
}

export const PetHeritagePassport: React.FC<PetHeritagePassportProps> = ({
  petName,
  breedName,
  species,
  photoUrl,
  heritage
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const displayName = petName?.trim() || 'Honored Companion';
  const passportCode = `SK-PASSPORT-${Math.abs(breedName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 1000))}-${new Date().getFullYear()}`;

  // Export passport card to High-Resolution Canvas PNG (2400x1600 4K print-ready)
  const generatePassportImage = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 800;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Vintage Passport Background
    ctx.fillStyle = '#181411'; // ink
    ctx.fillRect(0, 0, width, height);

    // Inner Cream Document Card
    ctx.fillStyle = '#F8F4EE';
    ctx.fillRect(24, 24, width - 48, height - 48);

    // Guilloche security border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#D99B26'; // turmeric
    ctx.strokeRect(36, 36, width - 72, height - 72);

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#2B2520';
    ctx.strokeRect(42, 42, width - 84, height - 84);

    // Header Band
    ctx.fillStyle = '#181411';
    ctx.fillRect(42, 42, width - 84, 90);

    // Header Text
    ctx.fillStyle = '#D99B26';
    ctx.font = 'bold 28px serif';
    ctx.fillText("OFFICIAL COMPANION HERITAGE PASSPORT", 70, 85);

    ctx.fillStyle = '#F8F4EE';
    ctx.font = 'bold 13px monospace';
    ctx.fillText("SCOOBY'S KITCHEN BIOLOGICAL CANINE & FELINE ARCHIVE", 70, 112);

    ctx.fillStyle = '#D99B26';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`DOC NO: ${passportCode}`, width - 360, 95);

    // Left Column: Pet Photo & Stamp
    const photoX = 70;
    const photoY = 160;
    const photoW = 280;
    const photoH = 340;

    ctx.fillStyle = '#E8DFD3';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = '#2B2520';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // Helper to draw image with object-fit: cover and rounded corners
    const drawCoverPhoto = (image: HTMLImageElement, px: number, py: number, pw: number, ph: number) => {
      const imgW = image.naturalWidth || image.width;
      const imgH = image.naturalHeight || image.height;
      if (!imgW || !imgH) return;

      const imgRatio = imgW / imgH;
      const targetRatio = pw / ph;
      let sx = 0, sy = 0, sWidth = imgW, sHeight = imgH;

      if (imgRatio > targetRatio) {
        sWidth = imgH * targetRatio;
        sx = (imgW - sWidth) / 2;
      } else {
        sHeight = imgW / targetRatio;
        sy = (imgH - sHeight) / 2;
      }

      ctx.save();
      // Rounded photo window
      ctx.beginPath();
      const r = 6;
      ctx.moveTo(px + r, py);
      ctx.lineTo(px + pw - r, py);
      ctx.quadraticCurveTo(px + pw, py, px + pw, py + r);
      ctx.lineTo(px + pw, py + ph - r);
      ctx.quadraticCurveTo(px + pw, py + ph, px + pw - r, py + ph);
      ctx.lineTo(px + r, py + ph);
      ctx.quadraticCurveTo(px, py + ph, px, py + ph - r);
      ctx.lineTo(px, py + r);
      ctx.quadraticCurveTo(px, py, px + r, py);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(image, sx, sy, sWidth, sHeight, px, py, pw, ph);
      ctx.restore();
    };

    // Load Pet Photo if available (handles blob URLs, data URLs, and remote URLs)
    if (photoUrl) {
      try {
        const isLocalUrl = photoUrl.startsWith('blob:') || photoUrl.startsWith('data:');
        const img = new Image();
        if (!isLocalUrl) {
          img.crossOrigin = 'anonymous';
        }

        const loaded = await new Promise<boolean>((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => {
            // Fallback for CORS: retry without crossOrigin if remote
            if (!isLocalUrl) {
              const retryImg = new Image();
              retryImg.onload = () => {
                drawCoverPhoto(retryImg, photoX + 6, photoY + 6, photoW - 12, photoH - 12);
                resolve(true);
              };
              retryImg.onerror = () => resolve(false);
              retryImg.src = photoUrl;
            } else {
              resolve(false);
            }
          };
          img.src = photoUrl;
        });

        if (loaded && (img.naturalWidth > 0 || img.width > 0)) {
          drawCoverPhoto(img, photoX + 6, photoY + 6, photoW - 12, photoH - 12);
        }
      } catch (e) {
        console.error('Passport photo draw error:', e);
      }
    }

    // Origin Stamp Seal over photo corner
    ctx.save();
    ctx.translate(photoX + photoW - 50, photoY + photoH - 40);
    ctx.rotate(-0.25);
    ctx.strokeStyle = '#D99B26';
    ctx.lineWidth = 2;
    ctx.strokeRect(-60, -30, 120, 60);
    ctx.fillStyle = '#D99B26';
    ctx.font = 'bold 11px monospace';
    ctx.fillText("CERTIFIED", -40, -10);
    ctx.fillText("HERITAGE", -38, 5);
    ctx.fillText(heritage.origin_era.substring(0, 14), -48, 20);
    ctx.restore();

    // Pet Identity Ledger
    ctx.fillStyle = '#181411';
    ctx.font = 'bold 30px serif';
    ctx.fillText(displayName.toUpperCase(), 385, 190);

    ctx.fillStyle = '#6E6359';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`BREED: ${breedName} (${species})`, 385, 220);

    ctx.fillStyle = '#2B2520';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`HOMELAND: ${heritage.origin_flag} ${heritage.origin_country}`, 385, 250);
    ctx.fillText(`ERA OF ORIGIN: ${heritage.origin_era}`, 385, 275);

    // Mutation & Evolutionary Lore summary
    ctx.fillStyle = '#181411';
    ctx.font = 'bold 14px serif';
    ctx.fillText("EVOLUTIONARY HERITAGE & TRAIT MUTATION:", 385, 320);

    ctx.fillStyle = '#403831';
    ctx.font = '13px sans-serif';
    const words = heritage.mutation_story.split(' ');
    let line = '';
    let lineY = 345;
    for (const n in words) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 720 && Number(n) > 0) {
        ctx.fillText(line, 385, lineY);
        line = words[n] + ' ';
        lineY += 20;
        if (lineY > 430) break;
      } else {
        line = testLine;
      }
    }
    if (line && lineY <= 430) ctx.fillText(line, 385, lineY);

    // Superpower Skills Radar Bar (Bottom section)
    ctx.fillStyle = '#181411';
    ctx.fillRect(42, 530, width - 84, 210);

    ctx.fillStyle = '#D99B26';
    ctx.font = 'bold 15px monospace';
    ctx.fillText("🎖️ BIOLOGICAL SUPERPOWERS & SKILL RATINGS", 70, 565);

    const skills = [
      { name: "Scent & Sniff Radar", val: heritage.superpowers.scent_radar },
      { name: "Stamina & Athletic Speed", val: heritage.superpowers.stamina_speed },
      { name: "Lapdog Cuddle Index", val: heritage.superpowers.cuddle_index },
      { name: "Watchdog Alertness", val: heritage.superpowers.watchdog_instinct },
      { name: "Water & Swimming", val: heritage.superpowers.swimming_affinity },
    ];

    skills.forEach((s, i) => {
      const colX = i < 3 ? 70 : 640;
      const rowY = i < 3 ? 600 + i * 40 : 600 + (i - 3) * 40;

      ctx.fillStyle = '#F8F4EE';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${s.name}:`, colX, rowY);

      // Score text
      ctx.fillStyle = '#D99B26';
      ctx.fillText(`${s.val}/10`, colX + 220, rowY);

      // Progress bar track
      ctx.fillStyle = '#332B25';
      ctx.fillRect(colX + 280, rowY - 11, 180, 12);

      // Progress bar fill
      ctx.fillStyle = '#D99B26';
      ctx.fillRect(colX + 280, rowY - 11, (s.val / 10) * 180, 12);
    });

    return canvas.toDataURL('image/png');
  };

  const handleDownloadPassport = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await generatePassportImage();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${displayName.toLowerCase().replace(/\s+/g, '_')}_heritage_passport.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export passport:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🐾 Check out ${displayName}'s Official Pet Heritage Passport! 🌍 Homeland: ${heritage.origin_flag} ${heritage.origin_country} (${heritage.origin_era})! Superpowers: 👃 Scent Radar ${heritage.superpowers.scent_radar}/10 | ⚡ Speed ${heritage.superpowers.stamina_speed}/10 | ❤️ Cuddle Index ${heritage.superpowers.cuddle_index}/10. Verified on Scooby's Kitchen!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopySummary = () => {
    const text = `🐾 ${displayName}'s Heritage Dossier\nBreed: ${breedName} (${species})\nOrigin: ${heritage.origin_flag} ${heritage.origin_country} (${heritage.origin_era})\n\nSuperpowers:\n- 👃 Scent Radar: ${heritage.superpowers.scent_radar}/10\n- ⚡ Speed: ${heritage.superpowers.stamina_speed}/10\n- ❤️ Cuddle Index: ${heritage.superpowers.cuddle_index}/10\n- 🛡️ Watchdog: ${heritage.superpowers.watchdog_instinct}/10\n- 🏊 Swimming: ${heritage.superpowers.swimming_affinity}/10\n\n💡 Fun Fact: ${heritage.fun_facts[0] || ''}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in-up">
      {/* Visual Heritage Passport Card */}
      <div className="relative rounded-[20px] bg-paperLight border-2 border-turmeric p-5 sm:p-7 md:p-8 shadow-xl overflow-hidden font-body text-ink">
        {/* Background Guilloche Texture Accent */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#181411_1.5px,transparent_1.5px)] bg-[size:12px_12px]" />

        {/* Top Passport Header Band */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b-2 border-dashed border-cardboard">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-ink text-turmeric flex items-center justify-center font-bold shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5 text-turmeric" />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric tracking-widest block">
                Official Canine & Feline Registry
              </span>
              <h3 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-ink">
                Companion Heritage Passport
              </h3>
            </div>
          </div>

          <div className="font-mono text-right shrink-0">
            <span className="text-[9px] uppercase text-ink/60 block">Passport Document No.</span>
            <span className="text-xs font-bold text-ink bg-paper px-2.5 py-1 rounded-sm border border-cardboard inline-block">
              {passportCode}
            </span>
          </div>
        </div>

        {/* Center Passport Dossier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 border-b-2 border-dashed border-cardboard">
          {/* Photo & Origin Seal */}
          <div className="md:col-span-4 flex flex-col items-center">
            <div className="relative w-full max-w-[220px] aspect-[4/5] rounded-[14px] bg-paper border-2 border-ink p-2 shadow-md overflow-hidden group">
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt={displayName} 
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-cardboard/10 rounded-[10px] text-ink/40 text-xs font-mono">
                  <Award className="w-12 h-12 mb-2 text-turmeric opacity-70" />
                  <span>No Photo Provided</span>
                </div>
              )}

              {/* Verified Stamp Overlay */}
              <div className="absolute -bottom-2 -right-2 transform -rotate-12 bg-turmeric text-ink border-2 border-ink font-mono text-[9px] font-black uppercase px-3 py-1 rounded-sm shadow-md">
                Certified {heritage.origin_flag}
              </div>
            </div>

            <span className="font-display font-bold text-base uppercase text-ink mt-3">
              {displayName}
            </span>
            <span className="font-mono text-[11px] text-turmeric font-bold uppercase tracking-wider">
              {breedName}
            </span>
          </div>

          {/* Heritage Timeline & Mutation Story */}
          <div className="md:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard">
                <span className="font-mono text-[9px] uppercase font-bold text-ink/60 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-turmeric" /> Geographic Homeland
                </span>
                <span className="font-display font-black text-sm uppercase text-ink mt-1 block">
                  {heritage.origin_flag} {heritage.origin_country}
                </span>
                <span className="font-mono text-[10px] text-ink/70 block truncate">
                  {heritage.historical_homeland}
                </span>
              </div>

              <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard">
                <span className="font-mono text-[9px] uppercase font-bold text-ink/60 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-herb" /> Era of Discovery
                </span>
                <span className="font-display font-black text-sm uppercase text-ink mt-1 block">
                  {heritage.origin_era}
                </span>
                <span className="font-mono text-[10px] text-ink/70 block">
                  Preserved Working Lineage
                </span>
              </div>
            </div>

            {/* Mutation Story Notebook Card */}
            <div className="bg-paper p-4 rounded-[14px] border border-cardboard space-y-2">
              <div className="flex items-center space-x-2">
                <Dna className="w-4 h-4 text-turmeric" />
                <span className="font-mono text-[10px] uppercase font-bold text-ink tracking-wider">
                  Evolutionary Trait & Mutation Story
                </span>
              </div>
              <p className="font-body text-xs sm:text-sm text-ink/85 leading-relaxed">
                {heritage.mutation_story}
              </p>
            </div>

            {/* Famous Companions */}
            {heritage.famous_icons && heritage.famous_icons.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="font-mono text-[9px] uppercase font-bold text-ink/60">
                  Notable Icons:
                </span>
                {heritage.famous_icons.map((icon, idx) => (
                  <span 
                    key={idx} 
                    className="font-mono text-[10px] bg-paper px-2 py-0.5 rounded-sm border border-cardboard text-ink/80"
                  >
                    ✨ {icon}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Biological Superpowers & Radar Gauges */}
        <div className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-turmeric" />
              <h4 className="font-display font-black text-base uppercase text-ink">
                Biological Superpowers & Skill Ratings
              </h4>
            </div>
            <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
              Max Scale 10.0
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Scent Radar */}
            <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-ink">
                  <Flame className="w-3.5 h-3.5 text-paprika" /> Scent & Sniff Radar
                </span>
                <span className="font-mono text-turmeric">{heritage.superpowers.scent_radar}/10</span>
              </div>
              <div className="w-full bg-cardboard/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-paprika h-full rounded-full transition-all duration-700" 
                  style={{ width: `${(heritage.superpowers.scent_radar / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Stamina & Speed */}
            <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-ink">
                  <Sparkles className="w-3.5 h-3.5 text-turmeric" /> Stamina & Athletic Speed
                </span>
                <span className="font-mono text-turmeric">{heritage.superpowers.stamina_speed}/10</span>
              </div>
              <div className="w-full bg-cardboard/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-turmeric h-full rounded-full transition-all duration-700" 
                  style={{ width: `${(heritage.superpowers.stamina_speed / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Lapdog Cuddle Index */}
            <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-ink">
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> Lapdog Cuddle Index
                </span>
                <span className="font-mono text-turmeric">{heritage.superpowers.cuddle_index}/10</span>
              </div>
              <div className="w-full bg-cardboard/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${(heritage.superpowers.cuddle_index / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Watchdog Alertness */}
            <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-ink">
                  <Eye className="w-3.5 h-3.5 text-herb" /> Watchdog Guarding
                </span>
                <span className="font-mono text-turmeric">{heritage.superpowers.watchdog_instinct}/10</span>
              </div>
              <div className="w-full bg-cardboard/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-herb h-full rounded-full transition-all duration-700" 
                  style={{ width: `${(heritage.superpowers.watchdog_instinct / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Swimming Affinity */}
            <div className="bg-paper p-3.5 rounded-[12px] border border-cardboard space-y-2 sm:col-span-2 lg:col-span-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-ink">
                  <Waves className="w-3.5 h-3.5 text-blue-500" /> Water & Swimming Affinity
                </span>
                <span className="font-mono text-turmeric">{heritage.superpowers.swimming_affinity}/10</span>
              </div>
              <div className="w-full bg-cardboard/30 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${(heritage.superpowers.swimming_affinity / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fun Facts Trivia Pill Carousel */}
        {heritage.fun_facts && heritage.fun_facts.length > 0 && (
          <div className="mt-6 p-4 rounded-[14px] bg-paper border border-cardboard space-y-2">
            <span className="font-mono text-[10px] uppercase font-bold text-turmeric flex items-center gap-1.5">
              💡 Did You Know? (Fascinating Breed Trivia)
            </span>
            <ul className="space-y-1.5 text-xs text-ink/80 list-disc list-inside">
              {heritage.fun_facts.map((fact, idx) => (
                <li key={idx} className="leading-relaxed">
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 1-Click Action Buttons: Download Graphic & Social Sharing */}
        <div className="mt-7 pt-5 border-t border-cardboard flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPassport}
              disabled={isExporting}
              className="bg-ink hover:bg-ink/90 text-turmeric border border-turmeric font-mono text-xs uppercase px-4 py-2.5 font-bold rounded-[8px] flex items-center space-x-2 transition-all shadow-md cursor-pointer hover-bounce disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-turmeric" />
              <span>{isExporting ? 'Generating HD Passport...' : '📸 Download Passport Graphic'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="bg-herb hover:bg-herb/90 text-paper font-mono text-xs uppercase px-4 py-2.5 font-bold rounded-[8px] flex items-center space-x-2 transition-all shadow-md cursor-pointer hover-bounce"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="font-mono text-xs text-ink hover:text-turmeric uppercase font-bold flex items-center space-x-1 cursor-pointer transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-herb" />
                <span className="text-herb">Copied to Clipboard!</span>
              </>
            ) : (
              <span>📋 Copy Summary</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
