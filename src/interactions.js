// The structural cells of the interaction matrix (spec Section 4), one row
// per resolved interaction on a device, as a Markdown table. The decision is
// the bracketed suffix of a schema edge's `why`; a dry coupling is always
// `expose`, since the hollow light already shows it.
export function renderInteractions(rack, schema) {
  const label = new Map(rack.devices.map((d) => [d.device, d.label]));
  const rows = ['| Device | Depends on | Kind | Source | Mechanism | Decision |', '| --- | --- | --- | --- | --- | --- |'];
  for (const device of rack.devices) {
    for (const entry of device.interactions) {
      const fromSchema = schema.interactions.some((e) => e.why === entry.why && e.kind === entry.kind);
      const match = /^(.*?)\s*\[(expose|alternative|drop)\]$/.exec(entry.why);
      if (fromSchema && !match) throw new Error(`interaction on ${device.device}: schema edge has no [decision] suffix: ${entry.why}`);
      const mechanism = match ? match[1] : entry.why;
      const decision = match ? match[2] : 'expose';
      rows.push(`| ${label.get(device.device)} | ${label.get(entry.device)} | ${entry.kind} | ${fromSchema ? 'schema' : 'dry'} | ${mechanism} | ${decision} |`);
    }
  }
  return rows.join('\n');
}
