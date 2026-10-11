import copy,importlib.util,json,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('analysis',Path(__file__).with_name('analyze.py')); a=importlib.util.module_from_spec(spec); spec.loader.exec_module(a)

def fixture(cold_b=20,cold_c=18,hot_b=8,hot_c=8):
    return [{v:{k:([cold_b if v=='baseline' else cold_c]*5 if k=='coldRender' else [hot_b if v=='baseline' else hot_c]*5) for k in a.CLASSES} for v in ('baseline','candidate')} for _ in range(2)]
def want(blocks,comparison,accepted=False,errors=0,correct=True):
    assert a.decide(blocks,errors,correct)=={'comparison':comparison,'accepted':accepted,'return_to_design':not accepted}
want(fixture(),'keep'); want(fixture(cold_c=19),'revert')
assert a.spread_limit([18,19,20,21,22])==1
assert a.spread_limit([16,18,20,22,24])==2
b=fixture(); b[0]['baseline']['coldRender']=[16,18,20,22,24]; want(b,'revert')
b=fixture(); b[1]['candidate']['coldRender']=[19]*5; want(b,'revert')
want(fixture(hot_c=9),'keep'); want(fixture(hot_c=9.01),'revert')
for key in ('class','variant','block'):
    b=fixture()
    if key=='class': del b[0]['candidate']['release']
    if key=='variant': del b[1]['baseline']
    if key=='block': b.pop()
    want(b,'inconclusive')
want(fixture(), 'revert',errors=1); want(fixture(),'revert',correct=False)
want(fixture(cold_c=15),'keep')
b=fixture(cold_c=14,hot_b=12,hot_c=12); want(b,'keep',True)
b[0]['candidate']['profileRender']=[15]*5; b[0]['baseline']['profileRender']=[15]*5; want(b,'keep')
b=fixture(cold_c=14,hot_b=12,hot_c=12); b[1]['candidate']['release']=[12.1]*5; want(b,'keep')
b=fixture(); b[0]['candidate']['coldRender']=[18,18,18,18,99999]; want(b,'keep')
pilot={'setupSeconds':30,'restoreSeconds':30,'analysisSeconds':30,'activations':[{'reloadExpandSeconds':10,'coldPairSeconds':2,'releaseRestoreSeconds':6,'profileRoundTripSeconds':8} for _ in range(4)],'launchPairSeconds':[2],'controlPairSeconds':[1]}
assert a.estimate_minutes(pilot)==9
for mutation in ('missing','negative','nan','three-activations','empty-launch'):
    bad=copy.deepcopy(pilot)
    if mutation=='missing': del bad['activations'][0]['coldPairSeconds']
    if mutation=='negative': bad['restoreSeconds']=-1
    if mutation=='nan': bad['analysisSeconds']=float('nan')
    if mutation=='three-activations': bad['activations'].pop()
    if mutation=='empty-launch': bad['launchPairSeconds']=[]
    try: a.estimate_minutes(bad)
    except (ValueError,KeyError): pass
    else: raise AssertionError('accepted malformed pilot '+mutation)
print('PASS numeric: strict gain/MAD/regression, missing classes/variants/blocks, budget/correctness, absolute 15/12, block isolation, median outlier; pilot 9-minute fixture and invalid input')
identity={'variant':'baseline','sourceCommit':'frozen','sourceHash':'hash','activationNonce':'new','block':'1'}
def event(record,class_='pairImmediate',scope='render',pair='p1',callback=2,control=False,**extra):
    return identity|{'schema':1,'recordId':record,'clockOrigin':'new-clock','callbackId':callback,'class':class_,'scope':scope,'elapsedMs':4.0,'rendered':True,'accepted':False,'pairId':pair,'pending':False,'interference':False,'timestamp':float(record),'complete':True,'control':control,'diagnosticsHidden':True}|extra
def activation():
    return event(1,'activation','activation',False,0,initialModelEmpty=True,initialStructureEmpty=True,initialMemoEmpty=True,initialEnqueued=0,initialDragEmpty=True,initialQueueEmpty=True)
def pair_events(n,start,state='pending',control=False):
    name=('control' if control else 'launch')+str(n)
    rows=[];record=start
    if not control:
        rows+=[event(record,'nativeLaunch','nativeLaunch',name,2),event(record+1,'launchHelper','launchHelper',name,2)];record+=2
    rows+=[event(record,pair=name,control=control),event(record+1,'pairFrame','render',name,3,control,elapsedMs=1.0),event(record+2,'pairFrameState','metadata',name,3,control,completionState=state,pending=state=='pending')];record+=3
    if not control:
        rows+=[event(record,'comparisonCompletionResult','metadata',name,4,False,exitCode=0,timedOut=False,stdoutTruncated=False,stderrTruncated=False)];record+=1
    rows+=[event(record,'pairDone','metadata',name,4,control,valid=True,completionState=state)]
    return rows
rows=[activation()]
for i in range(5): rows+=pair_events(i,2+i*20);rows+=pair_events(i,12+i*20,'done',True)
normal=a.normalize(rows,[identity]); result=a.pairs(normal)
assert len(result['pairs'])==10 and not result['exclusions'] and not result['inconclusive']
assert all(p['differenceMs']==3 and p['immediateSampleId']!=p['frameSampleId'] for p in result['pairs'])
assert len(result['groups'])==2 and all(g['primary'] for g in result['groups'])
split=copy.deepcopy(rows)
for e in split:
    if not e['control'] and e['pairId'] in ('launch3','launch4') and e['class'] in ('pairFrameState','pairDone'):e['completionState']='done'
assert a.pairs(a.normalize(split,[identity]))['inconclusive']
missing_control=[e for e in rows if not e['control']]
assert a.pairs(a.normalize(missing_control,[identity]))['inconclusive'],'launch-only data lacks matched controls'
for mutation in ('nonce','variant','hash','duplicate','nan','bool-ms','missing-scope','clock-change','backward-clock','not-reset'):
    bad=copy.deepcopy(rows)
    if mutation=='nonce':bad[0]['activationNonce']='old'
    if mutation=='variant':bad[0]['variant']='candidate'
    if mutation=='hash':bad[0]['sourceHash']='wrong'
    if mutation=='duplicate':bad.append(copy.deepcopy(bad[-1]))
    if mutation=='nan':bad[1]['elapsedMs']=float('nan')
    if mutation=='bool-ms':bad[1]['elapsedMs']=True
    if mutation=='missing-scope':del bad[1]['scope']
    if mutation=='clock-change':bad[1]['clockOrigin']='another activation'
    if mutation=='backward-clock':bad[1]['timestamp']=0
    if mutation=='not-reset':bad[0]['initialMemoEmpty']=False
    try:a.normalize(bad,[identity])
    except ValueError:pass
    else:raise AssertionError('malformed event survived '+mutation)
for mutation in ('missing-frame','incomplete','inconsistent-control','interference','same-callback','failed-done','missing-native','malformed-result','inconsistent-state'):
    bad=[activation()]+pair_events(1,2)
    first=next(e for e in bad if e['class']=='pairImmediate');frame=next(e for e in bad if e['class']=='pairFrame')
    state=next(e for e in bad if e['class']=='pairFrameState')
    if mutation=='missing-frame':bad.remove(frame)
    if mutation=='incomplete':first['complete']=False
    if mutation=='inconsistent-control':frame['control']=True
    if mutation=='interference':frame['interference']='focus'
    if mutation=='same-callback':frame['callbackId']=first['callbackId']
    if mutation=='failed-done':bad[-1]['valid']=False
    if mutation=='missing-native':bad.remove(next(e for e in bad if e['class']=='nativeLaunch'))
    if mutation=='malformed-result':next(e for e in bad if e['class']=='comparisonCompletionResult')['timedOut']='false'
    if mutation=='inconsistent-state':state['pending']=False
    result=a.pairs(a.normalize(bad,[identity]));assert not result['pairs'] and len(result['exclusions'])==1
ex=[activation(),event(2,'coldRender','callback',False,0),event(3,'dragTick','callback',False,2,rendered=False),event(4,'changedDescribe','callback',False,3),event(5,'release','callback',False,4,complete=False)]
assert [x['reason'] for x in a.normalize(ex,[identity])['exclusions']]==['callback-id-zero','no-real-render','describe-not-accepted','incomplete-span']
with tempfile.TemporaryDirectory() as temp:
    first=Path(temp)/'first';second=Path(temp)/'second';prefix=b'old ignored log\n'
    stream=('\n'.join('host: prism-budget '+json.dumps(e) for e in rows)+'\n').encode();cut=127
    first.write_bytes(prefix+stream[:cut]);second.write_bytes(stream[cut:])
    assert a.read_rotated([first,second],len(prefix))==rows
    first.write_text('prism-budget {"x":1,"x":2}\n')
    try:a.read_rotated([first])
    except ValueError:pass
    else:raise AssertionError('duplicate JSON keys accepted')
print('PASS parser: fresh identities, duplicate/malformed records, sample exclusions, actual-id subtraction, matched controls, pending/done split, rotated offset including first/final events')
interval_event=event(2,'coldPairInterval','interval',False,2,startTimestamp=1.0,endTimestamp=3.0)
assert a.intervals(a.normalize([activation(),interval_event],[identity]))[0]['seconds']==2.0
for end in (0.5,float('nan')):
    bad=copy.deepcopy(interval_event);bad['endTimestamp']=end
    try:a.intervals(a.normalize([activation(),bad],[identity]))
    except ValueError:pass
    else:raise AssertionError('invalid interval accepted')
callbacks=[activation(),event(2,'coldRender','callback',False,2),event(3,'coldRender','callback',False,2)]
try:a.normalize(callbacks,[identity])
except ValueError:pass
else:raise AssertionError('duplicate callback counted twice')
print('PASS intervals: measured origin-local seconds, negative/nonfinite spans rejected, duplicate callback samples rejected')

visible=[activation(),event(2,'deferredRender','callback',False,2,diagnosticsHidden=False)]
assert [e['reason'] for e in a.normalize(visible,[identity])['exclusions']]==['diagnostic-control-visible'], 'visible diagnostic control entered selected samples'
print('PASS readiness: callbacks with the transient diagnostic control visible are excluded from target samples')
