import { stringify } from 'yaml';
import { withLock } from './lock.js';
import { lockPath } from './paths.js';
import {
  VERB_KINDS, assertKind, assertName, listContexts, readActive, readContext, writeContext,
} from './contexts.js';
import { activeName, loadStore } from './layers.js';

function usage(text) {
  return new Error(`usage: prism context ${text}`);
}

function requireContext(kind, name) {
  const context = readContext(kind, name);
  if (context === null) throw new Error(`${kind} ${name}: no such context`);
  return context;
}

function kindAndName(rest, verb) {
  if (rest.length !== 2) throw usage(`${verb} <kind> <name>`);
  const [kind, name] = rest;
  assertKind(kind);
  assertName(name);
  return { kind, name };
}

// Returns a fan-out result, or null when nothing reached the bus.
export async function runContext(args, { defs, manifests, print, runner }) {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'list': {
      if (rest.length !== 0) throw usage('list');
      const { active, all, sources } = await withLock(lockPath(), async () => {
        const listed = listContexts();
        return {
          active: readActive(),
          all: listed,
          sources: Object.fromEntries(listed.wallpaper.map((name) => [name, readContext('wallpaper', name).source])),
        };
      });
      for (const kind of VERB_KINDS) {
        const current = activeName(active, kind);
        for (const name of all[kind]) {
          const marker = name === current ? '*' : ' ';
          const source = kind === 'wallpaper' ? `  ${sources[name]}` : '';
          print(`${marker} ${kind} ${name}${source}\n`);
        }
      }
      if (active.wallpaper && !all.wallpaper.includes(active.wallpaper.id)) {
        print(`* wallpaper ${active.wallpaper.id}  ${active.wallpaper.path} (untuned)\n`);
      }
      return null;
    }

    case 'show': {
      const { kind, name } = kindAndName(rest, 'show');
      const context = await withLock(lockPath(), async () => requireContext(kind, name));
      const doc = kind === 'wallpaper' ? { _source: context.source, ...context.values } : context.values;
      print(stringify(doc));
      return null;
    }

    case 'save': {
      const { kind, name } = kindAndName(rest, 'save');
      await withLock(lockPath(), async () => {
        const source = kind === 'wallpaper' ? requireContext(kind, name).source : null;
        const { params } = loadStore(defs);
        writeContext(kind, name, { source, values: params });
      });
      return null;
    }

    default:
      throw usage('list|show|save|activate|deactivate|delete|wallpaper');
  }
}
