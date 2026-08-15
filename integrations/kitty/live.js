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
