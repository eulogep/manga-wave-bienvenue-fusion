import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSushiScanHtml, parseSushiScanCards } from '../server/src/lib/sushiscan-parser.ts';

test('keeps each Sushi-Scan cover bound to the anchor for the same manga', () => {
  const html = `
    <a href="https://sushiscan.fr/catalogue/intro/" title="Intro">Texte sans image</a>
    <a href="https://sushiscan.fr/catalogue/la-servante-secrete/" title="La Servante Secrète">
      <div><img src="https://sushiscan.fr/media/servante.png" alt="La Servante Secrète"></div>
    </a>
    <a href="https://sushiscan.fr/catalogue/la-servante-secrete/" title="La Servante Secrète">Lien texte répété</a>
    <a href="https://sushiscan.fr/catalogue/martial-peak/" title="Martial Peak">
      <div><img data-src="https://sushiscan.fr/media/martial.png" alt="Martial Peak"></div>
    </a>
  `;

  assert.deepEqual(
    parseSushiScanCards(html).map(({ id, coverUrl }) => ({ id, coverUrl })),
    [
      { id: 'la-servante-secrete', coverUrl: 'https://sushiscan.fr/media/servante.png' },
      { id: 'martial-peak', coverUrl: 'https://sushiscan.fr/media/martial.png' },
    ],
  );
});

test('decodes named and numeric apostrophe entities in card titles', () => {
  assert.equal(decodeSushiScanHtml('L&rsquo;Âge de l&#8217;Arrogance'), "L'Âge de l'Arrogance");
});

test('binds homepage genre metadata to the matching catalogue card only', () => {
  const html = `
    <a href="https://sushiscan.fr/catalogue/secret-class/" title="Secret Class">
      <img src="https://sushiscan.fr/media/secret.webp" alt="Secret Class">
    </a>
    <a href="https://sushiscan.fr/catalogue/safe-work/" title="Safe Work">
      <img src="https://sushiscan.fr/media/safe.webp" alt="Safe Work">
    </a>
    <ul>
      <li>
        <a class="series" href="https://sushiscan.fr/catalogue/secret-class/">Secret Class</a>
        <span><b>Genres</b>:
          <a href="https://sushiscan.fr/genres/erotique/" rel="tag">Erotique</a>,
          <a href="https://sushiscan.fr/genres/pornhwa/" rel="tag">Pornhwa</a>
        </span>
      </li>
      <li>
        <a class="series" href="https://sushiscan.fr/catalogue/another-work/">Another Work</a>
        <span><b>Genres</b>:
          <a href="https://sushiscan.fr/genres/action/" rel="tag">Action</a>
        </span>
      </li>
    </ul>
  `;

  const cards = parseSushiScanCards(html);
  assert.deepEqual(cards.find(({ id }) => id === 'secret-class')?.genres, ['Erotique', 'Pornhwa']);
  assert.deepEqual(cards.find(({ id }) => id === 'safe-work')?.genres, []);
});
