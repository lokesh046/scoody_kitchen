import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchVaccineGuide, type GuideStatus } from '../../api/vaccinations';

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
// Same colours as the spreadsheets: green = done, orange = due soon, red = overdue.
const BADGE_CLASS: Record<GuideStatus, string> = {
  done: 'bg-[#2E9E55] text-white border-[#2E9E55]',
  overdue: 'bg-[#D93636] text-white border-[#D93636]',
  due_soon: 'bg-[#F59E0B] text-ink border-[#F59E0B]',
  upcoming: 'bg-paper text-ink border-cardboard',
  not_recorded: 'bg-paper text-ink border-cardboard opacity-80',
  optional: 'bg-paper text-ink border-cardboard border-dashed',
  info: '',
};
const ROW_CLASS: Record<GuideStatus, string> = {
  done: 'bg-[#C8E6C9]',
  overdue: 'bg-[#FFCDD2]',
  due_soon: 'bg-[#FFE0B2]',
  upcoming: '',
  not_recorded: '',
  optional: '',
  info: '',
};

function StatusBadge({ status }: { status: GuideStatus | null }) {
  if (!status || status === 'info') return <span className="opacity-40">—</span>;
  return (
    <span className={`inline-block px-1.5 py-0.5 border rounded-sm font-mono text-[9px] uppercase font-bold whitespace-nowrap ${BADGE_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const fmt = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-ink">
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-[#C8E6C9] border border-[#2E9E55]" />Done</span>
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-[#FFE0B2] border border-[#F59E0B]" />Due soon (within 30 days)</span>
      <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-sm bg-[#FFCDD2] border border-[#D93636]" />Overdue</span>
    </p>
  );
}

export function VaccineGuide({ petId, petName }: { petId: number; petName: string }) {
  const [tab, setTab] = useState<TabId>('schedule');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vaccine-guide', petId],
    queryFn: () => fetchVaccineGuide(petId),
  });

  if (isLoading) return <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-herb" /></div>;
  if (isError || !data || !data.supported) return null;

  return (
    <section className="border border-cardboard rounded-sm bg-paperLight p-3 sm:p-4 space-y-3" aria-label="Vaccine guide">
      <div>
        <h4 className="font-display font-bold text-base text-ink leading-tight">{data.title}</h4>
        <p className="font-body text-xs text-ink opacity-70 mt-0.5">{data.subtitle}</p>
      </div>

      <div role="tablist" aria-label="Vaccine guide sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`h-8 px-3 font-mono text-[10px] uppercase font-bold rounded-sm border cursor-pointer transition-colors ${
              tab === t.id ? 'bg-herb text-white border-herb' : 'bg-transparent text-ink border-cardboard hover:bg-paper'}`}>
            {t.id === 'rules' && data.rules_title ? data.rules_title : t.label}
          </button>
        ))}
      </div>

      {tab === 'planner' && (
        data.date_of_birth_known ? (
          <div className="space-y-2">
            <p className="font-body text-xs text-ink opacity-75">
              Due dates worked out from {petName}'s birth date. A dose turns <strong>Done</strong> when you record it above.
            </p>
            <Legend />
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left font-body text-xs text-ink min-w-[560px]">
                <thead>
                  <tr className="border-b border-cardboard font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-1.5 pr-2">Dose</th><th className="py-1.5 pr-2">Vaccine</th>
                    <th className="py-1.5 pr-2">Planned age</th><th className="py-1.5 pr-2">Due date</th><th className="py-1.5 pr-2">Date given</th><th className="py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.planner.map((p, i) => (
                    <tr key={i} className={`border-b border-cardboard/40 align-top ${ROW_CLASS[p.status]}`}>
                      <td className="py-1.5 px-1.5 whitespace-nowrap">{p.dose}</td>
                      <td className="py-1.5 pr-2">
                        {p.vaccine}
                        {p.note && <span className="block text-[11px] opacity-60">{p.note}</span>}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{p.planned_age}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmt(p.due_date)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmt(p.date_given)}</td>
                      <td className="py-1.5 pr-1.5"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.planner_note && <p className="font-body text-[11px] text-ink opacity-60 leading-relaxed">{data.planner_note}</p>}
          </div>
        ) : (
          <p className="font-body text-sm text-ink opacity-75">Add {petName}'s date of birth to see due dates.</p>
        )
      )}

      {tab === 'timeline' && (
        <ol className="space-y-2">
          {data.timeline.map((t) => (
            <li key={t.stage} className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full border border-herb text-herb font-mono text-[11px] font-bold flex items-center justify-center">{t.stage}</span>
              <div className="font-body text-sm text-ink"><strong>{t.age}</strong><span className="block opacity-80">{t.what}</span></div>
            </li>
          ))}
        </ol>
      )}

      {tab === 'schedule' && (
        <div className="space-y-2">
          {data.date_of_birth_known ? <Legend /> : (
            <p className="font-body text-xs text-ink opacity-75">Add {petName}'s date of birth to see status, last dose and next due for each line.</p>
          )}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-left font-body text-xs text-ink min-w-[820px]">
              <thead>
                <tr className="bg-ink text-paper font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-2">Sno</th><th className="py-2 pr-2">Age</th><th className="py-2 pr-2">Vaccine</th>
                  <th className="py-2 pr-2">Status</th><th className="py-2 pr-2">Last dose</th><th className="py-2 pr-2">Next due</th>
                  <th className="py-2 pr-2">Protects against</th><th className="py-2 pr-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((s) => (
                  <tr key={s.sno} className={`border-b border-cardboard/40 align-top ${s.status ? ROW_CLASS[s.status] : ''}`}>
                    <td className="py-2 px-2 font-bold">{s.sno}</td>
                    <td className="py-2 pr-2 font-bold">{s.age}</td>
                    <td className="py-2 pr-2">{s.vaccine}</td>
                    <td className="py-2 pr-2"><StatusBadge status={s.status} /></td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmt(s.last_dose)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmt(s.next_due)}</td>
                    <td className="py-2 pr-2">{s.protects}</td>
                    <td className="py-2 pr-2 opacity-80">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <dl className="space-y-2">
          {data.rules.map((r, i) => (
            <div key={i} className="font-body text-sm text-ink">
              <dt className="font-bold">{r.topic}</dt>
              <dd className="opacity-80">{r.guidance}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="border-t border-cardboard pt-3 space-y-1.5">
        <h5 className="font-mono text-[10px] uppercase tracking-wider font-bold text-ink">About this guide</h5>
        <ul className="space-y-1 font-body text-xs text-ink">
          {data.about.map((a) => (
            <li key={a.label}>
              <strong>{a.label}:</strong> {a.text}
              {a.label === 'Sources' && (
                <ul className="mt-0.5 ml-4 list-disc">
                  {data.sources.map((src) => (
                    <li key={src.url}><a href={src.url} target="_blank" rel="noopener noreferrer" className="underline text-herb break-words">{src.title}</a></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {data.disclaimer && <p className="font-body text-[11px] text-ink opacity-60 leading-relaxed pt-1">{data.disclaimer}</p>}
      </div>
    </section>
  );
}
