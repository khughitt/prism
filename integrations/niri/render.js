import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const MATERIAL = 'terminal-glass';
const INACTIVE_MATERIAL = 'terminal-glass-inactive';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rawKdl(value) {
  let hashes = '#';
  while (value.includes(`"${hashes}`)) hashes += '#';
  return `r${hashes}"${value}"${hashes}`;
}

// terminal.apps holds literal app ids; niri matches them as regexes.
function appMatcher(apps) {
  return apps.length === 0
    ? null
    : rawKdl(`^(${apps.map(escapeRegex).join('|')})$`);
}

// The one filament is shared by the focus light and signal accents, so the
// ring's color has one driver at a time. familiar tints it live through its
// per-window signal (accent stays on only then); noctalia hands over the
// colorscheme accent the apply read (resolved by sourceColors); manual pins the palette's own color.
// The band's own geometry is prism's now: ring-gap places it under the face
// and ring-width sizes it. niri rejects a width of zero, so the def's lower
// bound is strictly positive and no slider position can reach the error.
function responseBlock(params, sources) {
  const source = params['glass.ring.colorSource'];
  const color = sourceColors(params, sources)['glass.ring.color']?.value ?? params['glass.ring.color'];
  return [
    '    response "default" {',
    `        accent ${JSON.stringify(source === 'familiar' ? 'ring' : 'none')}`,
    `        focus ${JSON.stringify(params['glass.ring.focus'] ? 'ring-light' : 'none')}`,
    `        attention ${JSON.stringify(params['glass.ring.edgeTint'] ? 'rim-orbit' : 'none')}`,
    `        ring-color ${JSON.stringify(color)}`,
    `        ring-beam-speed ${params['glass.ring.beamSpeed']}`,
    `        ring-beam-noise ${params['glass.ring.beamNoise']}`,
    `        ring-beam-noise-hz ${params['glass.ring.beamNoiseHz']}`,
    `        ring-beam-decay ${params['glass.ring.decay']}`,
    `        ring-gap ${params['glass.ring.gap']}`,
    `        ring-width ${params['glass.ring.width']}`,
    `        ring-glow ${params['glass.ring.glow']}`,
    `        ring-rest ${params['glass.ring.rest']}`,
    `        ring-accent ${params['glass.ring.accent']}`,
    '    }',
  ];
}

function definition(name, params, glass, sources) {
  const bevel = params['glass.paneLip'] + Math.max(
    Math.abs(params['glass.paneShiftX']),
    Math.abs(params['glass.paneShiftY']),
  );
  return [
    `material ${JSON.stringify(name)} {`,
    '    glass {',
    `        ior ${glass.ior}`,
    `        light-ior ${params['glass.lightIor']}`,
    `        thickness ${glass.thickness}`,
    `        attenuation-color ${JSON.stringify(glass.attenuationColor)}`,
    `        attenuation-distance ${glass.attenuationDistance}`,
    `        chromatic-aberration ${glass.chromaticAberration}`,
    `        distortion ${glass.distortion} scale=${glass.distortionScale}`,
    `        anisotropic-blur ${glass.anisotropicBlur}`,
    `        roughness ${glass.roughness}`,
    `        iridescence ${glass.iridescence}`,
    `        aurora ${glass.aurora} {`,
    `            drift-hz ${glass.auroraDriftHz}`,
    `            color ${JSON.stringify(glass.auroraColorA)}`,
    `            color ${JSON.stringify(glass.auroraColorB)}`,
    '        }',
    `        noise ${glass.noise} type=${JSON.stringify(params['glass.noiseType'])}`,
    `        saturation ${glass.saturation}`,
    `        backdrop-blur ${glass.backdropBlur}`,
    `        jelly-flex ${params['glass.jellyFlex']}`,
    `        jelly-ripple ${params['glass.jellyRipple']}`,
    `        bevel ${bevel}`,
    `        offset-x ${params['glass.paneShiftX']}`,
    `        offset-y ${params['glass.paneShiftY']}`,
    '    }',
    ...responseBlock(params, sources),
    '}',
  ].join('\n');
}

// Every optic the Focus matrix splits. The slab frame, the pane motion, and the
// grain type stay in `params`: they are shared, because a material swap is a hard
// cut and a divergent frame would make focus resize the glass.
const OPTICS = [
  'backdropBlur', 'roughness', 'attenuationColor', 'attenuationDistance',
  'ior', 'thickness', 'chromaticAberration', 'distortion', 'distortionScale',
  'anisotropicBlur', 'noise', 'saturation',
  'iridescence', 'aurora', 'auroraDriftHz', 'auroraColorA', 'auroraColorB',
];

// What "off" means for each rack device lives in dry.yaml beside this file;
// the rack loader reads the same file to derive which device requires which.
export function loadDry() {
  const file = fileURLToPath(new URL('./dry.yaml', import.meta.url));
  const dry = parse(fs.readFileSync(file, 'utf8'));
  for (const [key, fields] of Object.entries(dry)) {
    if (!key.startsWith('glass.bypass.')) throw new Error(`dry.yaml: ${key} is not a bypass key`);
    if (typeof fields !== 'object' || fields === null || Object.keys(fields).length === 0) {
      throw new Error(`dry.yaml: ${key} must map to at least one field`);
    }
  }
  return dry;
}

export const DRY = loadDry();

const paletteTint = (surface, accent, mix) => mix === 0
  ? surface.toLowerCase()
  : '#' + [1, 3, 5].map((offset) => Math.round(
    parseInt(surface.slice(offset, offset + 2), 16) * (1 - mix)
    + parseInt(accent.slice(offset, offset + 2), 16) * mix,
  ).toString(16).padStart(2, '0')).join('');

const NOCTALIA = 'the Noctalia palette';

// The colors a source resolves, keyed as the store names them. The render
// emits these and the apply reports them, so the KDL and the report cannot
// disagree. A key is present only when a source, not the store, decided it.
export function sourceColors(params, sources) {
  const colors = {};
  if (params['glass.enabled'] !== true) return colors;
  if (params['glass.tintSource'] === 'noctalia' && params['glass.bypass.tint'] !== true) {
    if (!sources.noctaliaSurface) throw new Error('noctalia tint rendered without a validated surface');
    const tint = { value: paletteTint(sources.noctaliaSurface, sources.noctaliaAccent,
      params['glass.tintAccentMix']), from: NOCTALIA };
    colors['glass.attenuationColor'] = tint;
    colors['glass.inactive.attenuationColor'] = tint;
  }
  const ring = params['glass.ring.colorSource'];
  if (ring === 'noctalia') {
    colors['glass.ring.color'] = typeof sources.noctaliaAccent === 'string'
      ? { value: sources.noctaliaAccent, from: NOCTALIA }
      : { value: params['glass.ring.color'], from: 'the stored Color; no Noctalia palette was found' };
  } else if (ring === 'familiar') {
    colors['glass.ring.color'] = { value: params['glass.ring.color'],
      from: "the resting color; each agent session's hue replaces it on its window" };
  }
  return colors;
}

// A bypass is shared by both focus states, so the override lands in whichever
// material this is building. The resolved values on the bus are untouched.
const glassFor = (params, prefix, sources) => {
  const glass = Object.fromEntries(OPTICS.map((optic) => [optic, params[`${prefix}${optic}`]]));
  const tint = sourceColors(params, sources)[`${prefix}attenuationColor`];
  if (tint) glass.attenuationColor = tint.value;
  for (const [key, dry] of Object.entries(DRY)) {
    if (params[key] === true) Object.assign(glass, dry);
  }
  return glass;
};

const activeGlass = (params, sources) => glassFor(params, 'glass.', sources);
const inactiveGlass = (params, sources) => glassFor(params, 'glass.inactive.', sources);

// The inert background effect pins the superseded blur/noise pass off for the
// windows this file owns. It needs no xray override: an inert effect never
// reaches niri's automatic xray path.
function assignmentRule(matcher, material, active) {
  return [
    'window-rule {',
    `    match app-id=${matcher}${active === undefined ? '' : ` is-active=${active}`}`,
    ...(material === null ? [] : [`    material ${JSON.stringify(material)}`]),
    '    background-effect {',
    '        blur false',
    '        noise 0',
    '        saturation 1',
    '    }',
    '}',
  ].join('\n');
}

// niri merges this block into the host's own layout, so it carries only what
// prism owns. The material's ring of light lights every focused glass window,
// and niri-material's guidance is to switch the static gradient ring off or
// both draw; a later host focus-ring block that sets width or gradient leaves
// the off flag in force.
function layoutBlock(params) {
  return [
    'layout {',
    `    gaps ${params['compositor.gaps']}`,
    ...(params['glass.enabled'] ? ['    focus-ring { off; }'] : []),
    '}',
  ].join('\n');
}

export function renderNiriFragment(resolved, sources = {}) {
  const params = resolved.params;
  const matcher = appMatcher(params['terminal.apps']);
  const glass = params['glass.enabled'];
  const split = glass && params['glass.focusSplit'];
  return [
    '// generated by prism — do not edit',
    layoutBlock(params),
    // Glass off leaves no material node behind: the node is niri-material's
    // own, and a niri without it rejects the whole config over one it does not
    // know. Everything that remains is upstream vocabulary.
    ...(glass ? [definition(MATERIAL, params, activeGlass(params, sources), sources)] : []),
    ...(split ? [definition(INACTIVE_MATERIAL, params, inactiveGlass(params, sources), sources)] : []),
    ...(matcher === null ? []
      : split ? [
        assignmentRule(matcher, MATERIAL, true),
        assignmentRule(matcher, INACTIVE_MATERIAL, false),
      ]
      : [assignmentRule(matcher, glass ? MATERIAL : null)]),
    '',
  ].join('\n');
}
