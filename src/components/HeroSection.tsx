import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Play, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const ROTATING_WORDS = ['Mangas', 'Webtoons', 'Scans FR', 'Manhwas'];

const ORB_CONFIG = [
  { size: 'w-[500px] h-[500px]', pos: 'top-[-10%] left-[-8%]', color: 'bg-manga-purple/10', blur: 'blur-[120px]', delay: '0s' },
  { size: 'w-[450px] h-[450px]', pos: 'bottom-[-5%] right-[-5%]', color: 'bg-manga-pink/10', blur: 'blur-[100px]', delay: '2s' },
  { size: 'w-[300px] h-[300px]', pos: 'top-[30%] right-[20%]', color: 'bg-manga-cyan/6', blur: 'blur-[80px]', delay: '1s' },
];

const STATS = [
  { icon: BookOpen, value: '10K+', label: 'Titres disponibles', color: 'text-manga-purple' },
  { icon: TrendingUp, value: '50K+', label: 'Chapitres en ligne', color: 'text-manga-cyan' },
  { icon: Zap, value: '24/7', label: 'Nouvelles sorties', color: 'text-manga-pink' },
  { icon: Star, value: '4.9★', label: 'Note utilisateurs', color: 'text-manga-gold' },
];

const HeroSection = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
        setIsFading(false);
      }, 350);
    }, 2800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden" aria-label="Bienvenue sur Manga Wave">
      {/* ── Ambient Orbs ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {ORB_CONFIG.map((orb, i) => (
          <div
            key={i}
            className={`absolute ${orb.size} ${orb.pos} ${orb.color} ${orb.blur} rounded-full animate-float`}
            style={{ animationDelay: orb.delay }}
          />
        ))}
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Main Content ── */}
      <div className="relative z-10 text-center section-padding max-w-5xl mx-auto w-full">

        {/* Badge pill */}
        <div className="flex items-center justify-center mb-8 animate-slide-up-fade">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-manga-purple/30 bg-manga-purple/10 text-sm font-medium text-white/80 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-manga-purple" />
            Nouvelle expérience de lecture manga
            <span className="w-1.5 h-1.5 rounded-full bg-manga-success animate-badge-pulse" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-outfit font-black text-6xl md:text-8xl lg:text-9xl tracking-tight mb-6 animate-slide-up-fade delay-100">
          <span className="block text-white mb-2">Manga</span>
          <span className="glow-text">Wave</span>
        </h1>

        {/* Rotating subtitle */}
        <div className="flex items-center justify-center gap-3 mb-8 animate-slide-up-fade delay-200">
          <p className="text-xl md:text-2xl text-white/60 font-light">
            La plateforme ultime pour
          </p>
          <div className="relative min-w-[140px] text-left">
            <span
              className={`text-xl md:text-2xl font-bold text-manga-purple transition-all duration-350 ${isFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
              style={{ display: 'inline-block', transition: 'opacity 0.35s ease, transform 0.35s ease' }}
            >
              {ROTATING_WORDS[wordIndex]}
            </span>
          </div>
        </div>

        <p className="text-base md:text-lg text-white/45 mb-12 max-w-2xl mx-auto leading-relaxed animate-slide-up-fade delay-300">
          Découvrez des milliers de titres avec une expérience de lecture cinématique, un catalogue multi-sources et un lecteur in-app immersif.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20 animate-slide-up-fade delay-400">
          <Button
            size="lg"
            className="btn-gradient px-8 h-12 text-base rounded-full font-semibold shadow-glow-purple"
            asChild
          >
            <Link to="/search">
              <Play className="mr-2 h-4.5 w-4.5" />
              Commencer la lecture
            </Link>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="btn-outline-glow px-8 h-12 text-base rounded-full"
            asChild
          >
            <Link to="/search?source=originmanga">
              Explorer les scans FR
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-slide-up-fade delay-500">
          {STATS.map(({ icon: Icon, value, label, color }, i) => (
            <div
              key={label}
              className="glass-card p-4 text-center group hover:scale-105 transition-transform duration-300"
              style={{ animationDelay: `${0.5 + i * 0.08}s` }}
            >
              <Icon className={`h-5 w-5 mx-auto mb-2 ${color} opacity-80`} />
              <div className={`text-2xl font-outfit font-bold ${color} mb-1`}>{value}</div>
              <p className="text-xs text-white/50 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gradient ground fade ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #080c14)' }}
        aria-hidden="true"
      />
    </section>
  );
};

export default HeroSection;
