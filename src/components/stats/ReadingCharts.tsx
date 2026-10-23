import { useState } from 'react';
import { Target } from 'lucide-react';
import { genreLabel } from '@/domain/genres';
import {
  activityLevel,
  weeklyGoalProgress,
  WEEKLY_GOAL_OPTIONS,
  type CalendarDay,
  type GenreShare,
  type MonthlyPoint,
} from '@/domain/readingStats';

// Sequential blue ramp stepped for the dark surface (#0f1520); validated with the
// dataviz palette checker (ordinal, monotone lightness, light end clears 2:1).
const ACTIVITY_STEPS = ['#1a2433', '#184f95', '#2a78d6', '#5598e7', '#9ec5f4'] as const;
const SERIES_BLUE = '#3987e5';

const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

const DataTable = ({ caption, headers, rows }: { caption: string; headers: [string, string]; rows: [string, string | number][] }) => (
  <details className="mt-3 text-xs text-white/55">
    <summary className="cursor-pointer select-none hover:text-white">Voir les données</summary>
    <table className="mt-2 w-full max-w-sm text-left tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead><tr className="text-white/40"><th className="py-1 font-medium">{headers[0]}</th><th className="py-1 text-right font-medium">{headers[1]}</th></tr></thead>
      <tbody>{rows.map(([label, value]) => <tr key={label} className="border-t border-white/5"><td className="py-1">{label}</td><td className="py-1 text-right text-white/80">{value}</td></tr>)}</tbody>
    </table>
  </details>
);

export const StatTile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-[#0f1520] p-5">
    <p className="text-xs text-white/55">{label}</p>
    <p className="mt-2 font-outfit text-3xl font-semibold text-white">{value}</p>
    {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
  </div>
);

export const WeeklyGoalMeter = ({ chaptersThisWeek, goal, onGoalChange }: {
  chaptersThisWeek: number;
  goal: number | null;
  onGoalChange: (goal: number | null) => void;
}) => {
  const progress = weeklyGoalProgress(chaptersThisWeek, goal);
  return (
    <section aria-labelledby="weekly-goal-title" className="rounded-2xl border border-white/[0.08] bg-[#0f1520] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="weekly-goal-title" className="flex items-center gap-2 font-outfit text-lg font-bold text-white">
            <Target className="h-4 w-4 text-manga-cyan" aria-hidden="true" /> Objectif de la semaine
          </h2>
          <p className="mt-1 text-xs text-white/45">Chapitres terminés depuis lundi. Mémorisé sur cet appareil.</p>
        </div>
        <label className="text-xs text-white/55">
          <span className="sr-only">Objectif hebdomadaire</span>
          <select
            value={goal ?? ''}
            onChange={(event) => onGoalChange(event.target.value ? Number(event.target.value) : null)}
            className="min-h-11 rounded-md border border-white/15 bg-[#080c14] px-3 text-sm text-white"
          >
            <option value="">Pas d’objectif</option>
            {WEEKLY_GOAL_OPTIONS.map((option) => <option key={option} value={option}>{option} chapitres / semaine</option>)}
          </select>
        </label>
      </div>
      {goal ? (
        <>
          <p className="mt-4 text-sm text-white/75">
            <span className="font-outfit text-2xl font-semibold text-white">{chaptersThisWeek}</span> / {goal} chapitres
            {progress.reached ? ' — objectif atteint 🎉' : ` — encore ${plural(progress.remaining, 'chapitre')}`}
          </p>
          <div
            role="meter"
            aria-label="Progression de l’objectif hebdomadaire"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(chaptersThisWeek, goal)}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#1a2433]"
          >
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress.percent}%`, backgroundColor: SERIES_BLUE }} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-white/55">Cette semaine : {plural(chaptersThisWeek, 'chapitre terminé')}. Choisis un objectif pour suivre ta régularité.</p>
      )}
    </section>
  );
};

export const ActivityCalendar = ({ calendar }: { calendar: CalendarDay[][] }) => {
  const days = calendar.flat().filter((day) => !day.future);
  const max = Math.max(0, ...days.map((day) => day.count));
  const [hovered, setHovered] = useState<CalendarDay | null>(null);
  const activeCount = days.filter((day) => day.count > 0).length;

  return (
    <section aria-labelledby="calendar-title" className="rounded-2xl border border-white/[0.08] bg-[#0f1520] p-5">
      <h2 id="calendar-title" className="font-outfit text-lg font-bold text-white">Activité des 12 dernières semaines</h2>
      <p className="mt-1 min-h-5 text-xs text-white/55" aria-live="polite">
        {hovered ? `${formatDay(hovered.day)} : ${plural(hovered.count, 'chapitre')} lu${hovered.count > 1 ? 's' : ''}` : `${plural(activeCount, 'jour')} de lecture sur la période`}
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-[2px] pr-1 text-[10px] text-white/35" aria-hidden="true">
          {['L', '', 'M', '', 'V', '', 'D'].map((label, index) => <span key={index} className="h-4 leading-4 sm:h-6 sm:leading-6">{label}</span>)}
        </div>
        <div role="img" aria-label={`Calendrier d’activité : ${plural(activeCount, 'jour')} de lecture sur 12 semaines. Les valeurs détaillées sont dans le tableau.`} className="flex gap-[2px]">
          {calendar.map((week) => (
            <div key={week[0].day} className="grid grid-rows-7 gap-[2px]">
              {week.map((day) => (
                <span
                  key={day.day}
                  onPointerEnter={() => !day.future && setHovered(day)}
                  onPointerLeave={() => setHovered(null)}
                  className={`h-4 w-4 rounded-[3px] sm:h-6 sm:w-6 sm:rounded-[4px] ${day.future ? 'opacity-0' : 'hover:outline hover:outline-1 hover:outline-white/70'}`}
                  style={{ backgroundColor: ACTIVITY_STEPS[activityLevel(day.count, max)] }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white/40" aria-hidden="true">
        Moins {ACTIVITY_STEPS.map((color) => <span key={color} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />)} Plus
      </div>
      <DataTable
        caption="Chapitres lus par jour"
        headers={['Jour', 'Chapitres']}
        rows={days.filter((day) => day.count > 0).reverse().map((day) => [formatDay(day.day), day.count])}
      />
    </section>
  );
};

export const MonthlyChart = ({ monthly }: { monthly: MonthlyPoint[] }) => {
  const max = Math.max(1, ...monthly.map((point) => point.chapters));
  const peak = monthly.reduce((best, point) => (point.chapters > best.chapters ? point : best), monthly[0]);
  const [focused, setFocused] = useState<MonthlyPoint | null>(null);
  const current = monthly[monthly.length - 1];

  return (
    <section aria-labelledby="monthly-title" className="rounded-2xl border border-white/[0.08] bg-[#0f1520] p-5">
      <h2 id="monthly-title" className="font-outfit text-lg font-bold text-white">Chapitres terminés par mois</h2>
      <p className="mt-1 min-h-5 text-xs text-white/55" aria-live="polite">
        {focused ? `${focused.label} : ${plural(focused.chapters, 'chapitre')}` : 'Survole ou sélectionne un mois pour le détail'}
      </p>
      <div className="mt-4 flex h-40 items-end justify-around gap-2 border-b border-white/15">
        {monthly.map((point) => {
          const labelled = point === current || (point === peak && point.chapters > 0);
          return (
            <button
              key={point.month}
              type="button"
              onPointerEnter={() => setFocused(point)}
              onPointerLeave={() => setFocused(null)}
              onFocus={() => setFocused(point)}
              onBlur={() => setFocused(null)}
              aria-label={`${point.label} : ${plural(point.chapters, 'chapitre')}`}
              className="group flex h-full min-w-11 flex-1 flex-col items-center justify-end rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
            >
              {labelled && <span className="mb-1 text-[11px] font-semibold text-white/80">{point.chapters}</span>}
              <span
                className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${(point.chapters / max) * 100}%`, minHeight: point.chapters > 0 ? 4 : 0, backgroundColor: SERIES_BLUE }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-around gap-2 text-[11px] capitalize text-white/45" aria-hidden="true">
        {monthly.map((point) => <span key={point.month} className="min-w-11 flex-1 text-center">{point.label}</span>)}
      </div>
      <DataTable caption="Chapitres terminés par mois" headers={['Mois', 'Chapitres']} rows={monthly.map((point) => [point.label, point.chapters])} />
    </section>
  );
};

export const GenreBars = ({ genres }: { genres: GenreShare[] }) => {
  const max = Math.max(1, ...genres.map((entry) => entry.series));
  return (
    <section aria-labelledby="genres-stats-title" className="rounded-2xl border border-white/[0.08] bg-[#0f1520] p-5">
      <h2 id="genres-stats-title" className="font-outfit text-lg font-bold text-white">Genres dominants</h2>
      <p className="mt-1 text-xs text-white/45">Nombre de séries lues par genre.</p>
      {genres.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">Pas encore assez de lectures avec des genres connus.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {genres.map((entry) => (
            <li key={entry.genre} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="truncate text-white/75">{genreLabel(entry.genre)}</span>
              <span className="h-3 rounded-r-[4px]" style={{ width: `${(entry.series / max) * 100}%`, backgroundColor: SERIES_BLUE }} aria-hidden="true" />
              <span className="text-right text-xs text-white/60 tabular-nums">{entry.series}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
