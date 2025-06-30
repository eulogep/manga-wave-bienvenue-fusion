
import { Play, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-manga-purple/20 via-manga-dark to-manga-pink/20" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-32 h-32 bg-manga-purple/10 rounded-full blur-xl animate-float" />
        <div className="absolute bottom-32 right-32 w-48 h-48 bg-manga-pink/10 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-manga-cyan/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 text-center section-padding max-w-6xl mx-auto">
        <div className="animate-fade-in">
          <h1 className="text-6xl md:text-8xl font-bold mb-6 font-japanese">
            <span className="glow-text">
              Bienvenue
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/80 mb-4 max-w-3xl mx-auto leading-relaxed">
            La plateforme ultime pour la lecture de mangas et webtoons
          </p>
          <p className="text-lg text-white/60 mb-12 max-w-2xl mx-auto">
            Découvrez des milliers de titres avec une expérience de lecture révolutionnaire et immersive
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button size="lg" className="btn-gradient px-8 py-3 text-lg rounded-full">
              <Play className="mr-2 h-5 w-5" />
              Commencer la lecture
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-3 text-lg rounded-full">
              Explorer le catalogue
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-6 w-6 text-manga-gold mr-2" />
                <span className="text-3xl font-bold glow-text">10K+</span>
              </div>
              <p className="text-white/60">Mangas disponibles</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-manga-cyan mr-2" />
                <span className="text-3xl font-bold glow-text">1M+</span>
              </div>
              <p className="text-white/60">Lecteurs actifs</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Play className="h-6 w-6 text-manga-pink mr-2" />
                <span className="text-3xl font-bold glow-text">24/7</span>
              </div>
              <p className="text-white/60">Nouvelles sorties</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
