# python_bridge.py — wrapper autour des scrapers existants
import sys, json, argparse
from scraper import scrapers  # ton module existant

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["search", "chapters", "download"])
    parser.add_argument("--source", required=True)
    parser.add_argument("--arg", required=True)
    args = parser.parse_args()

    scraper = scrapers[args.source]()
    if args.command == "search":
        results = [{"title": m.title, "url": m.url, "source": m.source}
                   for m in scraper.search(args.arg)]
    elif args.command == "chapters":
        results = [{"title": c.title, "url": c.url, "number": c.number}
                   for c in scraper.get_chapters(manga_from(args.arg))]
    # ... download -> renvoie les chemins locaux

    json.dump(results, sys.stdout, ensure_ascii=False)
