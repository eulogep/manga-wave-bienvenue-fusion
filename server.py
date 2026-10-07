# server.py
from fastapi import FastAPI
from scraper import scrapers

app = FastAPI()

@app.get("/search")
def search(source: str, q: str):
    return [{"title": m.title, "url": m.url} for m in scrapers[source]().search(q)]
