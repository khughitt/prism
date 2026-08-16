// Import-free for QML and node. QV4 cannot parse object spread.
export function newQueue() {
  return { inFlight: null, pending: [] };
}

export function isSample(item) {
  return item !== null && item !== undefined
    && item.verb === 'set' && item.sample === true;
}

export function affectsParams(item) {
  return item.verb === 'set' || item.verb === 'unset';
}

export function shouldRefresh(batchAffectsParams, lastItem) {
  return batchAffectsParams && !isSample(lastItem);
}

export function enqueue(state, item) {
  if (state.inFlight === null) {
    return { state: { inFlight: item, pending: state.pending }, launch: item };
  }

  const pending = state.pending.slice();
  const last = pending.length > 0 ? pending[pending.length - 1] : null;
  if (isSample(item) && isSample(last) && last.key === item.key) {
    pending[pending.length - 1] = item;
  } else {
    pending.push(item);
  }
  return { state: { inFlight: state.inFlight, pending: pending }, launch: null };
}

export function finish(state) {
  if (state.pending.length > 0) {
    const next = state.pending[0];
    return {
      state: { inFlight: next, pending: state.pending.slice(1) },
      launch: next,
      drained: false,
    };
  }
  return { state: newQueue(), launch: null, drained: true };
}

export function argvFor(item) {
  if (item.verb === 'set') return ['prism', 'set', item.key, String(item.value)];
  if (item.verb === 'unset') return ['prism', 'unset', item.key];
  if (item.verb === 'preview-show') return [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass',
    'showPreview', item.output, item.side, String(item.diagnosticBackground),
  ];
  if (item.verb === 'preview-hide') return [
    'qs', '-c', 'niri-glass', 'ipc', 'call', 'prismGlass', 'hidePreview',
  ];
  throw new Error('unknown queue verb: ' + item.verb);
}
