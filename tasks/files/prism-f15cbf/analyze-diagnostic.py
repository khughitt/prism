#!/usr/bin/env python3
"""Analyze a frozen scratch diagnostic log; never reads host state."""
import argparse
import json
from pathlib import Path
import re
import statistics

TIMING = re.compile(r'prism-diagnostic (\d+) callback=(\d+) (\w+) ([\d.]+) ms NOT acceptance data$')
CACHE = re.compile(r'prism-diagnostic-cache (\d+) callback=(\d+) rebuilt=(\d+) ids=(.*?) NOT acceptance data$')
MARKER = re.compile(r'prism-diagnostic-run (\d+) NOT acceptance data$')


def stats(values):
    return {'n': len(values), 'median_ms': statistics.median(values) if values else None,
            'max_ms': max(values) if values else None, 'values_ms': values}


def analyze(text, selected_run=None):
    events, runs = [], set()
    for line_number, line in enumerate(text.splitlines(), 1):
        marker = MARKER.search(line)
        if marker:
            runs.add(marker[1])
            continue
        match = TIMING.search(line)
        if match:
            run, callback, span, elapsed = match.groups()
            events.append({'run': run, 'callback': int(callback), 'span': span,
                           'ms': float(elapsed), 'line': line_number})
            runs.add(run)
            continue
        match = CACHE.search(line)
        if match:
            run, callback, count, ids_text = match.groups()
            events.append({'run': run, 'callback': int(callback), 'rebuilt': int(count),
                           'ids_text': ids_text, 'line': line_number})
            runs.add(run)
            continue
        if 'prism-diagnostic' in line:
            raise ValueError(f'malformed diagnostic record at line {line_number}')
    if selected_run is None:
        if len(runs) != 1:
            raise ValueError(f'expected one run, found {sorted(runs)}; specify --run')
        selected_run = next(iter(runs))
    if selected_run not in runs:
        raise ValueError(f'run {selected_run} not present')

    callbacks, excluded, warnings = {}, 0, []
    for event in events:
        if event['run'] != selected_run:
            continue
        if event['callback'] == 0:
            excluded += 1
            continue
        callback = callbacks.setdefault(event['callback'], {'timings': [], 'renders': []})
        if 'span' in event:
            callback['timings'].append(event)
            if event['span'] == 'panelRenderNative':
                if 'pending_native' in callback:
                    raise ValueError(f'unpaired native render before line {event["line"]}')
                callback['pending_native'] = event
            elif event['span'] == 'renderTotal':
                native = callback.pop('pending_native', None)
                callback['renders'].append({
                    'callback': event['callback'], 'render_index': len(callback['renders']) + 1,
                    'render_line': event['line'], 'total_ms': event['ms'],
                    'native_ms': native['ms'] if native else None,
                    'residual_ms': event['ms'] - native['ms'] if native else None,
                    'cache_line': None, 'rebuilt_count': None, 'rebuilt_ids_text': None,
                    'rebuilt_ids': None})
        else:
            renders = callback['renders']
            if not renders or renders[-1]['cache_line'] is not None:
                raise ValueError(f'cache record without preceding unmatched renderTotal at line {event["line"]}')
            render = renders[-1]
            tokens = event['ids_text'].split(',') if event['ids_text'] else []
            render.update({'cache_line': event['line'], 'rebuilt_count': event['rebuilt'],
                           'rebuilt_ids_text': event['ids_text'],
                           'rebuilt_ids': tokens if len(tokens) == event['rebuilt'] else None})
            if len(tokens) != event['rebuilt']:
                warnings.append(f'line {event["line"]}: id delimiters ambiguous; retained raw text and authoritative count')

    classes = {name: {'callback_ids': [], 'callback_elapsed_ms': [], 'renders': [], 'spans': {}}
               for name in ('coldRender', 'dirtyDrag', 'dragEnd', 'describeRender', 'writeCompletion')}
    all_renders = []
    idle_drag = 0
    for callback_id, callback in callbacks.items():
        if 'pending_native' in callback:
            warnings.append(f'callback {callback_id}: native render has no following renderTotal')
        for render in callback['renders']:
            if render['native_ms'] is None:
                warnings.append(f'callback {callback_id} render {render["render_index"]}: missing native timing')
            if render['cache_line'] is None:
                warnings.append(f'callback {callback_id} render {render["render_index"]}: missing cache record')
            if render['residual_ms'] is not None and render['residual_ms'] < 0:
                warnings.append(f'callback {callback_id}: negative residual; inspect timer pairing/precision')
        all_renders.extend(callback['renders'])
        for event in callback['timings']:
            span = event['span']
            if span == 'dragTick':
                if event['ms'] <= 0.5:
                    idle_drag += 1
                    continue
                if not callback['renders']:
                    warnings.append(f'callback {callback_id}: dragTick >0.5 ms but no render; excluded from dirtyDrag')
                    continue
                name = 'dirtyDrag'
            elif span == 'describeRender':
                if event['ms'] <= 0.5 or not callback['renders']:
                    continue
                name = span
            elif span in classes:
                name = span
            else:
                continue
            group = classes[name]
            group['callback_ids'].append(callback_id)
            group['callback_elapsed_ms'].append(event['ms'])
            group['renders'].extend(callback['renders'])
            for timing in callback['timings']:
                group['spans'].setdefault(timing['span'], []).append(timing['ms'])

    for group in classes.values():
        group['callback_elapsed'] = stats(group.pop('callback_elapsed_ms'))
        group['spans'] = {name: stats(values) for name, values in group['spans'].items()}
        group['render_total'] = stats([render['total_ms'] for render in group['renders']])
        group['native_render'] = stats([render['native_ms'] for render in group['renders'] if render['native_ms'] is not None])
        group['render_residual'] = stats([render['residual_ms'] for render in group['renders'] if render['residual_ms'] is not None])
    return {'run': selected_run, 'metric': 'Luau os.clock elapsed ms; upper bound on thread CPU; NOT acceptance data',
            'callback_zero_records_excluded': excluded, 'idle_drag_ticks_excluded': idle_drag,
            'budget_error_lines_in_frozen_file': text.count('exceeded its CPU budget'),
            'classes': classes, 'renders': all_renders, 'warnings': warnings,
            'limits': ['Native/render residual samples are per render, callback samples are per callback.',
                       'Residual includes Luau work, instrumentation, GC and scheduling; cause unknown.',
                       'Rebuilt ids are misses, not exact hit counts; retained parents skip children.',
                       'Escaped NUL remains literal \\0; comma-delimited ids can be ambiguous.',
                       'No original Task 6 acceptance decision is made.']}


def self_check():
    def timing(callback, span, ms):
        return f'prefix prism-diagnostic 42 callback={callback} {span} {ms:.3f} ms NOT acceptance data'
    def cache(callback, count, ids):
        return f'prefix prism-diagnostic-cache 42 callback={callback} rebuilt={count} ids={ids} NOT acceptance data'
    fixture = '\n'.join([
        'prefix prism-diagnostic-run 42 NOT acceptance data',
        timing(0, 'renderTotal', 999), cache(0, 1, 'ignore'),
        timing(1, 'panelRenderNative', 2), timing(1, 'renderTotal', 20), cache(1, 2, r'm:group\0row,c:sample'), timing(1, 'coldRender', 20.1),
        timing(2, 'dragTick', 0.005),
        timing(3, 'panelRenderNative', 1), timing(3, 'renderTotal', 6), cache(3, 0, ''), timing(3, 'dragTick', 6.1),
        timing(4, 'enqueueTotal', 0.174), timing(4, 'panelRenderNative', 2.2), timing(4, 'renderTotal', 14.473), cache(4, 1, 'c:release'),
        timing(4, 'panelRenderNative', 1), timing(4, 'renderTotal', 2), cache(4, 0, ''), timing(4, 'dragEnd', 16.7)])
    result = analyze(fixture)
    assert result['callback_zero_records_excluded'] == 2
    assert result['idle_drag_ticks_excluded'] == 1
    assert result['classes']['coldRender']['callback_elapsed']['n'] == 1
    assert result['classes']['dirtyDrag']['callback_elapsed']['median_ms'] == 6.1
    assert result['renders'][0]['rebuilt_ids'] == [r'm:group\0row', 'c:sample']
    assert result['renders'][0]['residual_ms'] == 18
    assert [r['rebuilt_count'] for r in result['classes']['dragEnd']['renders']] == [1, 0]
    assert abs(result['classes']['dragEnd']['renders'][0]['residual_ms'] - 12.273) < 1e-9
    assert result['classes']['dragEnd']['render_total']['n'] == 2
    assert not result['warnings']
    ambiguous = analyze('\n'.join([timing(1, 'panelRenderNative', 1), timing(1, 'renderTotal', 2), cache(1, 1, 'id,with-comma')]))
    assert ambiguous['renders'][0]['rebuilt_ids'] is None and ambiguous['warnings']
    for invalid in [cache(1, 1, 'orphan'), fixture + '\nprism-diagnostic malformed', fixture + '\nprism-diagnostic-run 43 NOT acceptance data']:
        try:
            analyze(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError('invalid fixture accepted')
    print('Self-check passed: pairing/order, multiple renders, escaped NUL, idle/callback0 exclusion, stats, ambiguity and fail-early cases.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', nargs='?', type=Path)
    parser.add_argument('--run')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        self_check()
        return
    if args.log is None:
        parser.error('provide a frozen log path or --self-check')
    try:
        result = analyze(args.log.read_text(), args.run)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    rendered = json.dumps(result, indent=2) + '\n'
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end='')


if __name__ == '__main__':
    main()
