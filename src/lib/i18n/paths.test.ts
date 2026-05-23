import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLocaleFromPath,
  shouldApplyForgeLocaleRouting,
  stripLocalePrefix,
  withLocalePrefix,
} from './paths.js';

test('getLocaleFromPath reads URL prefix', () => {
  assert.equal(getLocaleFromPath('/en/platform-downloads'), 'en');
  assert.equal(getLocaleFromPath('/platform-downloads'), null);
});

test('withLocalePrefix builds localized paths', () => {
  assert.equal(withLocalePrefix('/resources', 'de'), '/de/resources');
  assert.equal(withLocalePrefix('/en/resources', 'fr'), '/fr/resources');
});

test('shouldApplyForgeLocaleRouting whitelists hub pages only', () => {
  assert.equal(shouldApplyForgeLocaleRouting('/platform-downloads'), true);
  assert.equal(shouldApplyForgeLocaleRouting('/fr/docs/README.html'), true);
  assert.equal(shouldApplyForgeLocaleRouting('/health'), false);
  assert.equal(shouldApplyForgeLocaleRouting('/api/app/download'), false);
  assert.equal(shouldApplyForgeLocaleRouting('/chat'), false);
});

test('stripLocalePrefix removes leading locale segment', () => {
  assert.equal(stripLocalePrefix('/ar/contact'), '/contact');
});
