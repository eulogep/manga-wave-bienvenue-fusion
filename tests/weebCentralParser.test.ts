import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWeebCentralCards as parseCards } from '../server/src/lib/weebcentral-parser.ts';

// Regression test for a real bug found while building this extractor:
// WeebCentral's /search/data endpoint renders each card as its OWN
// `<article class="bg-base-300 flex gap-4 p-4">` block containing a desktop
// AND a mobile-duplicate <picture> for the SAME manga (two srcset/alt pairs
// per card) — plus, on the live site, an unrelated widget elsewhere on the
// page can repeat a series' own href. A single cross-field regex without a
// card boundary can walk from one card's id straight into the NEXT card's
// cover and title. Verified live against a real "one piece" search before
// fixing: id/slug always came from the right card, but cover+title drifted
// one card ahead starting from the second result.
test('keeps each card\'s id bound to its own cover and title, never a neighbouring card\'s', () => {
  const html = `
    <article class="bg-base-300 flex gap-4 p-4">
      <section>
        <a href="https://weebcentral.com/series/AAA111/One-Piece">
          <article class="hidden lg:block"><picture>
            <source srcset="https://temp.compsci88.com/cover/normal/AAA111.webp">
            <img src="x" alt="One Piece cover">
          </picture></article>
          <article class="lg:hidden"><picture>
            <source srcset="https://temp.compsci88.com/cover/normal/AAA111.webp">
            <img src="x" alt="One Piece cover">
          </picture></article>
        </a>
      </section>
    </article>
    <article class="bg-base-300 flex gap-4 p-4">
      <section>
        <a href="https://weebcentral.com/series/BBB222/One-Piece-Party">
          <article class="hidden lg:block"><picture>
            <source srcset="https://temp.compsci88.com/cover/normal/BBB222.webp">
            <img src="x" alt="One Piece Party cover">
          </picture></article>
          <article class="lg:hidden"><picture>
            <source srcset="https://temp.compsci88.com/cover/normal/BBB222.webp">
            <img src="x" alt="One Piece Party cover">
          </picture></article>
        </a>
      </section>
    </article>
    <!-- an unrelated "related series" widget repeating the first card's link -->
    <a href="https://weebcentral.com/series/AAA111/One-Piece">Related: One Piece</a>
  `;

  assert.deepEqual(
    parseCards(html).map(({ id, coverUrl, title }) => ({ id, coverUrl, title })),
    [
      { id: 'AAA111/One-Piece', coverUrl: 'https://temp.compsci88.com/cover/normal/AAA111.webp', title: 'One Piece' },
      { id: 'BBB222/One-Piece-Party', coverUrl: 'https://temp.compsci88.com/cover/normal/BBB222.webp', title: 'One Piece Party' },
    ],
  );
});

test('a card missing a cover or title is skipped rather than guessed from elsewhere', () => {
  const html = `
    <article class="bg-base-300 flex gap-4 p-4">
      <a href="https://weebcentral.com/series/CCC333/No-Cover">No picture markup here at all.</a>
    </article>
    <article class="bg-base-300 flex gap-4 p-4">
      <a href="https://weebcentral.com/series/DDD444/Has-Cover">
        <picture><source srcset="https://temp.compsci88.com/cover/normal/DDD444.webp"><img alt="Has Cover cover"></picture>
      </a>
    </article>
  `;
  assert.deepEqual(
    parseCards(html).map(({ id }) => id),
    ['DDD444/Has-Cover'],
  );
});
