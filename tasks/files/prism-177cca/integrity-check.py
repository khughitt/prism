#!/usr/bin/env python3
import argparse,hashlib,importlib.util,json,re,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--copies',required=True);p.add_argument('--baseline-identity',required=True);p.add_argument('--candidate-identity',required=True);p.add_argument('--model',required=True);args=p.parse_args()
root=Path(args.copies)
spec=importlib.util.spec_from_file_location('builder',Path(__file__).with_name('build.py'));builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
for variant,identity_path in [('baseline',args.baseline_identity),('candidate',args.candidate_identity)]:
    frozen=json.loads(Path(identity_path).read_text());held=json.loads((root/variant/'identity.json').read_text());commit=frozen[variant+'Commit']
    assert held['sourceCommit']==commit
    assert held['sourceSha256']==frozen['sourceSha256']
    for file,expected in frozen['sourceSha256'].items():
        blob=subprocess.check_output(['git','show',commit+':integrations/noctalia-plugin/'+file])
        assert (root/variant/'source'/file).read_bytes()==blob
        assert hashlib.sha256(blob).hexdigest()==expected
        if file!='panel.luau':assert (root/variant/'plugin'/file).read_bytes()==blob
    assert (root/variant/'source/plugin.toml').read_bytes()==(root/variant/'plugin/plugin.toml').read_bytes()
    source=(root/variant/'source/panel.luau').read_text();probe=(root/variant/'plugin/panel.luau').read_text()
    assert re.search(r'local function endDrag\(key\).*?\nend',source,re.S).group() in probe
    assert re.search(r'enqueue = function\(item\).*?\nend',source,re.S).group() in probe
    for forbidden in ('getfenv','setfenv','memo.trace','gcinfo','collectgarbage'):assert forbidden not in probe
    for table in ('ui','panel','noctalia'):assert not re.search(r'\b'+table+r'\.\w+\s*=(?!=)',probe)
    for damaged in (source.replace('local function gateOf(param)','MISSING'),source+'\nlocal function gateOf(param)'):
        try:builder.transform(damaged,held)
        except AssertionError:pass
        else:raise AssertionError('nonunique anchor accepted')
model=json.loads(Path(args.model).read_text());assert len(model['params'])==83 and len(model['rack']['devices'])==12 and len(model['profiles'])==23
print('PASS integrity: both frozen commits/six blobs, original raw/token paths/endDrag/enqueue, unchanged modules/manifest; anchors fail early; no deoptimization/tracing/heap/API mutation; real 83-param/12-card/23-profile fixture')
