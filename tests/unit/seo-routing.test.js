import assert from 'node:assert/strict';
import test from 'node:test';

import robots from '../../src/app/robots.js';
import sitemap from '../../src/app/sitemap.js';
import { isPublicPath } from '../../src/lib/public-routes.js';
import { buildMetadata } from '../../src/lib/seo.js';

test('crawler and social metadata routes are public', () => {
  assert.equal(isPublicPath('/robots.txt'), true);
  assert.equal(isPublicPath('/sitemap.xml'), true);
  assert.equal(isPublicPath('/opengraph-image'), true);
});

test('sitemap lists only public indexable pages', () => {
  const urls = sitemap().map((entry) => new URL(entry.url).pathname);

  assert.deepEqual(urls, ['/', '/about', '/contact', '/privacy', '/terms']);
  assert.equal(urls.includes('/agents'), false);
  assert.equal(urls.includes('/cvs'), false);
});

test('robots points crawlers to the generated sitemap', () => {
  assert.equal(robots().rules[0].allow, '/');
  assert.equal(new URL(robots().sitemap).pathname, '/sitemap.xml');
});

test('metadata helper emits relative canonical paths and absolute open graph urls', () => {
  const metadata = buildMetadata({
    title: 'ClassForge',
    path: '/about',
  });

  assert.equal(metadata.alternates.canonical, '/about');
  assert.equal(metadata.openGraph.url.endsWith('/about'), true);
  assert.equal(metadata.robots.index, true);
  assert.equal(metadata.robots.follow, true);
});
