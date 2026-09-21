import { readLook, writeLook } from './contexts.js';

export function readValues() {
  return readLook(null).values;
}

export function writeValues(values) {
  writeLook(null, { ...readLook(null), values });
}

export function parseCliValue(def, str) {
  const fail = () => {
    throw new Error(`${def.key}: cannot parse ${JSON.stringify(str)} as ${def.type}`);
  };
  switch (def.type) {
    case 'float': {
      const n = Number(str);
      if (!Number.isFinite(n) || str.trim() === '') fail();
      return n;
    }
    case 'int': {
      const n = Number(str);
      if (!Number.isInteger(n) || str.trim() === '') fail();
      return n;
    }
    case 'bool':
      if (str === 'true') return true;
      if (str === 'false') return false;
      fail();
      break;
    case 'color':
      if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(str)) fail();
      return str;
    case 'enum':
      if (!def.values.includes(str)) fail();
      return str;
    case 'list': {
      let value;
      try {
        value = JSON.parse(str);
      } catch {
        fail();
      }
      if (!Array.isArray(value) || value.some((element) => typeof element !== 'string')) fail();
      return value;
    }
    case 'string':
      return str;
    default:
      fail();
  }
}

export function validateValue(def, value) {
  const fail = (message) => { throw new Error(`${def.key}: ${message}`); };
  switch (def.type) {
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('not a number');
      break;
    case 'int':
      if (!Number.isInteger(value)) fail('not an integer');
      break;
    case 'bool':
      if (typeof value !== 'boolean') fail('not a boolean');
      break;
    case 'color':
      if (typeof value !== 'string'
          || !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
        fail('not a #rrggbb[aa] color');
      }
      break;
    case 'enum':
      if (!def.values.includes(value)) fail(`not one of ${def.values.join(', ')}`);
      break;
    case 'list':
      if (!Array.isArray(value)) fail('not a list');
      if (value.some((element) => typeof element !== 'string')) {
        fail('list elements must be strings');
      }
      break;
    case 'string':
      if (typeof value !== 'string') fail('not a string');
      break;
    default:
      fail(`unknown type ${def.type}`);
  }
  if ((def.type === 'float' || def.type === 'int')
      && (value < def.range[0] || value > def.range[1])) {
    fail(`${value} outside range [${def.range[0]}, ${def.range[1]}]`);
  }
}
