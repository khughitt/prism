#!/usr/bin/env python3
"""Read only a frozen read-only launch-comparison log."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import statistics

TIMING = re.compile(r'prism-diagnostic (\d+) callback=(\d+) (\w+) ([\d.]+) ms NOT acceptance data$')
STATE = re.compile(r'prism-launch-state (\d+) comparison=(\d+) callback=(\d+) phase=(\w+) inFlight=(true|false) sameModel=(true|false) sameEnqueued=(true|false) NOT acceptance data$')
RENDER = ('renderTop', 'renderPresentation', 'renderAssembly', 'panelRenderNative', 'renderTotal')
INVALIDATING = {'describe', 'writeCompletion', 'dragEnd', 'enqueueTotal', 'runTotal', 'runAsyncNative', 'renderTotal', 'panelRenderNative', 'coldRender', 'dragTick', 'key', 'open'}


def stats(values):
    return {'n': len(values), 'median_ms': statistics.median(values) if values else None,
            'max_ms': max(values) if values else None, 'values_ms': values}


def analyze(text, run):
    timings, callbacks, comparisons = [], {}, {}
    for line_number, line in enumerate(text.splitlines(), 1):
        match = TIMING.search(line)
        timestamp = line[:23] if re.match(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}', line) else None
        if match and match[1] == run:
            row = {'callback': int(match[2]), 'span': match[3], 'ms': float(match[4]), 'line': line_number, 'timestamp': timestamp}
            timings.append(row)
            callbacks.setdefault(row['callback'], []).append(row)
            continue
        match = STATE.search(line)
        if match and match[1] == run:
            number, callback, phase = int(match[2]), int(match[3]), match[4]
            phases = comparisons.setdefault(number, {})
            if phase in phases or callback <= 0:
                raise ValueError(f'duplicate phase or nonpositive comparison callback at line {line_number}')
            phases[phase] = {'callback': callback, 'line': line_number, 'timestamp': timestamp,
                             'inFlight': match[5] == 'true', 'sameModel': match[6] == 'true', 'sameEnqueued': match[7] == 'true'}
            continue
        if ('prism-launch-state' in line or 'prism-diagnostic ' in line) and not (TIMING.search(line) or STATE.search(line)):
            raise ValueError(f'malformed record at line {line_number}')
    if not comparisons:
        raise ValueError('no comparison metadata for selected run')

    def single(callback, span):
        rows = [row for row in callbacks.get(callback, []) if row['span'] == span]
        if len(rows) != 1:
            raise ValueError(f'callback {callback}: expected one {span}, got {len(rows)}')
        return rows[0]

    def render(callback, outer):
        rows = [single(callback, span) for span in RENDER]
        if [row['line'] for row in rows] != sorted(row['line'] for row in rows):
            raise ValueError('render phase/native/total order mismatch')
        m = {name: row['ms'] for name, row in zip(('top', 'presentation', 'assembly', 'native', 'total'), rows)}
        m['render_span'] = single(callback, outer)['ms']
        m['residual'] = m['total'] - m['native']
        m['render_gap'] = m['residual'] - m['top'] - m['presentation'] - m['assembly']
        m['span_gap'] = m['render_span'] - m['total']
        return {'callback': callback, 'metrics_ms': m, 'first_line': rows[0]['line'], 'last_line': single(callback, outer)['line']}

    def spacing(left, right):
        if left['timestamp'] is None or right['timestamp'] is None:
            return None
        return (datetime.fromisoformat(right['timestamp']) - datetime.fromisoformat(left['timestamp'])).total_seconds() * 1000

    pairs = []
    for number, phases in sorted(comparisons.items()):
        frame_labels = [name for name in phases if name in ('warmWhileCommand', 'warmAfterCommand')]
        if len(frame_labels) != 1 or set(phases) != {'warmBeforeLaunch', 'launchButton', 'comparisonCompletion', frame_labels[0]}:
            raise ValueError(f'comparison {number}: incomplete phase set')
        frame_label = frame_labels[0]
        before, launch, frame, completion = [phases[name] for name in ('warmBeforeLaunch', 'launchButton', frame_label, 'comparisonCompletion')]
        if before['callback'] != launch['callback']:
            raise ValueError('prelaunch and launch callback ids differ')
        initial = render(before['callback'], 'warmBeforeLaunch')
        next_render = render(frame['callback'], frame_label)
        async_row = single(launch['callback'], 'runAsyncNative')
        run_row = single(launch['callback'], 'runTotal')
        launch_row = single(launch['callback'], 'launchButton')
        complete_row = single(completion['callback'], 'comparisonCompletion')
        if not initial['last_line'] < before['line'] < async_row['line'] < run_row['line'] < launch_row['line'] < launch['line'] < next_render['first_line'] < frame['line']:
            raise ValueError('prelaunch/launch/frame log order differs from source')
        if complete_row['line'] >= completion['line']:
            raise ValueError('completion metadata precedes completion timer')
        after_frame = frame['line'] < complete_row['line']
        if (frame_label == 'warmWhileCommand') != after_frame:
            raise ValueError('inflight frame/completion ordering contradicts label')
        interference = [row for row in timings if launch['line'] < row['line'] < next_render['first_line'] and row['span'] in INVALIDATING]
        frame_to_completion = [row for row in timings if frame['line'] < row['line'] < complete_row['line'] and row['callback'] != completion['callback']]
        invariants = all(state['sameModel'] and state['sameEnqueued'] for state in phases.values())
        flags = not before['inFlight'] and launch['inFlight'] and frame['inFlight'] == (frame_label == 'warmWhileCommand') and not completion['inFlight']
        launch_metrics = {'run_native': async_row['ms'], 'run_total': run_row['ms'], 'run_residual': run_row['ms'] - async_row['ms'],
                          'launch_outer': launch_row['ms'], 'launch_outer_minus_render': launch_row['ms'] - initial['metrics_ms']['total'],
                          'completion_callback': complete_row['ms']}
        pairs.append({'comparison': number, 'frame_label': frame_label, 'before': initial, 'frame': next_render,
                      'metadata': phases, 'valid': invariants and flags and not interference, 'invariants_valid': invariants, 'flags_valid': flags,
                      'interference_before_frame': interference, 'other_work_after_frame_before_completion': frame_to_completion,
                      'launch_metrics_ms': launch_metrics,
                      'frame_minus_before_ms': {name: next_render['metrics_ms'][name] - value for name, value in initial['metrics_ms'].items()},
                      'logged_spacing_ms': {'launch_to_frame': spacing(launch, frame), 'launch_to_completion': spacing(launch, completion), 'frame_to_completion': spacing(frame, completion)}})
    valid = [pair for pair in pairs if pair['valid']]
    metric_names = list(pairs[0]['before']['metrics_ms'])
    summary = {side: {name: stats([pair[side]['metrics_ms'][name] for pair in valid]) for name in metric_names} for side in ('before', 'frame')}
    summary['launch'] = {name: stats([pair['launch_metrics_ms'][name] for pair in valid]) for name in pairs[0]['launch_metrics_ms']}
    summary['paired_frame_minus_before'] = {name: stats([pair['frame_minus_before_ms'][name] for pair in valid]) for name in metric_names}
    summary['logged_spacing'] = {name: stats([pair['logged_spacing_ms'][name] for pair in valid if pair['logged_spacing_ms'][name] is not None]) for name in pairs[0]['logged_spacing_ms']}
    return {'run': run, 'candidate_comparisons': len(pairs), 'valid_comparisons': len(valid), 'warmWhileCommand_count': sum(pair['frame_label'] == 'warmWhileCommand' for pair in pairs),
            'warmAfterCommand_count': sum(pair['frame_label'] == 'warmAfterCommand' for pair in pairs),
            'budget_error_lines': text.count('exceeded its CPU budget'), 'error_level_lines': len(re.findall(r'\[(?:ERR|ERROR)\]', text)),
            'pairs': pairs, 'summaries': summary, 'acceptance_applied': False,
            'metric': 'Luau os.clock elapsed ms, upper bound on thread CPU; diagnostic only',
            'limits': ['Callback pending is not OS process life.', 'Logged timestamp spacing is not process duration or CPU.',
                       'sameModel checks table identity, not deep values; sameEnqueued checks cumulative production enqueues.',
                       'Native/render residual and gaps use matching samples; observer overhead, GC/scheduling/native causes not separated.']}


def self_check():
    def timing(cb, span, ms):
        return f'prism-diagnostic 9 callback={cb} {span} {ms:.3f} ms NOT acceptance data'
    def metadata(cb, phase, inflight, same='true'):
        return f'prism-launch-state 9 comparison=1 callback={cb} phase={phase} inFlight={inflight} sameModel={same} sameEnqueued=true NOT acceptance data'
    rows = [timing(1, span, ms) for span, ms in zip(RENDER + ('warmBeforeLaunch',), (1, .5, 4, 2, 8, 8.01))]
    rows += [metadata(1, 'warmBeforeLaunch', 'false'), timing(1, 'runAsyncNative', .1), timing(1, 'runTotal', .2), timing(1, 'launchButton', 8.25), metadata(1, 'launchButton', 'true')]
    rows += [timing(2, span, ms) for span, ms in zip(RENDER + ('warmWhileCommand',), (1, .5, 3, 2, 7, 7.01))]
    rows += [metadata(2, 'warmWhileCommand', 'true'), timing(3, 'comparisonCompletion', .005), metadata(3, 'comparisonCompletion', 'false')]
    fixture = '\n'.join(rows)
    result = analyze(fixture, '9')
    assert result['valid_comparisons'] == 1
    assert result['pairs'][0]['before']['metrics_ms']['residual'] == 6
    assert result['pairs'][0]['before']['metrics_ms']['render_gap'] == .5
    assert result['summaries']['paired_frame_minus_before']['total']['median_ms'] == -1
    assert not analyze(fixture.replace('phase=warmWhileCommand inFlight=true sameModel=true', 'phase=warmWhileCommand inFlight=true sameModel=false'), '9')['pairs'][0]['valid']
    interrupted = fixture.replace(timing(2, 'renderTop', 1), timing(0, 'describe', .01) + '\n' + timing(2, 'renderTop', 1))
    assert not analyze(interrupted, '9')['pairs'][0]['valid']
    try:
        analyze(fixture.replace(timing(2, 'renderTop', 1) + '\n', ''), '9')
    except ValueError:
        pass
    else:
        raise AssertionError('incomplete render phase accepted')
    print('PASS: comparison-id pairing, source/log order, flags/invariants, interference including callback0, complete phases, residual/gaps and stats.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', nargs='?', type=Path)
    parser.add_argument('--run', default='1791733401')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        self_check()
    else:
        if args.log is None:
            parser.error('provide a frozen log')
        try:
            result = analyze(args.log.read_text(), args.run)
        except (ValueError, OSError) as error:
            parser.error(str(error))
        rendered = json.dumps(result, indent=2) + '\n'
        if args.output:
            args.output.write_text(rendered)
        else:
            print(rendered, end='')
