
import { BookOpen, Heart, Github, Twitter, Instagram, Mail } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-manga-darker border-t border-white/10">
      <div className="container mx-auto section-padding py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="h-8 w-8 text-manga-purple" />
              <h1 className="text-2xl font-bold font-japanese glow-text">
                Bienvenue
              </h1>
            </div>
            <p className="text-muted-foreground mb-4">
              La plateforme ultime pour la lecture de mangas et webtoons avec une expérience immersive inégalée.
            </p>
            <div className="flex space-x-4">
              <Github className="h-5 w-5 text-muted-foreground hover:text-manga-purple cursor-pointer transition-colors" />
              <Twitter className="h-5 w-5 text-muted-foreground hover:text-manga-cyan cursor-pointer transition-colors" />
              <Instagram className="h-5 w-5 text-muted-foreground hover:text-manga-pink cursor-pointer transition-colors" />
              <Mail className="h-5 w-5 text-muted-foreground hover:text-manga-gold cursor-pointer transition-colors" />
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Accueil</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Catalogue</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Nouveautés</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Populaires</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Mes favoris</a></li>
            </ul>
          </div>

          {/* Genres */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Genres</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Action</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Romance</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Fantasy</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Supernatural</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Slice of Life</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Support</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Centre d'aide</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Signaler un bug</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">Demande de manga</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-white transition-colors">API</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              © 2024 Bienvenue. Fait avec <Heart className="inline h-4 w-4 text-manga-pink mx-1" /> pour les fans de manga.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">
                Conditions d'utilisation
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">
                Confidentialité
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-white transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
