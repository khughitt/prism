#!/usr/bin/env python3
"""Analyze one explicitly frozen warm-comparison diagnostic log."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import statistics

ROW = re.compile(r'prism-diagnostic (\d+) callback=(\d+) (\w+) ([\d.]+) ms NOT acceptance data$')
REQUIRED = ('renderTop', 'renderPresentation', 'renderAssembly', 'panelRenderNative', 'renderTotal')
INVALIDATING = {'describe', 'writeCompletion', 'dragEnd', 'enqueueTotal', 'runTotal', 'runAsyncNative',
                'renderTotal', 'panelRenderNative', 'renderTop', 'renderPresentation', 'renderAssembly',
                'coldRender', 'dragTick', 'warmButton', 'key', 'open'}
METRICS = ('callback', 'total', 'top', 'presentation', 'assembly', 'native', 'residual', 'render_gap', 'callback_gap')


def stats(values):
    return {'n': len(values), 'median_ms': statistics.median(values) if values else None,
            'max_ms': max(values) if values else None, 'values_ms': values}


def parse(text, run):
    records, callbacks = [], {}
    for line_number, line in enumerate(text.splitlines(), 1):
        match = ROW.search(line)
        if not match:
            if 'prism-diagnostic ' in line:
                raise ValueError(f'malformed record at line {line_number}')
            continue
        if match[1] != run:
            continue
        event = {'callback': int(match[2]), 'span': match[3], 'ms': float(match[4]), 'line': line_number,
                 'timestamp': line[:23] if re.match(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}', line) else None}
        records.append(event)
        if event['callback'] > 0:
            callbacks.setdefault(event['callback'], []).append(event)
    if not records:
        raise ValueError('selected run has no timing records')
    groups = []
    for callback_id, events in callbacks.items():
        labels = [event['span'] for event in events if event['span'] in ('warmButton', 'warmFrame')]
        if not labels:
            continue
        if len(labels) != 1:
            raise ValueError(f'callback {callback_id} has duplicate warm labels')
        label = labels[0]
        allowed = set(REQUIRED) | {label}
        values = {}
        for span in REQUIRED + (label,):
            matching = [event['ms'] for event in events if event['span'] == span]
            if len(matching) != 1:
                raise ValueError(f'callback {callback_id}: expected one {span}, got {len(matching)}')
            values[span] = matching[0]
        if [event['span'] for event in events if event['span'] in allowed] != list(REQUIRED) + [label]:
            raise ValueError(f'callback {callback_id}: coarse/native/total order differs')
        metrics = {'callback': values[label], 'total': values['renderTotal'], 'top': values['renderTop'],
                   'presentation': values['renderPresentation'], 'assembly': values['renderAssembly'],
                   'native': values['panelRenderNative'],
                   'residual': values['renderTotal'] - values['panelRenderNative'],
                   'render_gap': values['renderTotal'] - sum(values[span] for span in REQUIRED[:-1]),
                   'callback_gap': values[label] - values['renderTotal']}
        groups.append({'callback_id': callback_id, 'label': label, 'first_line': events[0]['line'],
                       'last_line': events[-1]['line'], 'completion_log_timestamp': events[-1]['timestamp'],
                       'extra_spans': [event for event in events if event['span'] not in allowed], 'metrics_ms': metrics})
    groups.sort(key=lambda group: group['first_line'])
    pairs, unmatched = [], []
    for index, button in enumerate(groups):
        if button['label'] != 'warmButton':
            continue
        following = groups[index + 1] if index + 1 < len(groups) else None
        if following is None or following['label'] != 'warmFrame':
            unmatched.append(button['callback_id'])
            continue
        intervening = [event for event in records if button['last_line'] < event['line'] < following['first_line']]
        blockers = [event for event in intervening if event['span'] in INVALIDATING]
        blockers += button['extra_spans'] + following['extra_spans']
        spacing = None
        if button['completion_log_timestamp'] and following['completion_log_timestamp']:
            spacing = (datetime.fromisoformat(following['completion_log_timestamp']) - datetime.fromisoformat(button['completion_log_timestamp'])).total_seconds() * 1000
        pairs.append({'pair_index': len(pairs) + 1, 'button': button, 'frame': following,
                      'strict_unchanged_candidate': not blockers, 'blockers': blockers,
                      'intervening_records': intervening, 'logged_completion_spacing_ms': spacing,
                      'frame_minus_button_ms': {metric: following['metrics_ms'][metric] - button['metrics_ms'][metric] for metric in METRICS}})
    valid = [pair for pair in pairs if pair['strict_unchanged_candidate']]
    summaries = {}
    for scope, selected in [('all_raw_callbacks', groups), ('strict_pairs', [side for pair in valid for side in (pair['button'], pair['frame'])])]:
        summaries[scope] = {label: {metric: stats([group['metrics_ms'][metric] for group in selected if group['label'] == label]) for metric in METRICS} for label in ('warmButton', 'warmFrame')}
    summaries['strict_paired_frame_minus_button'] = {metric: stats([pair['frame_minus_button_ms'][metric] for pair in valid]) for metric in METRICS}
    paired_frames = {pair['frame']['callback_id'] for pair in pairs}
    return {'run': run, 'metric': 'Luau os.clock elapsed ms; upper bound on thread CPU; diagnostic only',
            'budget_error_lines_in_frozen_file': text.count('exceeded its CPU budget'),
            'raw_warm_callbacks': len(groups), 'candidate_pairs': len(pairs), 'strict_pair_count': len(valid),
            'unmatched_buttons': unmatched, 'unmatched_frames': [group['callback_id'] for group in groups if group['label'] == 'warmFrame' and group['callback_id'] not in paired_frames],
            'pairs': pairs, 'summaries': summaries,
            'definitions': {'residual': 'renderTotal minus native in same callback',
                            'render_gap': 'renderTotal minus top, presentation, assembly and native in same callback',
                            'callback_gap': 'outer callback minus renderTotal in same callback',
                            'strict_pair': 'complete adjacent warm groups without logged describe/write/launch/render/key/open interference; actual live identity not proven',
                            'completion_spacing': 'outer log timestamp spacing, not measured scheduler or execution latency'},
            'acceptance_applied': False}


def self_check():
    def group(callback, label, total=8):
        values = [1, 0.5, 4, 2, total, total + 0.03]
        return '\n'.join(f'prism-diagnostic 7 callback={callback} {span} {value:.3f} ms NOT acceptance data' for span, value in zip(REQUIRED + (label,), values))
    fixture = '\n'.join([group(1, 'warmButton'), group(2, 'warmFrame', 9), group(3, 'warmButton'),
                          'prism-diagnostic 7 callback=0 describe 0.010 ms NOT acceptance data', group(4, 'warmFrame')])
    result = parse(fixture, '7')
    assert result['candidate_pairs'] == 2 and result['strict_pair_count'] == 1
    assert result['pairs'][1]['blockers'][0]['callback'] == 0
    assert result['pairs'][0]['button']['metrics_ms']['residual'] == 6
    assert result['pairs'][0]['button']['metrics_ms']['render_gap'] == 0.5
    assert abs(result['pairs'][0]['button']['metrics_ms']['callback_gap'] - 0.03) < 1e-9
    assert result['summaries']['strict_pairs']['warmFrame']['callback']['n'] == 1
    assert result['summaries']['strict_paired_frame_minus_button']['total']['median_ms'] == 1
    for invalid in [fixture.replace('callback=1 renderTop', 'callback=0 renderTop', 1), fixture + '\nprism-diagnostic malformed']:
        try:
            parse(invalid, '7')
        except ValueError:
            pass
        else:
            raise AssertionError('invalid fixture accepted')
    assert parse(group(1, 'warmButton'), '7')['unmatched_buttons'] == [1]
    print('PASS: complete span/order checks, pairing, interference including callback0, residual/gaps, stats, unmatched and malformed cases.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', nargs='?', type=Path)
    parser.add_argument('--run', default='1791731787')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        self_check()
    else:
        if args.log is None:
            parser.error('provide an explicitly frozen log or --self-check')
        try:
            result = parse(args.log.read_text(), args.run)
        except (ValueError, OSError) as error:
            parser.error(str(error))
        rendered = json.dumps(result, indent=2) + '\n'
        if args.output:
            args.output.write_text(rendered)
        else:
            print(rendered, end='')
