import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchVaccineGuide, type GuideStatus, type VaccineStatusItem } from '../../api/vaccinations';

const TABS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'planner', label: 'Due dates' },
  { id: 'rules', label: 'Rules & deworming' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const STATUS_LABEL: Record<GuideStatus, string> = {
  done: 'Done',
  overdue: 'Overdue',
  due_soon: 'Due soon',
  upcoming: 'Upcoming',
  not_recorded: 'Not recorded',
  optional: 'Optional',
  info: '',
};
// Green = done, amber = due soon, red = overdue.
const BADGE_CLASS: Record<GuideStatus, string> = {
  done: 'bg-emerald-700 text-white border-emerald-700',
  overdue: 'bg-red-700 text-white border-red-700',
  due_soon: 'bg-amber-300 text-amber-950 border-amber-400',
  upcoming: 'bg-paper text-ink border-cardboard',
  not_recorded: 'bg-paper text-ink border-cardboard opacity-80',
  optional: 'bg-paper text-ink border-cardboard border-dashed',
  info: '',
};
const ROW_CLASS: Record<GuideStatus, string> = {
  done: 'bg-emerald-50',
  overdue: 'bg-red-50',
  due_soon: 'bg-amber-50',
  upcoming: '',
  not_recorded: '',
  optional: '',
  info: '',
};

function StatusBadge({ status }: { status: GuideStatus | null }) {
  if (!status || status === 'info') return <span className="opacity-40">—</span>;
  return (
    <span className={`inline-block px-2.5 py-1 border rounded-full font-body text-xs font-semibold whitespace-nowrap ${BADGE_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const fmt = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-ink">
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-emerald-700" />Done</span>
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-amber-300 border border-amber-400" />Due soon (within 30 days)</span>
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-red-700" />Overdue</span>
    </p>
  );
}

export function VaccineGuide({ petId, petName, vaccines, onUpdate }: {
  petId: number; petName: string; vaccines: VaccineStatusItem[]; onUpdate: (code: string) => void;
}) {
  const [tab, setTab] = useState<TabId>('schedule');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vaccine-guide', petId],
    queryFn: () => fetchVaccineGuide(petId),
  });

  if (isLoading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-paprika" /></div>;
  if (isError || !data || !data.supported) return null;

  const updateLinks = (codes: string[] = []) => {
    const matches = vaccines.filter((vaccine) => codes.includes(vaccine.code));
    return matches.length > 0 && (
      <div className="mt-1 flex flex-col items-start">
        {matches.map((vaccine) => (
          <button key={vaccine.code} type="button" onClick={() => onUpdate(vaccine.code)}
            aria-label={`Update ${vaccine.name} vaccination`}
            className="inline-flex min-h-11 items-center text-left text-sm font-semibold text-paprika underline underline-offset-4 cursor-pointer hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
            {matches.length === 1 ? 'Update vaccination' : `Update ${vaccine.name}`}
          </button>
        ))}
      </div>
    );
  };

  return (
    <section className="min-w-0 overflow-hidden border border-cardboard/70 rounded-2xl bg-white p-4 sm:p-5 space-y-5" aria-label="Vaccine guide">
      <div>
        <h4 className="font-display font-bold text-lg text-ink leading-snug">{data.title}</h4>
        <p className="font-body text-sm leading-relaxed text-ink/75 mt-2">{data.subtitle}</p>
      </div>

      <div role="tablist" aria-label="Vaccine guide sections" className="flex flex-wrap gap-2 rounded-[12px] bg-paper p-1.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`min-h-11 px-3 font-body text-sm font-semibold rounded-[10px] border cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika ${
              tab === t.id ? 'bg-paprika text-white border-herb' : 'bg-transparent text-ink/80 border-transparent hover:bg-white hover:border-cardboard'}`}>
            {t.id === 'rules' && data.rules_title ? data.rules_title : t.label}
          </button>
        ))}
      </div>

      {tab === 'planner' && (
        data.date_of_birth_known ? (
          <div className="space-y-4">
            <p className="font-body text-xs text-ink opacity-75">
              Due dates worked out from {petName}'s birth date. A dose turns <strong>Done</strong> when you record it above.
            </p>
            <Legend />
            <div className="overflow-x-auto rounded-[12px] border border-cardboard/60">
              <table className="w-full text-left font-body text-sm leading-relaxed text-ink min-w-[560px]">
                <thead>
                  <tr className="border-b border-cardboard font-body text-xs font-semibold">
                    <th className="py-3 pr-2">Dose</th><th className="py-3 pr-2">Vaccine</th>
                    <th className="py-3 pr-2">Planned age</th><th className="py-3 pr-2">Due date</th><th className="py-3 pr-2">Date given</th><th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planner.map((p, i) => (
                    <tr key={i} className={`border-b border-cardboard/40 align-top ${ROW_CLASS[p.status]}`}>
                      <td className="py-3 px-1.5 whitespace-nowrap">{p.dose}</td>
                      <td className="py-3 pr-2">
                        {p.vaccine}
                        {updateLinks(p.vaccine_codes)}
                        {p.note && <span className="block text-[11px] opacity-60">{p.note}</span>}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">{p.planned_age}</td>
                      <td className="py-3 pr-2 whitespace-nowrap">{fmt(p.due_date)}</td>
                      <td className="py-3 pr-2 whitespace-nowrap">{fmt(p.date_given)}</td>
                      <td className="py-3 pr-1.5"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.planner_note && <p className="font-body text-xs text-ink/75 leading-relaxed">{data.planner_note}</p>}
          </div>
        ) : (
          <p className="font-body text-sm text-ink opacity-75">Add {petName}'s date of birth to see due dates.</p>
        )
      )}

      {tab === 'timeline' && (
        <ol className="space-y-4">
          {data.timeline.map((t) => (
            <li key={t.stage} className="flex gap-4 items-start rounded-[12px] bg-paper p-4">
              <span className="shrink-0 w-9 h-9 rounded-full border border-herb/25 bg-herb/5 text-paprika font-body text-sm font-bold flex items-center justify-center">{t.stage}</span>
              <div className="font-body text-sm text-ink"><strong>{t.age}</strong><span className="block opacity-80">{t.what}</span></div>
            </li>
          ))}
        </ol>
      )}

      {tab === 'schedule' && (
        <div className="space-y-4">
          {data.date_of_birth_known ? <Legend /> : (
            <p className="font-body text-xs text-ink opacity-75">Add {petName}'s date of birth to see status, last dose and next due for each line.</p>
          )}
          <div className="overflow-x-auto rounded-[12px] border border-cardboard/60">
            <table className="w-full text-left font-body text-sm leading-relaxed text-ink min-w-[820px]">
              <thead>
                <tr className="bg-ink text-paper font-body text-xs font-semibold">
                  <th className="py-3 px-2">Sno</th><th className="py-3 pr-2">Age</th><th className="py-3 pr-2">Vaccine</th>
                  <th className="py-3 pr-2">Status</th><th className="py-3 pr-2">Last dose</th><th className="py-3 pr-2">Next due</th>
                  <th className="py-3 pr-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((s) => (
                  <tr key={s.sno} className={`border-b border-cardboard/40 align-top ${s.status ? ROW_CLASS[s.status] : ''}`}>
                    <td className="py-3 px-2 font-bold">{s.sno}</td>
                    <td className="py-3 pr-2 font-bold">{s.age}</td>
                    <td className="py-3 pr-2">{s.vaccine}{updateLinks(s.vaccine_codes)}</td>
                    <td className="py-3 pr-2"><StatusBadge status={s.status} /></td>
                    <td className="py-3 pr-2 whitespace-nowrap">{fmt(s.last_dose)}</td>
                    <td className="py-3 pr-2 whitespace-nowrap">{fmt(s.next_due)}</td>
                    <td className="py-3 pr-2 opacity-80">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <dl className="space-y-4">
          {data.rules.map((r, i) => (
            <div key={i} className="font-body text-sm text-ink">
              <dt className="font-bold">{r.topic}</dt>
              <dd className="opacity-80">{r.guidance}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="border-t border-cardboard/60 pt-5 space-y-3">
        <h5 className="font-body text-sm font-bold text-ink">About this guide</h5>
        <ul className="space-y-2 font-body text-sm leading-relaxed text-ink">
          {data.about.map((a) => (
            <li key={a.label}>
              <strong>{a.label}:</strong> {a.text}
              {a.label === 'Sources' && (
                <ul className="mt-0.5 ml-4 list-disc">
                  {data.sources.map((src) => (
                    <li key={src.url}><a href={src.url} target="_blank" rel="noopener noreferrer" className="underline text-paprika break-words">{src.title}</a></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {data.disclaimer && <p className="font-body text-xs text-ink/75 leading-relaxed pt-1">{data.disclaimer}</p>}
      </div>
    </section>
  );
}
