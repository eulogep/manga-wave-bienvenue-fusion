
import { Sword, Heart, Sparkles, Zap, Users, Star } from 'lucide-react';

const CategoriesSection = () => {
  const categories = [
    {
      name: "Action",
      icon: Sword,
      count: "2,547",
      color: "from-red-500 to-orange-500",
      description: "Combats épiques et aventures"
    },
    {
      name: "Romance",
      icon: Heart,
      count: "1,834",
      color: "from-pink-500 to-rose-500",
      description: "Histoires d'amour touchantes"
    },
    {
      name: "Fantasy",
      icon: Sparkles,
      count: "1,923",
      color: "from-purple-500 to-indigo-500",
      description: "Mondes magiques et mystérieux"
    },
    {
      name: "Supernatural",
      icon: Zap,
      count: "987",
      color: "from-cyan-500 to-blue-500",
      description: "Pouvoirs surnaturels"
    },
    {
      name: "Slice of Life",
      icon: Users,
      count: "756",
      color: "from-green-500 to-emerald-500",
      description: "Quotidien et réalisme"
    },
    {
      name: "Populaires",
      icon: Star,
      count: "∞",
      color: "from-yellow-500 to-amber-500",
      description: "Les plus appréciés"
    }
  ];

  return (
    <section className="py-16 section-padding bg-gradient-to-br from-manga-dark to-black/50">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 font-japanese">
            Explorez par <span className="glow-text">Catégories</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Découvrez votre prochain manga favori selon vos préférences
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <div
                key={category.name}
                className="group cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="manga-card p-6 text-center hover:scale-105 transition-transform duration-300">
                  {/* Icon with gradient background */}
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center group-hover:animate-pulse`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 group-hover:text-manga-purple transition-colors">
                    {category.name}
                  </h3>
                  
                  <p className="text-muted-foreground mb-4 text-sm">
                    {category.description}
                  </p>
                  
                  <div className={`inline-block px-3 py-1 rounded-full bg-gradient-to-r ${category.color} text-white text-sm font-semibold`}>
                    {category.count} titres
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-6">
            Plus de 20 catégories disponibles pour tous les goûts
          </p>
          <button className="btn-gradient px-8 py-3 rounded-full font-semibold hover:scale-105 transition-transform duration-300">
            Explorer toutes les catégories
          </button>
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
