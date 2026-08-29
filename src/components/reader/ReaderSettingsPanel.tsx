import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReaderPreferences } from '@/hooks/useReaderPreferences';

type Props = {
  preferences: ReaderPreferences;
  onChange: (changes: Partial<ReaderPreferences>) => void;
  onReset: () => void;
  onClose: () => void;
};

const MODES: Array<{ value: ReaderPreferences['mode']; label: string; description: string }> = [
  { value: 'vertical', label: 'Vertical', description: 'Défilement avec espaces' },
  { value: 'webtoon', label: 'Webtoon', description: 'Ruban continu' },
  { value: 'single_page', label: 'Page simple', description: 'Une page centrée' },
  { value: 'double_page', label: 'Double page', description: 'Deux pages côte à côte' },
  { value: 'manga_rtl', label: 'Manga RTL', description: 'Lecture droite vers gauche' },
  { value: 'comic_ltr', label: 'Comic LTR', description: 'Lecture gauche vers droite' },
];

const BACKGROUNDS: Array<{ value: ReaderPreferences['background']; label: string; color: string }> = [
  { value: 'ink', label: 'Encre', color: '#061622' },
  { value: 'night', label: 'Nuit', color: '#141c28' },
  { value: 'paper', label: 'Papier', color: '#d9d4c8' },
];

const ReaderSettingsPanel = ({ preferences, onChange, onReset, onClose }: Props) => (
  <aside
    className="fixed inset-y-0 right-0 z-50 w-full max-w-[100vw] overflow-y-auto overscroll-contain border-l border-[var(--mw-border)] bg-[var(--mw-surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[var(--mw-text-primary)] shadow-2xl sm:max-w-sm"
    aria-label="Réglages du lecteur"
  >
    <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-6 flex items-center justify-between gap-4 border-b border-[var(--mw-border)] bg-[var(--mw-surface)] px-5 pb-4 pt-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--mw-brand-secondary)]">Lecteur</p>
        <h2 className="font-editorial text-xl font-semibold">Préférences</h2>
      </div>
      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClose} aria-label="Fermer les réglages">
        <X className="h-5 w-5" />
      </Button>
    </div>

    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-semibold">Mode de lecture</legend>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={preferences.mode === mode.value}
            onClick={() => onChange({
              mode: mode.value,
              readingDirection: mode.value === 'comic_ltr' ? 'ltr' : mode.value === 'manga_rtl' ? 'rtl' : preferences.readingDirection,
            })}
            className={`min-h-16 rounded-lg border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mw-brand-secondary)] ${
              preferences.mode === mode.value
                ? 'border-[var(--mw-brand-primary)] bg-[#ff4d5a]/10'
                : 'border-[var(--mw-border)] bg-black/10 hover:border-white/30'
            }`}
          >
            <span className="block text-sm font-semibold">{mode.label}</span>
            <span className="mt-1 block text-[11px] text-[var(--mw-text-secondary)]">{mode.description}</span>
          </button>
        ))}
      </div>
    </fieldset>

    <div className="mt-7 space-y-5 border-t border-[var(--mw-border)] pt-6">
      <label className="block text-sm font-medium">
        Ajustement
        <select
          value={preferences.fitMode}
          onChange={(event) => onChange({ fitMode: event.target.value as ReaderPreferences['fitMode'] })}
          className="mt-2 h-11 w-full rounded-lg border border-[var(--mw-border)] bg-[var(--mw-surface-elevated)] px-3 text-sm"
        >
          <option value="width">Largeur</option>
          <option value="height">Hauteur</option>
          <option value="original">Taille originale</option>
        </select>
      </label>

      <label className="block text-sm font-medium">
        Zoom <span className="float-right text-[var(--mw-text-secondary)]">{Math.round(preferences.zoom * 100)}%</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={preferences.zoom}
          onChange={(event) => onChange({ zoom: Number(event.target.value) })}
          className="mt-1 h-11 w-full accent-[#1ea7ff]"
        />
      </label>

      <label className="block text-sm font-medium">
        Espace entre pages <span className="float-right text-[var(--mw-text-secondary)]">{preferences.pageGap}px</span>
        <input
          type="range"
          min="0"
          max="48"
          step="4"
          value={preferences.pageGap}
          onChange={(event) => onChange({ pageGap: Number(event.target.value) })}
          className="mt-1 h-11 w-full accent-[#1ea7ff]"
        />
      </label>

      <label className="block text-sm font-medium">
        Luminosité <span className="float-right text-[var(--mw-text-secondary)]">{Math.round(preferences.brightness * 100)}%</span>
        <input
          type="range"
          min="0.5"
          max="1.25"
          step="0.05"
          value={preferences.brightness}
          onChange={(event) => onChange({ brightness: Number(event.target.value) })}
          className="mt-1 h-11 w-full accent-[#1ea7ff]"
        />
      </label>

      <label className="block text-sm font-medium">
        Pages préchargées <span className="float-right text-[var(--mw-text-secondary)]">{preferences.preloadCount}</span>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={preferences.preloadCount}
          onChange={(event) => onChange({ preloadCount: Number(event.target.value) })}
          className="mt-1 h-11 w-full accent-[#1ea7ff]"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">Fond</p>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((background) => (
            <button
              key={background.value}
              type="button"
              aria-pressed={preferences.background === background.value}
              onClick={() => onChange({ background: background.value })}
              className={`h-11 rounded-lg border text-xs font-semibold ${
                preferences.background === background.value ? 'border-[var(--mw-brand-primary)]' : 'border-[var(--mw-border)]'
              }`}
              style={{ backgroundColor: background.color, color: background.value === 'paper' ? '#182431' : '#edeff2' }}
            >
              {background.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm font-medium">
        Sens de lecture
        <select
          value={preferences.readingDirection}
          onChange={(event) => onChange({ readingDirection: event.target.value as ReaderPreferences['readingDirection'] })}
          className="mt-2 h-11 w-full rounded-lg border border-[var(--mw-border)] bg-[var(--mw-surface-elevated)] px-3 text-sm"
        >
          <option value="rtl">Droite vers gauche</option>
          <option value="ltr">Gauche vers droite</option>
        </select>
      </label>
    </div>

    <Button variant="outline" className="mt-7 h-11 w-full border-[var(--mw-border)]" onClick={onReset}>
      <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
    </Button>
  </aside>
);

export default ReaderSettingsPanel;
