#!/usr/bin/env python3
"""Frozen cold/release log analysis; no host access."""
import argparse
import json
from pathlib import Path
import re
import statistics

T = re.compile(r'prism-diagnostic (\d+) callback=(\d+) (\w+) ([\d.]+) ms NOT acceptance data$')
H = re.compile(r'prism-render-heap (\d+) callback=(\d+) beforeKB=([\d.]+) afterKB=([\d.]+) deltaKB=(-?[\d.]+) NOT acceptance data$')
D = re.compile(r'prism-probe-drain (\d+) callback=(\d+) phase=(\w+) queueIdle=(true|false) describeRunning=(true|false) NOT acceptance data$')
DONE = re.compile(r'prism-cold-sequence-done (\d+) callback=(\d+) cases=(\d+) NOT acceptance data$')
PHASES = ('renderTop', 'renderPresentation', 'renderAssembly', 'panelRenderNative', 'renderTotal')


def stats(values, unit='ms'):
    return {'n': len(values), 'median_' + unit: statistics.median(values) if values else None,
            'max_' + unit: max(values) if values else None, 'min_' + unit: min(values) if values else None, 'values_' + unit: values}


def analyze(text, run):
    groups, heap_by_callback, drains, done = {}, {}, [], []
    excluded = 0
    for index, line in enumerate(text.splitlines(), 1):
        match = T.search(line)
        if match and match[1] == run:
            cb = int(match[2])
            if cb == 0:
                excluded += 1
                continue
            groups.setdefault(cb, []).append({'span': match[3], 'ms': float(match[4]), 'line': index})
            continue
        match = H.search(line)
        if match and match[1] == run:
            cb = int(match[2])
            if cb == 0:
                excluded += 1
                continue
            heap_by_callback.setdefault(cb, []).append({'before_KB': float(match[3]), 'after_KB': float(match[4]), 'delta_KB': float(match[5]), 'line': index})
            continue
        match = D.search(line)
        if match and match[1] == run:
            cb = int(match[2])
            if cb <= 0:
                raise ValueError('drain callback must be positive')
            drains.append({'callback': cb, 'phase': match[3], 'queueIdle': match[4] == 'true', 'describeRunning': match[5] == 'true', 'line': index})
            continue
        match = DONE.search(line)
        if match and match[1] == run:
            done.append({'callback': int(match[2]), 'cases': int(match[3]), 'line': index})
            continue
        if any(prefix in line for prefix in ('prism-diagnostic ', 'prism-render-heap ', 'prism-probe-drain ', 'prism-cold-sequence-done ')) and not any(pattern.search(line) for pattern in (T,H,D,DONE)):
            raise ValueError(f'malformed record line {index}')
    if len(done) != 1 or done[0]['cases'] != 5:
        raise ValueError('expected one five-case sequence done marker')

    def one(cb, name):
        records = [row for row in groups[cb] if row['span'] == name]
        if len(records) != 1:
            raise ValueError(f'callback {cb}: {name} count {len(records)}')
        return records[0]

    renders, startup_incomplete_renders = {}, []
    for cb, rows in groups.items():
        totals = [row for row in rows if row['span'] == 'renderTotal']
        if not totals:
            if cb in heap_by_callback:
                raise ValueError('heap without renderTotal')
            continue
        if len(totals) != 1:
            raise ValueError('multiple renders in one callback; do not silently pair')
        if any(not any(row['span'] == name for row in rows) for name in PHASES) and totals[0]['line'] < done[0]['line']:
            startup_incomplete_renders.append(cb)
            continue
        phase_rows = [one(cb, name) for name in PHASES]
        if [r['line'] for r in phase_rows] != sorted(r['line'] for r in phase_rows):
            raise ValueError('phase order mismatch')
        heaps = heap_by_callback.get(cb, [])
        if len(heaps) != 1 or heaps[0]['line'] <= phase_rows[-1]['line']:
            raise ValueError('expected one heap record after render timer')
        heap = heaps[0]
        if abs(heap['delta_KB'] - (heap['after_KB'] - heap['before_KB'])) > .02:
            raise ValueError('heap delta arithmetic mismatch')
        metrics = {name: row['ms'] for name, row in zip(('top','presentation','assembly','native','total'), phase_rows)}
        metrics['residual'] = metrics['total'] - metrics['native']
        metrics['render_gap'] = metrics['residual'] - metrics['top'] - metrics['presentation'] - metrics['assembly']
        renders[cb] = {'callback': cb, 'metrics_ms': metrics, 'heap': heap, 'render_line': phase_rows[-1]['line']}

    sequence = sorted([(cb, one(cb, label)) for cb, rows in groups.items() for label in ('coldSetup','coldRender') if any(row['span'] == label for row in rows)], key=lambda pair: pair[1]['line'])
    if len(sequence) != 10:
        raise ValueError('expected five setup/render pairs')
    cold_pairs = []
    for index in range(0, 10, 2):
        setup_cb, setup = sequence[index]; render_cb, render = sequence[index+1]
        if setup['span'] != 'coldSetup' or render['span'] != 'coldRender' or setup_cb == render_cb:
            raise ValueError('cold setup/render alternation invalid')
        if setup_cb in renders or render_cb not in renders:
            raise ValueError('cold setup renders or cold render lacks render')
        describe = one(setup_cb, 'describe')
        if describe['line'] >= setup['line'] or any(row['span'] == 'describe' for row in groups[render_cb]):
            raise ValueError('cold decode/render overlap')
        cold_pairs.append({'case': index//2+1, 'setup_callback': setup_cb, 'setup_ms': setup['ms'], 'nested_describe_ms': describe['ms'], 'render_callback': render_cb})
    if done[0]['callback'] != sequence[-1][0] or done[0]['line'] <= sequence[-1][1]['line']:
        raise ValueError('done marker not after fifth render')

    classes = {}
    selected = {'coldSetup': [pair['setup_callback'] for pair in cold_pairs],
                'coldRender': [pair['render_callback'] for pair in cold_pairs]}
    idle = 0
    for label,name in [('dragTick','dirtyDrag'),('dragEnd','release'),('writeCompletion','completion'),('describe','changedDescribe'),('describeRender','deferredRender')]:
        ids = []
        for cb, rows in groups.items():
            candidates = [row for row in rows if row['span'] == label and row['line'] > done[0]['line']]
            if not candidates:
                continue
            row = one(cb, label)
            if label in ('dragTick','describeRender','describe') and row['ms'] <= .5:
                idle += 1
                continue
            if label in ('dragTick','describeRender') and cb not in renders:
                raise ValueError('active frame without render')
            if label == 'describe' and any(event['span'] == 'coldSetup' for event in rows):
                continue
            ids.append(cb)
        selected[name] = ids
    source_labels = {'coldSetup':'coldSetup','coldRender':'coldRender','dirtyDrag':'dragTick','release':'dragEnd','completion':'writeCompletion','changedDescribe':'describe','deferredRender':'describeRender'}
    for name, ids in selected.items():
        rows = [one(cb, source_labels[name]) for cb in ids]
        samples = [renders[cb] for cb in ids if cb in renders]
        classes[name] = {'callback_ids': ids, 'callback_elapsed': stats([row['ms'] for row in rows]), 'renders': samples,
                         'render_metrics': {metric: stats([r['metrics_ms'][metric] for r in samples]) for metric in ('top','presentation','assembly','native','total','residual','render_gap')},
                         'heap_metrics': {metric: stats([r['heap'][metric] for r in samples], 'KB') for metric in ('before_KB','after_KB','delta_KB')}}
    return {'run':run,'cold_pairs':cold_pairs,'done':done[0],'classes':classes,'renders':list(renders.values()),'drain_records':drains,
            'last_drain':drains[-1] if drains else None,'callback0_records_excluded':excluded,'idle_records_excluded':idle,'startup_incomplete_render_callbacks_excluded':startup_incomplete_renders,
            'error_level_lines':len(re.findall(r'\[(?:ERR|ERROR)\]',text)),'budget_error_lines':text.count('exceeded its CPU budget'),
            'acceptance_applied':False,'classification':'Post-done describe >0.5ms excludes nested setup/initial callbacks; covers release/revert/other changed responses, not exact causal attribution.',
            'metric':'Luau os.clock elapsed ms; upper bound on thread CPU. gcinfo heap KB; neither delta nor elapsed proves GC/CPU cause.'}


def self_check():
    def timing(cb,span,value):return f'prism-diagnostic 8 callback={cb} {span} {value:.3f} ms NOT acceptance data'
    fixture=[]
    for i in range(5):
        a,b=2*i+1,2*i+2
        fixture += [timing(a,'describe',4), timing(a,'coldSetup',4.1)]
        fixture += [timing(b,span,val) for span,val in zip(PHASES,(1,.5,4,2,8))]
        fixture += [f'prism-render-heap 8 callback={b} beforeKB=200.00 afterKB=100.00 deltaKB=-100.00 NOT acceptance data',timing(b,'coldRender',8.1)]
    fixture += ['prism-cold-sequence-done 8 callback=10 cases=5 NOT acceptance data',timing(0,'renderTotal',999),timing(11,'describe',.01),timing(12,'describe',7),
                'prism-probe-drain 8 callback=12 phase=describe queueIdle=true describeRunning=false NOT acceptance data']
    text='\n'.join(fixture);r=analyze(text,'8')
    assert len(r['cold_pairs'])==5 and r['classes']['coldRender']['callback_elapsed']['n']==5
    assert r['classes']['coldSetup']['renders']==[] and r['classes']['changedDescribe']['callback_ids']==[12]
    assert r['classes']['coldRender']['render_metrics']['residual']['median_ms']==6
    assert r['classes']['coldRender']['heap_metrics']['delta_KB']['median_KB']==-100
    assert r['callback0_records_excluded']==1 and r['last_drain']['queueIdle'] and not r['last_drain']['describeRunning']
    try:analyze(text.replace('cases=5','cases=4'),'8')
    except ValueError:pass
    else:raise AssertionError('bad marker accepted')
    print('PASS: five separate pairs/order, exact phases/heap arithmetic, nested-vs-changed describes, idle/callback0 exclusion, drain and bad-marker rejection.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('log',nargs='?',type=Path);p.add_argument('--run',default='1791735860');p.add_argument('--output',type=Path);p.add_argument('--self-check',action='store_true');a=p.parse_args()
    if a.self_check:self_check()
    else:
        if a.log is None:p.error('provide a frozen log')
        try:r=analyze(a.log.read_text(),a.run)
        except (ValueError,OSError) as e:p.error(str(e))
        data=json.dumps(r,indent=2)+'\n'
        if a.output:a.output.write_text(data)
        else:print(data,end='')
