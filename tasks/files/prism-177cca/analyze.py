#!/usr/bin/env python3
import argparse,json,math
from collections import defaultdict
from pathlib import Path
from statistics import median
CLASSES=('coldRender','dragTick','release','changedDescribe','deferredRender','profileRender')

def spread_limit(values):
    center=median(values)
    return max(1.0,median(abs(x-center) for x in values))

def decide(blocks,budget_errors,correct=True):
    if len(blocks)!=2 or any(len(block.get(v,{}).get(k,[]))<5 for block in blocks for v in ('baseline','candidate') for k in CLASSES):
        return {'comparison':'inconclusive','accepted':False,'return_to_design':True}
    gain=all(median(b['baseline']['coldRender'])-median(b['candidate']['coldRender'])>spread_limit(b['baseline']['coldRender']) for b in blocks)
    regression=any(median(b['candidate'][k])-median(b['baseline'][k])>spread_limit(b['baseline'][k]) for b in blocks for k in CLASSES if k!='coldRender')
    keep=gain and not regression and correct and budget_errors==0
    absolute=all(median(b['candidate'][k])<15.0 if k in ('coldRender','profileRender') else median(b['candidate'][k])<=12.0 for b in blocks for k in CLASSES)
    return {'comparison':'keep' if keep else 'revert','accepted':keep and absolute,'return_to_design':not (keep and absolute)}

def number(value,label):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<0: raise ValueError('invalid '+label)
    return value

def estimate_minutes(pilot):
    seconds=sum(number(pilot[k],k) for k in ('setupSeconds','restoreSeconds','analysisSeconds'))
    activations=pilot['activations']
    if len(activations)!=4: raise ValueError('four measured activations required')
    for activation in activations:
        seconds+=number(activation['reloadExpandSeconds'],'reloadExpandSeconds')
        seconds+=5*number(activation['coldPairSeconds'],'coldPairSeconds')
        seconds+=5*number(activation['releaseRestoreSeconds'],'releaseRestoreSeconds')
        seconds+=3*number(activation['profileRoundTripSeconds'],'profileRoundTripSeconds')
    for key in ('launchPairSeconds','controlPairSeconds'):
        if not pilot[key]: raise ValueError('missing measured '+key)
        seconds+=10*median(number(x,key) for x in pilot[key])
    return math.ceil(seconds*1.25/60)

def read_rotated(segments,offset=0):
    data=b''.join(Path(p).read_bytes() for p in segments)
    if offset<0 or offset>len(Path(segments[0]).read_bytes()): raise ValueError('invalid saved log offset')
    events=[]
    for line in data[offset:].decode().splitlines():
        marker='prism-budget '
        if marker in line:
            payload=line.split(marker,1)[1]
            def unique(pairs):
                out={}
                for k,v in pairs:
                    if k in out: raise ValueError('duplicate JSON field '+k)
                    out[k]=v
                return out
            events.append(json.loads(payload,object_pairs_hook=unique))
    return events

def normalize(events,identities):
    samples=[]; exclusions=[]; seen=set(); callbacks=set(); clocks={}; stamps=defaultdict(list); activated=set()
    expected={i['activationNonce']:i for i in identities}
    for event in events:
        if not isinstance(event,dict): raise ValueError('event must be object')
        nonce=event.get('activationNonce'); identity=expected.get(nonce)
        if not identity: raise ValueError('unknown/stale activation nonce')
        for key in ('variant','sourceCommit','sourceHash','block'):
            if event.get(key)!=identity[key]: raise ValueError('identity mismatch: '+key)
        for key in ('callbackId','recordId'):
            if type(event.get(key)) is not int or event[key]<(0 if key=='callbackId' else 1): raise ValueError('invalid '+key)
        record=(nonce,event['recordId'])
        if record in seen: raise ValueError('duplicate record')
        seen.add(record)
        if event.get('scope')=='callback':
            span=(nonce,event['callbackId'])
            if span in callbacks: raise ValueError('duplicate callback span')
            callbacks.add(span)
        if type(event.get('schema')) is not int or event.get('schema')!=1 or not isinstance(event.get('class'),str) or event.get('scope') not in ('callback','render','nativeLaunch','launchHelper','observer','metadata','activation','interval'): raise ValueError('malformed schema/class/scope')
        for key in ('rendered','accepted','pending','complete','control','diagnosticsHidden'):
            if type(event.get(key)) is not bool: raise ValueError('invalid boolean '+key)
        if not (event.get('pairId') is False or isinstance(event.get('pairId'),str)): raise ValueError('invalid pair id')
        if not (event.get('interference') is False or isinstance(event.get('interference'),str)): raise ValueError('invalid interference')
        number(event.get('elapsedMs'),'elapsedMs'); stamp=number(event.get('timestamp'),'timestamp')
        origin=event.get('clockOrigin')
        if not isinstance(origin,str) or not origin: raise ValueError('missing clock origin')
        if nonce in clocks and clocks[nonce]!=origin: raise ValueError('activation clock changed')
        clocks[nonce]=origin
        stamps[nonce].append((event['recordId'],stamp))
        if event['class']=='activation':
            if nonce in activated: raise ValueError('runtime identity reused')
            if not event['complete']: raise ValueError('incomplete runtime activation')
            for key in ('initialModelEmpty','initialStructureEmpty','initialMemoEmpty','initialDragEmpty','initialQueueEmpty'):
                if event.get(key) is not True: raise ValueError('runtime was not reset: '+key)
            if type(event.get('initialEnqueued')) is not int or event.get('initialEnqueued')!=0: raise ValueError('runtime enqueued not reset')
            activated.add(nonce)
        elif nonce not in activated: raise ValueError('missing fresh-runtime activation record')
        reason=None
        if event['callbackId']==0 and event['scope']!='activation': reason='callback-id-zero'
        elif not event['complete']: reason='incomplete-span'
        elif event['interference']: reason='interference:'+event['interference']
        elif event['class'] in CLASSES:
            if not event['diagnosticsHidden']: reason='diagnostic-control-visible'
            elif event['class']=='changedDescribe' and not event['accepted']: reason='describe-not-accepted'
            elif event['class']!='changedDescribe' and not event['rendered']: reason='no-real-render'
        if reason: exclusions.append({'event':event,'reason':reason})
        else: samples.append(event)
    for clock_records in stamps.values():
        ordered=sorted(clock_records)
        if any(b[1]<a[1] for a,b in zip(ordered,ordered[1:])): raise ValueError('nonmonotonic activation timestamp')
    if activated!=set(expected): raise ValueError('missing activation evidence')
    return {'events':events,'samples':samples,'exclusions':exclusions}

def target_blocks(normalized):
    # Each block/variant has exactly one activation; never pool across blocks or runtimes.
    groups=defaultdict(lambda:defaultdict(dict)); held={}
    for event in normalized['samples']:
        if event['scope']!='callback' or event['class'] not in CLASSES: continue
        block,variant,nonce=event['block'],event['variant'],event['activationNonce']
        key=(block,variant)
        if key in held and held[key]!=nonce: raise ValueError('multiple activations would pool a block')
        held[key]=nonce
        groups[block][variant].setdefault(event['class'],[]).append(event['elapsedMs'])
    return dict(groups)

def pairs(normalized):
    grouped=defaultdict(list)
    for event in normalized['events']:
        if event['pairId']: grouped[(event['activationNonce'],event['block'],event['variant'],event['pairId'])].append(event)
    valid=[]; excluded=[]
    for identity,records in grouped.items():
        immediate=[e for e in records if e['class']=='pairImmediate' and e['scope']=='render']
        frame=[e for e in records if e['class']=='pairFrame' and e['scope']=='render']
        states=[e for e in records if e['class']=='pairFrameState']
        done=[e for e in records if e['class']=='pairDone']
        completion=[e for e in records if e['class']=='comparisonCompletionResult']
        native=[e for e in records if e['scope']=='nativeLaunch']
        helper=[e for e in records if e['scope']=='launchHelper']
        reason=None
        if any(e['interference'] or not e['complete'] or e['callbackId']==0 or not e['diagnosticsHidden'] for e in records): reason='interference-or-incomplete'
        elif len(immediate)!=1 or len(frame)!=1 or len(states)!=1 or len(done)!=1: reason='missing-or-duplicate-pair-span'
        elif done[0].get('valid') is not True: reason='failed-or-malformed-pair'
        elif immediate[0]['callbackId']==frame[0]['callbackId']: reason='frame-shares-callback'
        elif states[0].get('completionState') not in ('pending','done') or states[0]['pending']!=(states[0].get('completionState')=='pending'): reason='invalid-completion-state'
        elif states[0]['completionState']!=done[0].get('completionState'): reason='inconsistent-completion-state'
        elif not immediate[0]['rendered'] or not frame[0]['rendered']: reason='pair-not-rendered'
        elif any(e['control']!=done[0]['control'] for e in records): reason='inconsistent-control'
        elif done[0]['control'] and (native or helper or completion or states[0]['pending']): reason='control-has-command'
        elif not done[0]['control'] and (len(native)!=1 or len(helper)!=1 or len(completion)!=1): reason='missing-launch-or-completion'
        elif not done[0]['control'] and (type(completion[0].get('exitCode')) is not int or completion[0]['exitCode']!=0 or any(completion[0].get(k) is not False for k in ('timedOut','stdoutTruncated','stderrTruncated'))): reason='failed-or-malformed-completion'
        if reason: excluded.append({'identity':identity,'reason':reason,'records':records}); continue
        first,second=immediate[0],frame[0]
        valid.append({'identity':identity,'control':done[0]['control'],'completionState':states[0]['completionState'],
            'immediateSampleId':first['recordId'],'frameSampleId':second['recordId'],
            'immediateMs':first['elapsedMs'],'frameMs':second['elapsedMs'],'differenceMs':first['elapsedMs']-second['elapsedMs']})
    aggregates=[]
    for activation in sorted({p['identity'][:3] for p in valid}):
        for control in (False,True):
            for state in ('pending','done'):
                selected=[p for p in valid if p['identity'][:3]==activation and p['control']==control and p['completionState']==state]
                if selected: aggregates.append({'identity':activation,'control':control,'completionState':state,'count':len(selected),
                    'primary':len(selected)>=5 and (control or sum(p['identity'][:3]==activation and p['control'] for p in valid)>=5),'medianDifferenceMs':median(p['differenceMs'] for p in selected),'maximumDifferenceMs':max(p['differenceMs'] for p in selected)})
    return {'pairs':valid,'exclusions':excluded,'groups':aggregates,'inconclusive':not any(g['primary'] and not g['control'] for g in aggregates)}

def intervals(normalized):
    out=[]
    for event in normalized['samples']:
        if event['scope']!='interval':continue
        start=number(event.get('startTimestamp'),'startTimestamp'); end=number(event.get('endTimestamp'),'endTimestamp')
        if end<start: raise ValueError('negative interval')
        out.append({'activationNonce':event['activationNonce'],'clockOrigin':event['clockOrigin'],'class':event['class'],'pairId':event['pairId'],'seconds':end-start,'startTimestamp':start,'endTimestamp':end})
    return out

def main():
    p=argparse.ArgumentParser(); p.add_argument('--pilot');p.add_argument('--log',action='append');p.add_argument('--offset',type=int,default=0);p.add_argument('--identity',action='append');p.add_argument('--output');p.add_argument('--budget-errors',type=int);p.add_argument('--incorrect',action='store_true');args=p.parse_args()
    if args.pilot: result={'estimateMinutes':estimate_minutes(json.loads(Path(args.pilot).read_text()))}
    else:
        if not args.log or not args.identity or args.budget_errors is None:p.error('--log, --identity and measured --budget-errors required')
        number(args.budget_errors,'budget-errors')
        normalized=normalize(read_rotated(args.log,args.offset),[json.loads(Path(f).read_text()) for f in args.identity])
        blocks=target_blocks(normalized)
        result=normalized|{'blocks':blocks,'verdict':decide(list(blocks.values()),args.budget_errors,not args.incorrect),'launch':pairs(normalized),'intervals':intervals(normalized)}
    text=json.dumps(result,indent=2)+'\n'
    if args.output:Path(args.output).write_text(text)
    else:print(text,end='')
if __name__=='__main__':main()
