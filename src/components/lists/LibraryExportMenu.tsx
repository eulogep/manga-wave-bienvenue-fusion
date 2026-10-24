import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useUserLists } from '@/hooks/useUserLists';
import type { LibraryItem } from '@/domain/libraryItem';
import { buildLibraryExport, libraryExportFileName, libraryExportToCsv } from '@/domain/libraryExport';

const download = (content: string, type: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled so the download is not cancelled.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Exports the reader's own library and lists; everything is built in the browser. */
export const LibraryExportMenu = ({ items }: { items: LibraryItem[] }) => {
  const { toast } = useToast();
  const userLists = useUserLists();
  const disabled = userLists.isLoading || (items.length === 0 && userLists.items.length === 0);

  const handleExport = (format: 'json' | 'csv') => {
    const data = buildLibraryExport(items, userLists.lists, userLists.items);
    if (format === 'json') {
      download(JSON.stringify(data, null, 2), 'application/json', libraryExportFileName('json'));
    } else {
      download(libraryExportToCsv(data), 'text/csv;charset=utf-8', libraryExportFileName('csv'));
    }
    toast({
      title: 'Export prêt',
      description: `${data.library.length} titre${data.library.length > 1 ? 's' : ''} et ${data.lists.length} liste${data.lists.length > 1 ? 's' : ''} exportés.`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 border-white/20" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60 border-white/15 bg-[#0f1520] text-white">
        <DropdownMenuLabel className="text-xs font-normal text-white/50">Sauvegarde de tes données</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => handleExport('json')}>
          <FileJson className="mr-2 h-4 w-4" /> JSON complet (listes et notes)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport('csv')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV pour tableur
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
