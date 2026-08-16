export function liveCommands(resolved, osWindows) {
  const active = resolved.params['terminal.background.opacity.active'];
  const inactive = resolved.params['terminal.background.opacity.inactive'];
  const commands = [['set-background-opacity', '--all', String(inactive)]];
  const focused = osWindows.find((window) => window.is_focused);
  const windowId = focused?.tabs?.flatMap((tab) => tab.windows ?? [])[0]?.id;
  if (windowId !== undefined) {
    commands.push(['set-background-opacity', '--match', `id:${windowId}`, String(active)]);
  }
  return commands;
}

export function applyLiveOpacity(resolved, kitten) {
  kitten(liveCommands(resolved, [])[0]);
  const osWindows = JSON.parse(kitten(['ls']).toString());
  const activeCommand = liveCommands(resolved, osWindows)[1];
  if (activeCommand) kitten(activeCommand);
}

export function kittySockets(procNetUnix) {
  const sockets = new Set();
  for (const line of procNetUnix.split('\n')) {
    const address = line.trim().split(/\s+/).at(-1);
    if (/^@dotfiles-kitty-\d+$/.test(address)) sockets.add(`unix:${address}`);
  }
  return [...sockets];
}

export function applyToKittySockets(resolved, procNetUnix, kitten, readProcNetUnix) {
  if (typeof readProcNetUnix !== 'function') {
    throw new TypeError('fresh proc-net-unix reader is required');
  }
  const sockets = kittySockets(procNetUnix);
  if (sockets.length === 0) {
    throw new Error('no kitty remote-control sockets found matching unix:@dotfiles-kitty-<pid>');
  }
  let applied = 0;
  for (const socket of sockets) {
    let commandError;
    try {
      applyLiveOpacity(resolved, (args) => {
        try {
          return kitten(socket, args);
        } catch (error) {
          commandError = error;
          throw error;
        }
      });
      applied++;
    } catch (error) {
      if (error !== commandError) throw error;
      if (kittySockets(readProcNetUnix()).includes(socket)) throw error;
    }
  }
  if (applied === 0) {
    throw new Error('every discovered kitty remote-control socket vanished before apply');
  }
}
