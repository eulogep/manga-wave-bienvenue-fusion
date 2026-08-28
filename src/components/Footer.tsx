import { Link } from 'react-router-dom';
import { BookOpen, Github, Twitter, Instagram, Mail, ArrowRight } from 'lucide-react';

const MangaWaveLogo = () => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="footer-logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7c5cfc" />
        <stop offset="0.5" stopColor="#f43f8e" />
        <stop offset="1" stopColor="#00d4ff" />
      </linearGradient>
    </defs>
    <path d="M4 22 Q 7 8, 14 14 Q 21 20, 24 6" stroke="url(#footer-logo-grad)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <rect x="8" y="8" width="12" height="16" rx="1.5" stroke="url(#footer-logo-grad)" strokeWidth="1.8" fill="none"/>
    <line x1="11" y1="13" x2="17" y2="13" stroke="url(#footer-logo-grad)" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="11" y1="16" x2="15" y2="16" stroke="url(#footer-logo-grad)" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const NAV_COLS = [
  {
    title: 'Navigation',
    links: [
      { label: 'Accueil', to: '/' },
      { label: 'Catalogue', to: '/search' },
      { label: 'Scans FR', to: '/search?source=originmanga' },
      { label: 'Nouveautés', to: '/search?sort=latest' },
      { label: 'Ma bibliothèque', to: '/library' },
    ],
  },
  {
    title: 'Genres',
    links: [
      { label: 'Action', to: '/search?genre=Action' },
      { label: 'Romance', to: '/search?genre=Romance' },
      { label: 'Fantasy', to: '/search?genre=Fantasy' },
      { label: 'Supernatural', to: '/search?genre=Supernatural' },
      { label: 'Slice of Life', to: '/search?genre=Slice+of+Life' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: "Centre d'aide", to: '/#' },
      { label: 'Contact', to: '/#' },
      { label: 'Signaler un bug', to: '/#' },
      { label: 'Demande de manga', to: '/#' },
      { label: 'API', to: '/#' },
    ],
  },
];

const SOCIALS = [
  { icon: Github, label: 'GitHub', href: '#', hoverColor: 'hover:text-white' },
  { icon: Twitter, label: 'Twitter / X', href: '#', hoverColor: 'hover:text-manga-cyan' },
  { icon: Instagram, label: 'Instagram', href: '#', hoverColor: 'hover:text-manga-pink' },
  { icon: Mail, label: 'Email', href: '#', hoverColor: 'hover:text-manga-gold' },
];

const Footer = () => (
  <footer className="border-t border-white/[0.05] bg-[#080c14]">
    {/* ── Divider glow ── */}
    <div className="h-px bg-gradient-to-r from-transparent via-manga-purple/30 to-transparent" />

    <div className="container mx-auto section-padding py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

        {/* ── Brand column ── */}
        <div>
          <div className="flex items-center gap-2.5 mb-5">
            <MangaWaveLogo />
            <span className="font-outfit font-bold text-lg text-white">
              Manga <span className="glow-text">Wave</span>
            </span>
          </div>
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            La plateforme ultime pour la lecture de mangas et webtoons — accès direct, lecteur intégré, catalogue multi-sources.
          </p>

          {/* Social Icons */}
          <div className="flex gap-3">
            {SOCIALS.map(({ icon: Icon, label, href, hoverColor }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className={`h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center text-white/40 ${hoverColor} hover:border-white/20 hover:bg-white/[0.04] transition-all duration-200`}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {/* ── Nav columns ── */}
        {NAV_COLS.map((col) => (
          <div key={col.title}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-4">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/50 hover:text-white transition-colors duration-150 flex items-center gap-1 group"
                  >
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div className="mt-14 pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/25">
          © 2024 Manga Wave. Fait avec ♥ pour les fans de manga.
        </p>
        <div className="flex items-center gap-6">
          {["Conditions d'utilisation", "Confidentialité", "Cookies"].map((item) => (
            <a key={item} href="#" className="text-xs text-white/25 hover:text-white/60 transition-colors">
              {item}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
