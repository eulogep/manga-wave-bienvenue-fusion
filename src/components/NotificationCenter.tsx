import { useState } from 'react';
import { Bell, BookOpen, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useNotifications, type UserNotification } from '@/hooks/useNotifications';

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    refetch,
    markRead,
    markAllRead,
    resolveDestination,
  } = useNotifications();

  const openNotification = async (notification: UserNotification) => {
    if (openingId !== null) return;
    setActionError(null);
    setOpeningId(notification.id);
    try {
      if (!notification.isRead) await markRead.mutateAsync(notification.id);
      const destination = await resolveDestination(notification);
      setOpen(false);
      navigate(destination);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible d’ouvrir ce chapitre.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"
          aria-label={`Notifications, ${unreadCount} ${unreadCount > 1 ? 'non lues' : 'non lue'}`}
          data-testid="notification-bell"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span
              className="absolute right-0.5 top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--mw-accent-coral)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#06101a]"
              data-testid="notification-badge"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-white/[0.08] bg-[#0b121c] p-0 text-white sm:max-w-md [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"
      >
        <SheetHeader className="border-b border-white/[0.08] px-5 py-5 pr-16 text-left">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="font-outfit text-xl text-white">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 gap-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-4 w-4" />
                Tout marquer comme lu
              </Button>
            )}
          </div>
          <SheetDescription className="text-white/45">
            Les nouveaux chapitres des mangas que vous suivez.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" aria-live="polite">
          {isLoading && (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des notifications…
            </div>
          )}
          {isError && (
            <div className="m-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-white/70">
              <p>Impossible de charger les notifications.</p>
              <Button variant="link" className="mt-2 h-11 px-0 text-[var(--mw-accent-coral)]" onClick={() => refetch()}>
                Réessayer
              </Button>
            </div>
          )}
          {!isLoading && !isError && notifications.length === 0 && (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Bell className="mb-4 h-8 w-8 text-white/25" />
              <p className="text-sm text-white/55">Aucune notification pour le moment.</p>
            </div>
          )}
          {!isLoading && !isError && notifications.length > 0 && (
            <ul className="divide-y divide-white/[0.06]" data-testid="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className="flex min-h-[92px] w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mw-accent-coral)]"
                    onClick={() => void openNotification(notification)}
                    disabled={openingId !== null}
                    aria-label={`${notification.isRead ? 'Lue' : 'Non lue'} : ${notification.body}`}
                    data-testid="notification-item"
                  >
                    <span className="flex h-14 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
                      {notification.manga.coverImage ? (
                        <img src={notification.manga.coverImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="m-auto h-5 w-5 text-white/30" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">{notification.manga.title}</span>
                        {!notification.isRead && (
                          <span className="rounded-full bg-[var(--mw-accent-coral)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mw-accent-coral)]">
                            Non lue
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-white/65">Nouveau chapitre {notification.chapterNumber}</span>
                      <span className="mt-1 block text-xs text-white/40">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                      </span>
                      {openingId === notification.id && (
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-white/55">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche de la meilleure source…
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(actionError || markAllRead.isError) && (
          <p role="alert" className="border-t border-red-400/20 bg-red-400/[0.06] px-5 py-3 text-sm text-red-100">
            {actionError || 'Impossible de marquer les notifications comme lues.'}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
