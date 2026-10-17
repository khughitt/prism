#!/usr/bin/env python3
"""Bounded standalone measurement; reads production files and a saved model only."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
from urllib.parse import unquote


def literal(value):
    if value is None:
        return 'nil'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        assert math.isfinite(value)
        return repr(value)
    if isinstance(value, str):
        escaped = ''.join('\\\\' if ch == '\\' else '\\"' if ch == '"' else f'\\{ord(ch):03d}' if ord(ch) < 32 else ch for ch in value)
        return '"' + escaped + '"'
    if isinstance(value, list):
        return '{' + ','.join(literal(held) for held in value) + '}'
    return '{' + ','.join('[' + literal(key) + ']=' + literal(held) for key, held in value.items() if held is not None) + '}'


def leaves(value, path=''):
    if isinstance(value, dict):
        return {key: held for name, item in value.items() if item is not None for key, held in leaves(item, path + '/' + name).items()}
    if isinstance(value, list):
        return {key: held for index, item in enumerate(value, 1) if item is not None for key, held in leaves(item, path + '/' + str(index)).items()}
    return {path: value}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plugin_dir', type=Path)
    parser.add_argument('saved_model', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    model = json.loads(args.saved_model.read_text())
    expected = leaves(model)
    assert len(model['params']) == len({param['key'] for param in model['params']})
    (root / 'model.lua').write_text('return ' + literal(model) + '\n')
    (root / 'expected-keys.lua').write_text('return ' + literal([param['key'] for param in model['params']]) + '\n')
    shape_checks = []
    def shape(value, expression='snapshot'):
        if isinstance(value, (list, dict)):
            shape_checks.append('assert(type(' + expression + ') == "table")')
            if isinstance(value, list):
                shape_checks.append('assert(#' + expression + ' == ' + str(len(value)) + ')')
                for index, held in enumerate(value, 1):
                    shape(held, expression + '[' + str(index) + ']')
            else:
                for key, held in value.items():
                    if held is not None:
                        shape(held, expression + '[' + literal(key) + ']')
    shape(model)
    (root / 'assert-shapes.lua').write_text('return function(snapshot)\n' + '\n'.join(shape_checks) + '\nend\n')
    command = ['lua5.4', str(root / 'experiment.lua'), str(args.plugin_dir.resolve()), str(root)]
    run = subprocess.run(command, text=True, capture_output=True, timeout=60)
    (root / 'raw-records.tsv').write_text(run.stdout)
    (root / 'stderr.txt').write_text(run.stderr)
    if run.returncode:
        raise SystemExit(f'experiment exited {run.returncode}: {run.stderr}')
    observed, phases, checks = {}, {}, {}
    for line in run.stdout.splitlines():
        row = [unquote(field) for field in line.split('\t')]
        if row[0] == 'LEAF':
            _, path, kind, value = row
            observed[path] = value == 'true' if kind == 'boolean' else float(value) if kind == 'number' else value
            assert kind == ('boolean' if isinstance(expected[path], bool) else 'number' if isinstance(expected[path], (int, float)) else 'string')
        elif row[0] == 'PHASE':
            _, name, calls, renders, misses, launches, decodes, encodes = row
            phases[name] = {'total_calls': int(calls), 'renders': int(renders), 'builder_misses': int(misses),
                            'fake_launches': int(launches), 'fake_decodes': int(decodes), 'fake_encodes': int(encodes),
                            'functions': [], 'rebuilt_ids': []}
        elif row[0] == 'CALL':
            _, name, category, source, definition_line, count, label = row
            phases[name]['functions'].append({'category': category, 'source': source, 'definition_line': int(definition_line), 'calls': int(count), 'label': label})
        elif row[0] == 'MISS':
            _, name, identifier = row
            phases[name]['rebuilt_ids'].append(identifier)
        elif row[0] == 'CHECK':
            _, name, value = row
            checks[name] = int(value)
        else:
            raise ValueError(f'unknown output row: {row}')
    assert observed == expected, 'Lua scalar round-trip differs from source JSON'
    assert checks['param_count'] == len(model['params'])
    assert checks['all_cards_expanded'] == len(model['rack']['devices'])
    for phase in phases.values():
        assert phase['total_calls'] == sum(row['calls'] for row in phase['functions'])
        assert phase['builder_misses'] == len(phase['rebuilt_ids'])
        phase['category_calls'] = {}
        for row in phase['functions']:
            phase['category_calls'][row['category']] = phase['category_calls'].get(row['category'], 0) + row['calls']
        phase['functions'].sort(key=lambda row: (-row['calls'], row['source'], row['definition_line']))
    assert phases['expandedColdRender']['builder_misses'] > 0
    assert 0 < phases['dirtyDragTick']['builder_misses'] < phases['expandedColdRender']['builder_misses']
    assert phases['deferredDescribeRender']['builder_misses'] > 0
    for name in ['steadyWarmRender', 'release', 'writeCompletion', 'changedDescribe']:
        assert phases[name]['builder_misses'] == 0
    assert phases['changedDescribe']['renders'] == 0
    result = {'runtime': 'Lua 5.4 debug.sethook call events, not Luau CPU/elapsed measurements',
              'saved_model_sha256': hashlib.sha256(args.saved_model.read_bytes()).hexdigest(),
              'production_sha256': {name: hashlib.sha256((args.plugin_dir / name).read_bytes()).hexdigest() for name in ['panel.luau', 'presentation.luau', 'retain.luau']},
              'faithful_scalar_leaves_verified': len(expected), 'table_shape_assertions': len(shape_checks), 'checks': checks, 'phases': phases,
              'acceptance_applied': False}
    (root / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'Experiment passed: {len(expected)} typed scalar leaves, {checks["param_count"]} params, {checks["all_cards_expanded"]} expanded cards; {len(phases)} measured phases.')
    for name, phase in phases.items():
        print(name, phase['total_calls'], 'calls;', phase['builder_misses'], 'memo misses;', phase['category_calls'])


if __name__ == '__main__':
    main()
