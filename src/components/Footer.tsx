import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const columns = [
  {
    title: 'Découvrir',
    links: [
      { label: 'Catalogue', to: '/search' },
      { label: 'Scans français', to: '/search?source=originmanga' },
      { label: 'Nouveautés', to: '/search?sort=latest' },
    ],
  },
  {
    title: 'Genres',
    links: [
      { label: 'Action', to: '/search?genre=Action' },
      { label: 'Romance', to: '/search?genre=Romance' },
      { label: 'Fantasy', to: '/search?genre=Fantasy' },
    ],
  },
  {
    title: 'Votre espace',
    links: [
      { label: 'Ma bibliothèque', to: '/library' },
      { label: 'Rechercher un titre', to: '/search' },
      { label: 'Connexion', to: '/auth' },
    ],
  },
];

const WaveMark = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
    <circle cx="22" cy="22" r="20" stroke="#ff4d5a" strokeWidth="2" />
    <path d="M9 28c6-13 12-13 18-5 3 4 6 4 9-2-2 11-12 16-20 11-3-2-5-3-7-4Z" fill="#ff4d5a" />
    <path d="M11 20c7-8 14-7 20 0" stroke="#ff818a" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Footer = () => (
  <footer className="border-t border-[var(--mw-border)] bg-[#040d14]">
    <div className="container mx-auto section-padding">
      <div className="grid gap-10 py-14 md:grid-cols-[1.35fr_2fr] lg:gap-20">
        <div>
          <Link to="/" className="inline-flex items-center gap-3" aria-label="Manga Wave, accueil">
            <WaveMark />
            <span className="font-outfit text-xl font-extrabold uppercase tracking-[0.1em] text-white">Manga <span className="text-[var(--mw-accent-coral)]">Wave</span></span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--mw-text-secondary)]">L’océan de récits. La vague de vos émotions. Une plateforme centrée sur les œuvres, la lecture et le retour à l’histoire.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--mw-accent-coral)]">{column.title}</p>
              <ul className="space-y-3">
                {column.links.map((link) => <li key={link.label}><Link to={link.to} className="group inline-flex items-center gap-1.5 text-sm text-[var(--mw-text-secondary)] transition-colors hover:text-white"><ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />{link.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--mw-border)] py-6 text-[10px] uppercase tracking-[0.16em] text-white/30 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Manga Wave</p>
        <p>Les contenus appartiennent à leurs ayants droit.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
