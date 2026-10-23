import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { ActivityCalendar, GenreBars, MonthlyChart, StatTile, WeeklyGoalMeter } from '@/components/stats/ReadingCharts';
import { useAuth } from '@/hooks/useAuth';
import { useReadingStats, useWeeklyGoal } from '@/hooks/useReadingStats';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { formatDocumentTitle } from '@/domain/documentMetadata';

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

const Stats = () => {
  useDocumentMetadata(formatDocumentTitle('Mes statistiques'));
  const { user, loading } = useAuth();
  const { stats, sessions } = useReadingStats();
  const { goal, setGoal } = useWeeklyGoal();

  const body = () => {
    if (loading || (user && sessions.isPending)) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className={`animate-pulse rounded-2xl bg-white/5 ${index < 4 ? 'h-28' : 'h-56 sm:col-span-2'}`} />)}
        </div>
      );
    }
    if (!user) {
      return (
        <section className="mx-auto my-8 max-w-2xl rounded-3xl border border-manga-purple/30 bg-gradient-to-br from-manga-purple/15 to-manga-cyan/5 p-8 text-center md:p-12">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-manga-cyan" />
          <h2 className="mb-2 font-outfit text-2xl font-bold">Tes statistiques t’attendent</h2>
          <p className="mb-6 text-sm leading-relaxed text-white/60">Connecte-toi pour voir tes chapitres lus, ta régularité et tes genres préférés.</p>
          <Button className="btn-gradient rounded-full px-8" asChild><Link to="/auth?redirect=%2Fstats">Se connecter</Link></Button>
        </section>
      );
    }
    if (sessions.isError) {
      return (
        <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Statistiques indisponibles</h2>
          <p className="mb-6 text-sm text-white/60">{sessions.error?.message}</p>
          <Button className="btn-gradient" onClick={() => void sessions.refetch()} disabled={sessions.isFetching}>Réessayer</Button>
        </section>
      );
    }
    if (!stats || stats.activeDays === 0) {
      return (
        <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-manga-cyan opacity-70" />
          <h2 className="mb-2 text-xl font-bold">Aucune lecture sur les 12 derniers mois</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-white/50">Ouvre un chapitre : tes statistiques se construiront à partir de ton historique réel.</p>
          <Button className="btn-gradient rounded-full px-6" asChild><Link to="/search">Trouver un manga</Link></Button>
        </section>
      );
    }
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Chapitres terminés" value={stats.finishedChapters} hint="Lus à 90 % ou plus" />
          <StatTile label="Séries lues" value={stats.seriesCount} />
          <StatTile label="Jours de lecture" value={stats.activeDays} />
          <StatTile
            label="Série de jours en cours"
            value={plural(stats.currentStreak, 'jour')}
            hint={`Record : ${plural(stats.longestStreak, 'jour')}`}
          />
        </div>
        <WeeklyGoalMeter chaptersThisWeek={stats.chaptersThisWeek} goal={goal} onGoalChange={setGoal} />
        <div className="grid gap-5 lg:grid-cols-2">
          <ActivityCalendar calendar={stats.calendar} />
          <MonthlyChart monthly={stats.monthly} />
        </div>
        <GenreBars genres={stats.topGenres} />
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <section className="mb-8">
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">ESPACE PERSONNEL</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">Mes <span className="glow-text">statistiques</span></h1>
            <p className="max-w-2xl text-sm text-white/50 md:text-base">
              Calculées uniquement à partir de ton historique de lecture des 12 derniers mois. Ces données restent privées.{' '}
              <Link to="/history" className="text-manga-cyan underline underline-offset-2 hover:text-white">Voir l’historique</Link>
            </p>
          </section>
          {body()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Stats;
