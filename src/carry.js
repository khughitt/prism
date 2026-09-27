import { isDeepStrictEqual } from 'node:util';

// The scratch a wallpaper transition leaves: every value that was visible
// before and that the fold after it (without scratch) would not show, except
// the keys the incoming pair sets, which the pair owns. Nothing is saved; the
// screen changes only where the pair speaks (2026-09-27 rotation design).
export function carryScratch(previous, beneath, pairValues) {
  const scratch = {};
  for (const [key, value] of Object.entries(previous)) {
    if (Object.hasOwn(pairValues, key)) continue;
    if (!isDeepStrictEqual(value, beneath[key])) scratch[key] = value;
  }
  return scratch;
}
