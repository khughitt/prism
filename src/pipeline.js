import fs from 'node:fs';
import path from 'node:path';

// The renderer's pipeline schema, vendored as a byte copy of the renderer's
// resources/materials/pipeline.json. This module checks the copy's version
// and shape at load; freshness against the checkout is the contract test's
// job (docs/specs/2026-10-04-pipeline-schema-design.md, Section 3).
export const VERSION = 1;
export const CARRIERS = ['texture', 'normal', 'linear', 'light', 'encoded'];
export const LAWS = ['sequence', 'sum', 'product', 'coupled'];
export const COVERAGES = ['backdrop', 'glass', 'window'];
export const COSTS = ['cached', 'fragment'];
export const SCOPES = ['output', 'material', 'window'];
export const PROGRAMS = ['material', 'effect', 'postprocess'];
export const KINDS = ['requires', 'attenuates', 'shadows'];
export const BLUR_FIELDS = ['blur passes', 'blur offset', 'blur noise', 'blur saturation'];

const fail = (msg) => { throw new Error(`invalid pipeline schema: ${msg}`); };
const oneOf = (where, field, value, allowed) => {
  if (!allowed.includes(value)) fail(`${where}: ${field} must be one of ${allowed.join('|')}`);
};
const strings = (where, field, value) => {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) fail(`${where}: ${field} must be a list of strings`);
};
const nonEmptyList = (field, value) => {
  if (!Array.isArray(value) || value.length === 0) fail(`${field} must be a non-empty list`);
};

export function loadPipeline(dir) {
  const file = path.join(dir, 'rack', 'pipeline.json');
  return validatePipeline(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function validatePipeline(schema) {
  if (schema?.version !== VERSION) {
    fail(`pipeline schema version ${schema?.version} is not supported; this prism reads version ${VERSION}`);
  }
  nonEmptyList('sites', schema.sites);
  nonEmptyList('stages', schema.stages);
  if (!Array.isArray(schema.interactions)) fail('interactions must be a list');

  const siteIndex = new Map();
  schema.sites.forEach((site, i) => {
    const where = `site ${site?.id ?? '?'}`;
    if (typeof site?.id !== 'string' || site.id === '') fail(`${where}: id required`);
    if (siteIndex.has(site.id)) fail(`${where}: duplicate id`);
    oneOf(where, 'carrier', site.carrier, CARRIERS);
    oneOf(where, 'law', site.law, LAWS);
    if (typeof site.orderable !== 'boolean') fail(`${where}: orderable must be a boolean`);
    oneOf(where, 'coverage', site.coverage, COVERAGES);
    oneOf(where, 'cost', site.cost, COSTS);
    siteIndex.set(site.id, i);
  });

  const stageById = new Map();
  const stageIndex = new Map();
  let lastSite = -1;
  schema.stages.forEach((stage, i) => {
    const where = `stage ${stage?.id ?? '?'}`;
    if (typeof stage?.id !== 'string' || stage.id === '') fail(`${where}: id required`);
    if (stageById.has(stage.id)) fail(`${where}: duplicate id`);
    if (!siteIndex.has(stage.site)) fail(`${where}: unknown site ${stage.site}`);
    const site = siteIndex.get(stage.site);
    if (site < lastSite) fail(`${where}: out of site order`);
    lastSite = site;
    oneOf(where, 'scope', stage.scope, SCOPES);
    strings(where, 'owns', stage.owns);
    strings(where, 'reads', stage.reads);
    strings(where, 'responses', stage.responses);
    if (typeof stage.animated !== 'boolean') fail(`${where}: animated must be a boolean`);
    if (stage.optic !== undefined) {
      if (typeof stage.optic?.name !== 'string' || typeof stage.optic?.hook !== 'string') fail(`${where}: optic needs name and hook`);
      oneOf(where, 'optic.program', stage.optic.program, PROGRAMS);
    }
    if (stage.selector !== undefined) {
      if (typeof stage.selector?.param !== 'string' || typeof stage.selector?.variant !== 'string') fail(`${where}: selector needs param and variant`);
    }
    stageById.set(stage.id, stage);
    stageIndex.set(stage.id, i);
  });

  for (const edge of schema.interactions) {
    const where = `interaction ${edge?.kind} ${edge?.from} -> ${edge?.on}`;
    oneOf(where, 'kind', edge?.kind, KINDS);
    for (const end of [edge.from, edge.on]) {
      if (!stageById.has(end)) fail(`${where}: unknown stage ${end}`);
    }
    if (edge.from === edge.on) fail(`${where}: source and target must differ`);
    if (typeof edge.why !== 'string' || edge.why === '') fail(`${where}: why required`);
  }

  return { ...schema, siteIndex, stageById, stageIndex };
}
