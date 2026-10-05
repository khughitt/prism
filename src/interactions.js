// The structural cells of the interaction matrix (spec Section 4), one row
// per resolved interaction on a device, as a Markdown table. Each interaction
// carries its source: a schema edge's decision is the bracketed suffix of its
// `why`, which it must have; a dry coupling is always `expose`, since the
// hollow light already shows it.
const SOURCES = ['schema', 'dry'];

export function renderInteractions(rack) {
  const label = new Map(rack.devices.map((d) => [d.device, d.label]));
  const rows = ['| Device | Depends on | Kind | Source | Mechanism | Decision |', '| --- | --- | --- | --- | --- | --- |'];
  for (const device of rack.devices) {
    for (const entry of device.interactions) {
      if (!SOURCES.includes(entry.source)) throw new Error(`interaction on ${device.device}: unknown source ${entry.source}`);
      const match = /^(.*?)\s*\[(expose|alternative|drop)\]$/.exec(entry.why);
      if (entry.source === 'schema' && !match) throw new Error(`interaction on ${device.device}: schema edge has no [decision] suffix: ${entry.why}`);
      const mechanism = match ? match[1] : entry.why;
      const decision = match ? match[2] : 'expose';
      rows.push(`| ${label.get(device.device)} | ${label.get(entry.device)} | ${entry.kind} | ${entry.source} | ${mechanism} | ${decision} |`);
    }
  }
  return rows.join('\n');
}
