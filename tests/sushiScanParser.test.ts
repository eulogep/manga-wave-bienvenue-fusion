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
