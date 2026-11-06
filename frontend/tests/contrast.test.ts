import assert from 'node:assert/strict';
import { test } from 'node:test';
import config from '../tailwind.config.js';

const colors = config.theme.extend.colors;
function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Body, muted text and status colors meet 4.5:1 on all solid theme surfaces', () => {
  for (const foreground of [colors.foreground.DEFAULT, colors.foreground.muted, colors.brand.DEFAULT, colors.brand.hover, colors.accent.DEFAULT, colors.success, colors.warning, colors.danger]) {
    for (const background of [colors.background, colors.surface.DEFAULT, colors.surface.elevated]) {
      assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
    }
  }
});

test('Primary button labels meet 4.5:1 in default and hover states', () => {
  for (const background of [colors.brand.DEFAULT, colors.brand.hover]) {
    assert.ok(contrast(colors.brand.foreground, background) >= 4.5);
  }
});
