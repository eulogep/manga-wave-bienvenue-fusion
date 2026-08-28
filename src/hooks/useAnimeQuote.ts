import { useQuery } from '@tanstack/react-query';

export type AnimeQuote = {
  quote: string;
  character: string;
  anime: string;
};

const FALLBACK_QUOTES: AnimeQuote[] = [
  {
    quote: "Si tu ne risques rien, tu ne peux rien créer.",
    character: "Eren Yeager",
    anime: "L'Attaque des Titans",
  },
  {
    quote: "Ce n'est pas parce qu'un chemin est difficile qu'il faut l'abandonner.",
    character: "Monkey D. Luffy",
    anime: "One Piece",
  },
  {
    quote: "Ceux qui abandonnent leurs amis sont pires que des racailles.",
    character: "Kakashi Hatake",
    anime: "Naruto",
  },
  {
    quote: "Je vais devenir le roi des sorciers, c'est ma promesse !",
    character: "Asta",
    anime: "Black Clover",
  },
  {
    quote: "Le pouvoir vient en réponse à un besoin, pas à un désir.",
    character: "Son Goku",
    anime: "Dragon Ball Z",
  },
  {
    quote: "La peur n'est pas un mal, elle permet de connaître ses faiblesses.",
    character: "Gildarts Clive",
    anime: "Fairy Tail",
  },
  {
    quote: "La seule chose que nous sommes autorisés à faire, c'est de croire que nous ne regretterons pas le choix que nous avons fait.",
    character: "Levi Ackerman",
    anime: "L'Attaque des Titans",
  },
];

export function useAnimeQuote() {
  return useQuery({
    queryKey: ['anime-quote-random'],
    queryFn: async (): Promise<AnimeQuote> => {
      try {
        const res = await fetch('https://animechan.xyz/api/random', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.quote && data?.character && data?.anime) {
            return {
              quote: data.quote,
              character: data.character,
              anime: data.anime,
            };
          }
        }
      } catch {
        // Use random fallback
      }
      return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    initialData: FALLBACK_QUOTES[0],
  });
}
