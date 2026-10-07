import json, time, random, hashlib, re
from pathlib import Path
from dataclasses import dataclass, field, asdict

from curl_cffi import requests as cf_requests
from curl_cffi.requests import Session as CFSession
from selectolax.parser import HTMLParser


# ---------- Utilitaires ----------

@dataclass
class Chapter:
    title: str
    url: str
    number: str = ""

@dataclass
class Manga:
    title: str
    url: str
    source: str
    chapters: list = field(default_factory=list)


class Cache:
    """Cache disque : ne re-télécharge jamais deux fois la même page."""
    def __init__(self, dir_path=".scrape_cache"):
        self.dir = Path(dir_path)
        self.dir.mkdir(exist_ok=True)

    def _path(self, key):
        h = hashlib.md5(key.encode()).hexdigest()
        return self.dir / f"{h}.json"

    def get(self, key):
        p = self._path(key)
        if p.exists():
            return json.loads(p.read_text())
        return None

    def set(self, key, data):
        self._path(key).write_text(json.dumps(data, ensure_ascii=False))


class BaseScraper:
    """Classe de base : session persistante, délais humanisés, backoff."""
    source = "base"

    def __init__(self, cache=True, min_delay=2.0, max_delay=6.0):
        self.cache = Cache() if cache else None
        self.min_delay = min_delay
        self.max_delay = max_delay

    def _sleep(self):
        time.sleep(random.uniform(self.min_delay, self.max_delay))

    def _get(self, url, **kwargs):
        if self.cache and (data := self.cache.get(url)):
            return data

        for attempt in range(4):
            try:
                resp = self.session.get(url, timeout=30, **kwargs)
                if resp.status_code == 200:
                    data = {"status": 200, "text": resp.text}
                    if self.cache:
                        self.cache.set(url, data)
                    self._sleep()
                    return data
                elif resp.status_code in (403, 429):
                    # Backoff exponentiel : IP heat, on attend
                    wait = 2 ** attempt * random.uniform(5, 15)
                    print(f"[{self.source}] {resp.status_code} sur {url}, pause {wait:.0f}s")
                    time.sleep(wait)
                else:
                    print(f"[{self.source}] HTTP {resp.status_code} sur {url}")
                    return None
            except Exception as e:
                print(f"[{self.source}] Erreur ({e}), tentative {attempt + 1}/4")
                time.sleep(5 * (attempt + 1))
        return None

    def search(self, query) -> list[Manga]:
        raise NotImplementedError

    def get_chapters(self, manga: Manga) -> list[Chapter]:
        raise NotImplementedError

    def download_chapter(self, chapter: Chapter, out_dir: Path) -> list[Path]:
        raise NotImplementedError


# ---------- 1. Webtoons ----------

class WebtoonScraper(BaseScraper):
    source = "webtoons"
    BASE = "https://www.webtoons.com"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session = CFSession(impersonate="chrome124")
        self.session.headers.update({
            "Referer": self.BASE,
            "Accept-Language": "en-US,en;q=0.9",
        })

    def search(self, query) -> list[Manga]:
        # Webtoons n'a pas d'endpoint de recherche public ; passer par la search page
        data = self._get(f"{self.BASE}/en/search?q={query}")
        if not data:
            return []
        tree = HTMLParser(data["text"])
        results = []
        for card in tree.css("a.card_item"):
            title_el = card.css_first(".subj")
            if title_el:
                results.append(Manga(
                    title=title_el.text(strip=True),
                    url=self.BASE + card.attributes["href"],
                    source=self.source,
                ))
        return results

    def get_chapters(self, manga: Manga) -> list[Chapter]:
        data = self._get(manga.url)
        if not data:
            return []
        tree = HTMLParser(data["text"])
        chapters = []
        for li in tree.css("ul#_listPanel li"):
            a = li.css_first("a")
            if not a:
                continue
            title = a.css_first(".subj span") or a.css_first(".subj")
            if title:
                chapters.append(Chapter(
                    title=title.text(strip=True),
                    url=self.BASE + a.attributes["href"],
                    number=re.search(r"no=(\d+)", a.attributes["href"]).group(1)
                    if "no=" in a.attributes["href"] else "",
                ))
        return list(reversed(chapters))

    def download_chapter(self, chapter: Chapter, out_dir: Path) -> list[Path]:
        data = self._get(chapter.url)
        if not data:
            return []
        tree = HTMLParser(data["text"])
        out_dir.mkdir(parents=True, exist_ok=True)
        paths = []
        for i, img in enumerate(tree.css("div.viewer_img img")):
            src = img.attributes.get("data-url") or img.attributes.get("src", "")
            if not src:
                continue
            # Skip les pixels de tracking (phase1.jpg etc.)
            if "spacer" in src or "phase" in src:
                continue
            if src.startswith("//"):
                src = "https:" + src
            p = out_dir / f"{i:03d}.jpg"
            if not p.exists():
                self._sleep()
                img_resp = self.session.get(src, headers={"Referer": self.BASE})
                p.write_bytes(img_resp.content)
            paths.append(p)
        return paths


# ---------- 2. Tapas (via Playwright si besoin) ----------

class TapasScraper(BaseScraper):
    source = "tapas"
    BASE = "https://tapas.io"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Tapas répond souvent au fetch direct si on imite Chrome
        self.session = CFSession(impersonate="chrome124")
        self.session.headers.update({"X-Requested-With": "XMLHttpRequest"})

    def search(self, query) -> list[Manga]:
        # La search API interne : vérifie l'endpoint exact dans DevTools (il change parfois)
        data = self._get(f"{self.BASE}/search?query={query}")
        if not data:
            return []
        tree = HTMLParser(data["text"])
        results = []
        for a in tree.css("a.series-link, div.info__title a"):
            if a.attributes.get("href"):
                results.append(Manga(
                    title=a.text(strip=True),
                    url=self.BASE + a.attributes["href"],
                    source=self.source,
                ))
        return results

    def get_chapters(self, manga: Manga) -> list[Chapter]:
        # Endpoint JSON de la pagination d'épisodes
        series_id = re.search(r"/series/(\d+)", manga.url)
        if not series_id:
            return []
        chapters, page = [], 1
        while True:
            url = (f"{self.BASE}/series/{series_id.group(1)}/episodes"
                   f"?page={page}&sort=NEWEST&last_access=&js_bootstrapped=true")
            data = self._get(url)
            if not data or "no more" in data["text"].lower():
                break
            tree = HTMLParser(data["text"])
            items = tree.css("li.episode-li, a.episode__link")
            if not items:
                break
            for it in items:
                href = it.attributes.get("href", "")
                title = it.css_first(".title") or it
                chapters.append(Chapter(
                    title=title.text(strip=True),
                    url=self.BASE + href if href else "",
                ))
            page += 1
        return list(reversed(chapters))

    def download_chapter(self, chapter: Chapter, out_dir: Path) -> list[Path]:
        # Les pages d'épisode Tapas sont JS-heavy : Playwright nécessaire
        from playwright.sync_api import sync_playwright
        out_dir.mkdir(parents=True, exist_ok=True)
        paths = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(chapter.url, wait_until="networkidle")
            # Scroll pour déclencher le lazy-load des images
            for _ in range(20):
                page.mouse.wheel(0, 2000)
                page.wait_for_timeout(300)
            srcs = page.eval_on_selector_all(
                "div.episode-image img, article img.js-episode-image",
                "els => els.map(e => e.src || e.dataset.src)"
            )
            browser.close()
        for i, src in enumerate(srcs):
            if not src or "spacer" in src:
                continue
            fp = out_dir / f"{i:03d}.jpg"
            if not fp.exists():
                self._sleep()
                resp = self.session.get(src)
                fp.write_bytes(resp.content)
            paths.append(fp)
        return paths


# ---------- 3. Mangakakalot (curl_cffi contre Cloudflare) ----------

class MangakakalotScraper(BaseScraper):
    source = "mangakakalot"
    # Le domaine actif change : checker les miroirs (manganato, m reads, etc.)
    BASE = "https://mangakakalot.com"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.session = CFSession(impersonate="chrome124")

    def search(self, query) -> list[Manga]:
        data = self._get(
            f"{self.BASE}/search/story/{query.replace(' ', '_')}"
        )
        if not data:
            return []
        tree = HTMLParser(data["text"])
        results = []
        for a in tree.css("div.story_item a, .story_item_right a, .search-story-item a"):
            if a.attributes.get("href"):
                results.append(Manga(
                    title=a.text(strip=True) or a.attributes.get("title", ""),
                    url=a.attributes["href"],
                    source=self.source,
                ))
        return results

    def get_chapters(self, manga: Manga) -> list[Chapter]:
        data = self._get(manga.url)
        if not data:
            return []
        tree = HTMLParser(data["text"])
        chapters = []
        # Les 2 layouts principaux du site
        for row in tree.css("div.row-content-chapter a, div.chapter-list .row span a"):
            chapters.append(Chapter(
                title=row.text(strip=True),
                url=row.attributes["href"],
            ))
        return chapters

    def download_chapter(self, chapter: Chapter, out_dir: Path) -> list[Path]:
        data = self._get(chapter.url)
        if not data:
            return []
        tree = HTMLParser(data["text"])
        out_dir.mkdir(parents=True, exist_ok=True)
        paths = []
        for i, img in enumerate(tree.css("div.container-chapter-reader img")):
            src = img.attributes.get("src", "")
            if not src:
                continue
            p = out_dir / f"{i:03d}.jpg"
            if not p.exists():
                self._sleep()
                resp = self.session.get(src)
                p.write_bytes(resp.content)
            paths.append(p)
        return paths


# ---------- CLI ----------

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("source", choices=["webtoons", "tapas", "mangakakalot"])
    parser.add_argument("query", help="Titre à chercher")
    parser.add_argument("--download", action="store_true", help="Télécharger le chapitre 1")
    args = parser.parse_args()

    scrapers = {
        "webtoons": WebtoonScraper,
        "tapas": TapasScraper,
        "mangakakalot": MangakakalotScraper,
    }
    scraper = scrapers[args.source]()

    results = scraper.search(args.query)
    for i, m in enumerate(results[:10]):
        print(f"[{i}] {m.title} — {m.url}")

    if args.download and results:
        manga = results[0]
        print(f"\nRécupération des chapitres de : {manga.title}")
        chapters = scraper.get_chapters(manga)
        print(f"{len(chapters)} chapitres trouvés")
        if chapters:
            out = Path(f"downloads/{manga.title.replace(' ', '_')}/ch_{chapters[0].number or '001'}")
            files = scraper.download_chapter(chapters[0], out)
            print(f"{len(files)} images téléchargées dans {out}")
