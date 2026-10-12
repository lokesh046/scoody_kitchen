import React, { useState, useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchDoctorSlots } from '../../api/consultations';
import { ArrowRight, Compass, Loader2, Star } from 'lucide-react';

export const getDoctorAvatarUrl = (doc: any): string | null => {
  if (!doc) return null;
  return doc.profile_image_url || doc.user?.profile_image_url || null;
};

export const DoctorAvatar: React.FC<{
  src?: string | null;
  name?: string;
  className?: string;
  shape?: 'circle' | 'square';
  initialsClassName?: string;
}> = ({
  src,
  name = 'Doctor',
  className = 'w-16 h-16',
  shape = 'circle',
  initialsClassName = 'font-display font-black text-2xl text-turmeric'
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanName = name.replace(/^Dr\.?\s*/i, '').trim();
  const initial = (cleanName[0] || name[0] || 'D').toUpperCase();
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-sm';

  if (!src || hasError) {
    return (
      <div className={`${className} ${radiusClass} bg-paper border border-cardboard border-opacity-60 flex items-center justify-center shrink-0 shadow-2xs select-none`}>
        <span className={initialsClassName}>
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className} ${radiusClass} bg-paper border border-cardboard border-opacity-60 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs`}>
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

export const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
};

export const getUpcomingAlternativeDates = (baseDateStr: string, count: number = 6) => {
  const dates: { dateStr: string; label: string; weekday: string; formatted: string }[] = [];

  let base: Date;
  if (baseDateStr) {
    const parts = baseDateStr.split('-');
    if (parts.length === 3) {
      base = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      base = new Date();
    }
  } else {
    base = new Date();
  }

  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = d.getDate();

    const label = i === 1 ? `Tomorrow (${weekday})` : `${weekday}`;
    dates.push({
      dateStr,
      label,
      weekday,
      formatted: `${monthName} ${dayNum}`,
    });
  }

  return dates;
};

const SuggestedDoctorCard: React.FC<{
  doctor: any;
  targetDate: string;
  slots: string[];
  isLoading: boolean;
  onSelectDoctor: (doctorId: number) => void;
  onSelectSlot: (doctorId: number, slot: string) => void;
}> = ({ doctor, targetDate: _targetDate, slots, isLoading, onSelectDoctor, onSelectSlot }) => {
  const docName = doctor.user?.first_name
    ? `Dr. ${doctor.user.first_name} ${doctor.user.last_name || ''}`.trim()
    : `Dr. ${doctor.name || 'Practitioner'}`;
  const avatarUrl = getDoctorAvatarUrl(doctor);
  const hasSlots = slots.length > 0;

  return (
    <div className={`bg-paper border rounded-sm p-3.5 space-y-3 transition-all shadow-2xs text-left ${
      hasSlots ? 'border-herb/60 ring-1 ring-herb/25' : 'border-cardboard border-opacity-60 hover:border-turmeric'
    }`}>
      {/* Top Profile Header (Clickable anywhere on profile to switch doctor) */}
      <button
        type="button"
        onClick={() => onSelectDoctor(doctor.id)}
        className="w-full flex items-start justify-between gap-2.5 cursor-pointer text-left group p-1 -m-1 rounded-sm hover:bg-paperLight/80 transition-colors focus:outline-none"
        title={`Click to select ${docName}`}
      >
        <div className="flex items-center space-x-3 min-w-0">
          <DoctorAvatar
            src={avatarUrl}
            name={docName}
            className="w-12 h-12 group-hover:border-turmeric transition-colors"
            shape="square"
            initialsClassName="text-base font-display font-black text-turmeric"
          />
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-display font-bold text-xs sm:text-sm text-ink group-hover:text-paprika transition-colors block truncate">
                {docName}
              </span>
              {hasSlots ? (
                <span className="font-mono text-[8px] uppercase font-bold text-herb bg-herb/15 px-1.5 py-0.5 rounded-xs border border-herb/30 shrink-0">
                  {slots.length} Slots Open
                </span>
              ) : (
                <span className="font-mono text-[8px] uppercase font-bold text-herb bg-herb/10 px-1.5 py-0.5 rounded-xs border border-herb/25 shrink-0 group-hover:bg-paprika group-hover:text-white group-hover:border-paprika transition-colors">
                  Select Vet
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1.5 text-ink/70 text-[10px] font-mono uppercase mt-0.5">
              <span>{doctor.specialization || 'Veterinarian'}</span>
              {doctor.experience_years ? <span>• {doctor.experience_years}y exp</span> : null}
            </div>
            {doctor.clinic?.city && (
              <div className="flex items-center space-x-1 text-herb text-[10px] font-mono uppercase mt-0.5">
                <Compass className="w-3 h-3 text-herb shrink-0" />
                <span className="truncate">{doctor.clinic.name ? `${doctor.clinic.name}, ` : ''}{doctor.clinic.city}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono text-xs font-bold text-paprika block">
            ₹{parseFloat(doctor.consultation_fee || '0').toFixed(2)}
          </span>
          {Number(doctor.average_rating) > 0 && (
            <span className="font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm inline-flex items-center space-x-0.5 mt-0.5">
              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              <span>{Number(doctor.average_rating).toFixed(1)}</span>
            </span>
          )}
        </div>
      </button>

      {/* Available Slots Row for this Suggested Doctor */}
      <div className="pt-2 border-t border-dashed border-cardboard border-opacity-40">
        {isLoading ? (
          <div className="flex items-center space-x-2 text-ink/50 text-[10px] font-mono py-1">
            <Loader2 className="w-3 h-3 animate-spin text-turmeric" />
            <span>Checking availability for {docName}...</span>
          </div>
        ) : hasSlots ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-herb font-bold uppercase flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>{slots.length} Slots Open on this date</span>
              </span>
              <button
                type="button"
                onClick={() => onSelectDoctor(doctor.id)}
                className="text-paprika font-bold hover:underline cursor-pointer uppercase flex items-center space-x-1"
              >
                <span>Select Doctor</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {slots.slice(0, 5).map((slot: string) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSelectSlot(doctor.id, slot)}
                  className="py-1 px-2.5 bg-paperLight hover:bg-herb hover:text-white border border-cardboard text-ink font-mono text-[11px] font-bold rounded-sm transition-colors cursor-pointer shadow-2xs active:scale-95"
                  title={`Book ${slot} with ${docName}`}
                >
                  {slot}
                </button>
              ))}
              {slots.length > 5 && (
                <button
                  type="button"
                  onClick={() => onSelectDoctor(doctor.id)}
                  className="py-1 px-2 bg-paperLight hover:bg-cardboard/30 border border-cardboard text-ink/70 font-mono text-[10px] font-bold rounded-sm transition-colors cursor-pointer"
                >
                  +{slots.length - 5} more
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-ink/50 uppercase">No slots on this date</span>
            <button
              type="button"
              onClick={() => onSelectDoctor(doctor.id)}
              className="font-bold text-paprika hover:underline cursor-pointer uppercase flex items-center space-x-1"
            >
              <span>Switch to this Doctor</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const SuggestedDoctorsList: React.FC<{
  doctors: any[];
  targetDate: string;
  onSelectDoctor: (doctorId: number) => void;
  onSelectSlot: (doctorId: number, slot: string) => void;
}> = ({ doctors, targetDate, onSelectDoctor, onSelectSlot }) => {
  const todayStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const queries = useQueries({
    queries: doctors.map((doc) => ({
      queryKey: ['suggestedDoctorSlots', doc.id, targetDate],
      queryFn: () => fetchDoctorSlots(doc.id, targetDate),
      staleTime: 30 * 1000,
    })),
  });

  // Sort: Doctors with open slots (> 0) ALWAYS appear first
  const sortedDoctors = useMemo(() => {
    const items = doctors.map((doc, idx) => {
      const q = queries[idx];
      const rawSlots = q?.data?.slots || [];
      const slots = targetDate === todayStr
        ? rawSlots.filter((slot: string) => {
            const now = new Date();
            const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            return slot > curTime;
          })
        : rawSlots;

      return {
        doctor: doc,
        slots,
        isLoading: q?.isLoading || false,
      };
    });

    return [...items].sort((a, b) => {
      const aHas = a.slots.length > 0 ? 1 : 0;
      const bHas = b.slots.length > 0 ? 1 : 0;
      if (bHas !== aHas) {
        return bHas - aHas; // Doctors with available slots FIRST
      }
      return b.slots.length - a.slots.length; // More slots first
    });
  }, [doctors, queries, targetDate, todayStr]);

  if (doctors.length === 0) {
    return (
      <div className="p-4 bg-paper/40 border border-dashed border-cardboard rounded-sm text-center text-xs font-mono text-ink/60">
        No other doctors currently listed in this specific area.
      </div>
    );
  }

  // Strictly show top 4 profiles so even with 100+ doctors the UI remains fast, compact, and uncluttered
  const displayedDoctors = sortedDoctors.slice(0, 4);

  return (
    <div className="space-y-2.5 pt-1">
      {displayedDoctors.map(({ doctor, slots, isLoading }) => (
        <SuggestedDoctorCard
          key={doctor.id}
          doctor={doctor}
          targetDate={targetDate}
          slots={slots}
          isLoading={isLoading}
          onSelectDoctor={onSelectDoctor}
          onSelectSlot={onSelectSlot}
        />
      ))}
      {doctors.length > 4 && (
        <div className="text-center pt-1 border-t border-dashed border-cardboard border-opacity-30">
          <span className="font-mono text-[9px] text-ink/60 uppercase">
            Showing top 4 specialists prioritized by availability
          </span>
        </div>
      )}
    </div>
  );
};
