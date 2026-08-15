export function renderGlassConfig(resolved) {
  const out = {};
  for (const [key, value] of Object.entries(resolved.params)) {
    if (key === 'compositor.gaps') out.layoutGaps = value;
    else if (key === 'terminal.apps') out.paneApps = value;
    else if (key.startsWith('glass.')) out[key.slice('glass.'.length)] = value;
  }
  return out;
}
