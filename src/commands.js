// The declared surface: every prism command with its arguments and options. cli.js
// resolves argv against this table (globals, help, usage errors, value sets) before
// dispatching, and test/cli-surface.test.js compares it with tools/cli.toml.
const KIND = { name: 'kind', value: 'enum', values: ['profile', 'wallpaper'], required: true };
const NAME = { name: 'name', value: 'string', required: true };
export const COMMANDS = [
  { path: ['set'], summary: 'Set a parameter in the active profile, or the base layer with --base',
    args: [{ name: 'key', value: 'string', required: true }, { name: 'value', value: 'string', required: true }], options: [{ names: ['--base'], value: 'none' }] },
  { path: ['unset'], summary: 'Remove a parameter from the active profile, or the base layer with --base',
    args: [{ name: 'key', value: 'string', required: true }], options: [{ names: ['--base'], value: 'none' }] },
  { path: ['reset'], summary: 'Reset parameters to defaults, symmetric, or neutral values',
    args: [{ name: 'mode', value: 'enum', values: ['defaults', 'symmetric', 'neutral'], required: true }],
    options: [{ names: ['--base'], value: 'none' }, { names: ['--group'], value: 'string' }] },
  { path: ['get'], summary: 'Print one resolved parameter', args: [{ name: 'key', value: 'string', required: true }] },
  { path: ['list'], summary: 'List every resolved parameter' },
  { path: ['describe'], summary: 'The whole resolved state: active wallpaper and profile, profiles, parameters' },
  { path: ['apply'], summary: 'Render the resolved state into every sink, or the named sinks', args: [{ name: 'sink', value: 'string', required: false, variadic: true }] },
  { path: ['requirements'], summary: 'What each sink needs installed' },
  { path: ['doctor'], summary: 'Check the installation and the sinks' },
  { path: ['migrate'], summary: 'Migrate the store to the current layout' },
  { path: ['context'], summary: 'Context slots: the wallpaper and profile the resolved state follows' },
  { path: ['context', 'list'], summary: 'List every saved context and the active slots' },
  { path: ['context', 'show'], summary: 'Show one saved context', args: [KIND, NAME] },
  { path: ['context', 'save'], summary: 'Save the active profile layer under a name', args: [KIND, NAME] },
  { path: ['context', 'activate'], summary: 'Make a saved context the active one for its kind', args: [KIND, NAME] },
  { path: ['context', 'deactivate'], summary: 'Clear the active slot of one kind', args: [KIND] },
  { path: ['context', 'delete'], summary: 'Delete a saved context', args: [KIND, NAME] },
  { path: ['context', 'rename'], summary: 'Rename a saved context', args: [KIND, { name: 'old', value: 'string', required: true }, { name: 'new', value: 'string', required: true }] },
  { path: ['context', 'pin'], summary: 'Pin the wallpaper slot so wallpaper changes do not move it', args: [KIND] },
  { path: ['context', 'unpin'], summary: 'Unpin the wallpaper slot', args: [KIND] },
  { path: ['context', 'wallpaper'], summary: 'Follow this wallpaper: set the wallpaper slot from a path', args: [{ name: 'path', value: 'path', required: true }] },
];

const GLOBAL_FLAGS = new Set(['--json', '--pretty']);
const GLOBAL_VALUED = new Set(['--color']);
const HELP_FLAGS = ['--help', '-h'];
const COLORS = ['auto', 'always', 'never'];
const MODES = ['json', 'pretty'];

export class UsageError extends Error {}

/** Longest command whose path prefixes argv. */
export function findCommand(argv) {
  let best = null;
  for (const cmd of COMMANDS) if (cmd.path.every((p, i) => argv[i] === p) && (!best || cmd.path.length > best.path.length)) best = cmd;
  return best;
}

function children(path) {
  return COMMANDS.filter((c) => c.path.length === path.length + 1 && path.every((p, i) => c.path[i] === p));
}

// `--name=value` splits into the option and its value; anything else is [word, undefined].
function splitLong(word) {
  const eq = word.indexOf('=');
  return word.startsWith('--') && eq > 2 ? [word.slice(0, eq), word.slice(eq + 1)] : [word, undefined];
}

/** Strip the globals from anywhere in argv, resolve the command, validate its
 *  positionals and options against the table. Throws UsageError (exit 2). */
export function parseInvocation(argv, env) {
  let mode = null, color = null, help = false, version = false;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const [a, inline] = splitLong(argv[i]);
    if (GLOBAL_FLAGS.has(a)) { const m = a.slice(2); if (mode && mode !== m) throw new UsageError('--json and --pretty are mutually exclusive'); mode = m; }
    else if (a === '--color') { color = inline ?? argv[++i]; if (!COLORS.includes(color)) throw new UsageError(`--color must be one of ${COLORS.join(', ')}, got ${JSON.stringify(color ?? '')}`); }
    else if (HELP_FLAGS.includes(a)) help = true;
    else if (a === '-V' || a === '--version') version = true;
    else rest.push(argv[i]);
  }
  mode ??= env.PRISM_FORMAT ?? 'pretty';
  if (!MODES.includes(mode)) throw new UsageError(`PRISM_FORMAT must be one of ${MODES.join(', ')}, got ${JSON.stringify(mode)}`);
  color ??= env.PRISM_COLOR ?? 'never';
  if (!COLORS.includes(color)) throw new UsageError(`PRISM_COLOR must be one of ${COLORS.join(', ')}, got ${JSON.stringify(color)}`);
  if (version) return { version: true, mode, color };
  if (rest[0] === 'help') {
    if (rest.length === 1) return { help: null, mode, color };
    const cmd = findCommand(rest.slice(1));
    if (!cmd || cmd.path.length !== rest.length - 1) throw new UsageError(`unknown command ${JSON.stringify(rest.slice(1).join(' '))}`);
    return { help: cmd, mode, color };
  }
  if (rest.length === 0) { if (help) return { help: null, mode, color }; throw new UsageError(`a command is required; run 'prism --help'`); }
  const cmd = findCommand(rest);
  if (!cmd) throw new UsageError(`unknown command ${JSON.stringify(rest.join(' '))}; run 'prism --help'`);
  if (help) return { help: cmd, mode, color };
  const words = rest.slice(cmd.path.length), positionals = [], options = {};
  for (let i = 0; i < words.length; i++) {
    const [w, inline] = splitLong(words[i]);
    if (w.startsWith('--')) {
      const opt = (cmd.options ?? []).find((o) => o.names.includes(w));
      if (!opt) throw new UsageError(`unknown option ${w} for prism ${cmd.path.join(' ')}; ${usage(cmd)}`);
      const name = w.slice(2);
      if (opt.value === 'none') {
        if (inline !== undefined) throw new UsageError(`${w} takes no value`);
        options[name] = true;
        continue;
      }
      options[name] = inline ?? words[++i];
      if (options[name] === undefined) throw new UsageError(`${w} requires a value; ${usage(cmd)}`);
      if (opt.values && !opt.values.includes(options[name])) throw new UsageError(`${w} must be one of ${opt.values.join(', ')}, got ${JSON.stringify(options[name])}`);
    } else positionals.push(words[i]);
  }
  const group = children(cmd.path);
  if (group.length && !(cmd.args ?? []).length) {
    if (positionals.length) throw new UsageError(`unknown command ${JSON.stringify([...cmd.path, positionals[0]].join(' '))}; ${usage(cmd)}`);
    throw new UsageError(`a command is required; ${usage(cmd)}`);
  }
  const args = cmd.args ?? [];
  const min = args.filter((a) => a.required).length, max = args.some((a) => a.variadic) ? Infinity : args.length;
  if (positionals.length < min) throw new UsageError(`missing ${args[positionals.length].name}; ${usage(cmd)}`);
  if (positionals.length > max) throw new UsageError(`unexpected argument ${JSON.stringify(positionals[max])}; ${usage(cmd)}`);
  args.forEach((a, i) => { if (a.values && positionals[i] !== undefined && !a.values.includes(positionals[i])) throw new UsageError(`${a.name} must be one of ${a.values.join(', ')}, got ${JSON.stringify(positionals[i])}`); });
  return { cmd, positionals, options, mode, color };
}

export function usage(cmd) {
  const args = (cmd.args ?? []).map((a) => `${a.required ? '<' : '['}${a.name}${a.variadic ? '...' : ''}${a.required ? '>' : ']'}`);
  const opts = (cmd.options ?? []).map((o) => `[${o.names[0]}${o.value === 'none' ? '' : ` <${o.value}>`}]`);
  const sub = children(cmd.path).length && !args.length ? ['<command>'] : [];
  return `usage: prism ${[...cmd.path, ...opts, ...args, ...sub].join(' ')}`;
}

const spellSet = (values) => (values.length < 3 ? values.join(' or ') : `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`);

export function helpText(cmd) {
  const lines = [usage(cmd), '', `${cmd.summary}.`];
  const sub = children(cmd.path);
  if (cmd.args?.length) lines.push('', 'arguments:', ...cmd.args.map((a) => `  ${a.name.padEnd(10)} ${a.values ? spellSet(a.values) : a.value}`.trimEnd()));
  if (cmd.options?.length) lines.push('', 'options:', ...cmd.options.map((o) => `  ${`${o.names.join(', ')}${o.value === 'none' ? '' : ` <${o.value}>`}`.padEnd(18)} ${o.values ? spellSet(o.values) : ''}${o.default ? ` (default: ${o.default})` : ''}`.trimEnd()));
  if (sub.length) lines.push('', 'commands:', ...sub.map((c) => `  ${c.path.at(-1).padEnd(12)} ${c.summary}`));
  return `${lines.join('\n')}\n`;
}

export function rootHelp() {
  return `${[
    'usage: prism [--json|--pretty] [--color <when>] <command> [args]',
    '',
    'Resolve appearance definitions and apply them to the configured sinks.',
    '',
    'options:',
    '  --json             one JSON value on stdout (also PRISM_FORMAT)',
    '  --pretty           text for a person, the default (also PRISM_FORMAT)',
    `  --color <when>     ${spellSet(COLORS)} (default: never; also PRISM_COLOR)`,
    '  -h, --help         print help',
    '  -V, --version      print the version',
    '',
    'commands:',
    ...COMMANDS.filter((c) => c.path.length === 1).map((c) => `  ${c.path[0].padEnd(13)} ${c.summary}`),
    `  ${'help'.padEnd(13)} Print a command's help`,
    '',
    "Run 'prism <command> --help' for details.",
  ].join('\n')}\n`;
}

const GLOBAL_OPTIONS = [['--json', 'one JSON value on stdout'], ['--pretty', 'text for a person'], ['--color', 'auto, always, or never'], ['--help', 'print help']];

/** Completion candidates for words[index] as [value, description] pairs; globals before
 *  the command are skipped and the result is filtered by the word's prefix. */
export function candidates(words, index) {
  const before = [], word = words[index] ?? '';
  for (let i = 1; i < index; i++) { if (GLOBAL_FLAGS.has(words[i])) continue; if (GLOBAL_VALUED.has(words[i])) { i++; continue; } before.push(words[i]); }
  if (before[0] === 'help') before.shift(); // `help <command>…` completes like the command itself
  const cmd = findCommand(before);
  const depth = cmd ? cmd.path.length : 0;
  const prev = words[index - 1];
  if (prev === '--color') return COLORS.map((v) => [v, '']);
  const optionOf = (w) => (cmd?.options ?? []).find((o) => o.names.includes(w));
  const prevOpt = optionOf(prev);
  if (prevOpt && prevOpt.value !== 'none') return (prevOpt.values ?? []).map((v) => [v, '']);
  if (word.startsWith('-')) return [...(cmd?.options ?? []).flatMap((o) => o.names.map((n) => [n, ''])), ...GLOBAL_OPTIONS];
  const sub = children(cmd ? cmd.path : []);
  if (sub.length) return [...sub.map((c) => [c.path.at(-1), c.summary]), ...(depth === 0 ? [['help', "Print a command's help"]] : [])];
  // The positional being completed is the count of positional words after the command
  // path: option words, and the value a valued option consumed, are not positionals.
  let filled = 0;
  for (let i = depth; i < before.length; i++) {
    const opt = optionOf(before[i]);
    if (!opt) filled++;
    else if (opt.value !== 'none') i++;
  }
  const args = cmd?.args ?? [];
  const positional = args[filled] ?? (args.at(-1)?.variadic ? args.at(-1) : undefined);
  return positional?.values ? positional.values.map((v) => [v, '']) : [];
}

export function candidatesFor(words, index) {
  const word = words[index] ?? '';
  return candidates(words, index).filter(([v]) => v.startsWith(word));
}

// The same template ops's cli_surface.completion_script("prism", shell) renders.
export function completionScript(shell) {
  if (shell === 'zsh') return `#compdef prism\n_prism() {\n  local -a c\n  c=("\${(@f)$(PRISM_COMPLETE=zsh PRISM_COMPLETE_INDEX=$((CURRENT-1)) prism -- "\${words[@]}" 2>/dev/null)}")\n  c=("\${c[@]//$'\\t'/:}")\n  [[ -n $c ]] && _describe 'prism' c\n}\ncompdef _prism prism\n`;
  if (shell === 'bash') return `_prism() {\n  local IFS=$'\\n'\n  COMPREPLY=($(PRISM_COMPLETE=bash PRISM_COMPLETE_INDEX=$COMP_CWORD prism -- "\${COMP_WORDS[@]}" 2>/dev/null | cut -f1))\n}\ncomplete -F _prism prism\n`;
  throw new UsageError(`unknown shell ${JSON.stringify(shell)}`);
}
