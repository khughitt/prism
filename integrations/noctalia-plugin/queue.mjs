// Import-free for QML and node. QV4 cannot parse object spread.
export function newQueue() {
  return { inFlight: null, pending: [] };
}

function isSample(item) {
  return item !== null && item !== undefined
    && item.verb === 'set' && item.sample === true;
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
  if (item.verb === 'unset') return ['prism', 'unset', item.key];
  return ['prism', 'set', item.key, String(item.value)];
}
