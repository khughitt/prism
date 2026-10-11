#!/usr/bin/env python3
import argparse,difflib,hashlib,json,re,subprocess
from pathlib import Path
MODULES=('panel.luau','presentation.luau','retain.luau','queue.luau','shell.luau','widget.luau')
HERE=Path(__file__).resolve().parent

def wrap_inputs(source):
    # Explicit callback value wrappers; no UI constructor or host API mutation.
    token=re.compile(r'--\[\[.*?\]\]|--[^\n]*|\[\[.*?\]\]|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|[^\s]',re.S)
    tokens=list(token.finditer(source)); changes=[]
    for i,t in enumerate(tokens):
        if not re.fullmatch(r'on(?:Click|Change|DragEnd|Submit)',t.group()) or i+1>=len(tokens) or tokens[i+1].group()!='=': continue
        start=tokens[i+2].start(); stack=[]; pending_do=0; j=i+2
        while j<len(tokens):
            word=tokens[j].group()
            if word.startswith('--'): j+=1; continue
            if word in ('function','if','for','while','repeat'):
                stack.append(word)
                if word in ('for','while'): pending_do+=1
            elif word=='do':
                if pending_do: pending_do-=1
                else: stack.append(word)
            elif word in ('end','until'):
                assert stack; stack.pop()
            elif word in ('(','{','['): stack.append(word)
            elif word in (')','}',']'):
                if not stack: break
                stack.pop()
            elif word==',' and not stack: break
            j+=1
        end=tokens[j].start()
        changes.append((start,end,'diagnosticInput('+json.dumps(t.group())+', '+source[start:end].rstrip()+')'))
    pieces=[]; cursor=0; length=0; wrappers=[]
    for start,end,replacement in changes:
        prefix=source[cursor:start]; pieces.append(prefix); length+=len(prefix)
        wrappers.append({'start':length,'before':source[start:end],'after':replacement})
        pieces.append(replacement); length+=len(replacement); cursor=end
    pieces.append(source[cursor:])
    return ''.join(pieces),wrappers

def transform(source,identity):
    edits=[]
    def replace(old,new):
        nonlocal source
        assert source.count(old)==1,(old[:80],source.count(old))
        source=source.replace(old,new,1); edits.append({'before':old,'after':new})
    replace('local function gateOf(param)',(HERE/'probe.lua').read_text().replace('IDENTITY',lua(identity))+'\nlocal function gateOf(param)')
    replace('  return noctalia.runAsync(Shell.command(argv), callback, 10000)', '''  if diagnosticPair~=nil and not diagnosticInternal then diagnosticInterfere('foreign-launch',false) end
  local copied={}; for i,value in ipairs(argv) do copied[i]=value end
  copied[1]=diagnosticIdentity.cli
  local command=Shell.command(copied)
  local started=os.clock()
  local returned=table.pack(noctalia.runAsync(command,callback,10000))
  local elapsed=(os.clock()-started)*1000
  diagnosticEvent('nativeLaunch',elapsed,{scope='nativeLaunch'})
  return table.unpack(returned,1,returned.n)''')
    replace('panel.setNeedsFrameTick(state.drag ~= nil or state.renderPending)', 'panel.setNeedsFrameTick(state.drag ~= nil or state.renderPending or #diagnosticBuffer>0 or diagnosticSequence~=nil or (diagnosticPair~=nil and not diagnosticPair.frameDone))')
    replace('    state.structure = structure','''    state.structure = structure
    diagnosticAccepted=true; diagnosticOutcome='accepted'; diagnosticAcceptGeneration=diagnosticAcceptGeneration+1
    diagnosticDeferred=diagnosticProfilePending and 'profileRender' or 'deferredRender'
    diagnosticProfilePending=false''')
    replace('    finishRefresh()\n    return\n  end\n  local model, structure',"    diagnosticOutcome='unchanged'\n    finishRefresh()\n    return\n  end\n  local model, structure")
    replace('  if message then state.errorText = message end',"  if message then state.errorText = message; diagnosticOutcome='rejected' end")
    replace('  if invalidated then\n    state.refreshAfterDrag = true',"  if invalidated then\n    diagnosticOutcome='invalidated'\n    state.refreshAfterDrag = true")
    replace('  state.model.active.profile = index ~= 0 and name or nil', "  state.model.active.profile = index ~= 0 and name or nil\n  diagnosticProfileGeneration=diagnosticProfileGeneration+1; diagnosticProfilePending=true")
    replace('  state.focusOrder = {}\n  if state.help then', '''  if not diagnosticHidden and state.model~=nil then
    children[#children+1]=ui.button({text='Sample diagnostics',controlSize='sm',onClick=function() diagnosticStart() end})
  end
  state.focusOrder = {}
  if state.help then''')
    # Forward declaration keeps the button closure pure and local.
    replace('local diagnosticHidden, diagnosticSequence, diagnosticPair = false, nil, nil','local diagnosticHidden, diagnosticSequence, diagnosticPair = false, nil, nil\nlocal diagnosticStart')
    source,wrappers=wrap_inputs(source)
    tail=(HERE/'tail.lua').read_text().replace('local function diagnosticStart()','diagnosticStart=function()')
    source+='\n'+tail
    return source,edits,wrappers

def lua(v):
    if v is None:return 'nil'
    if isinstance(v,bool):return str(v).lower()
    if isinstance(v,(int,float)):return str(v)
    if isinstance(v,str):return json.dumps(v,ensure_ascii=False)
    if isinstance(v,list):return '{'+','.join(map(lua,v))+'}'
    return '{'+','.join('['+lua(k)+']='+lua(x) for k,x in v.items() if x is not None)+'}'

def build(args):
    out=Path(args.output); out.mkdir(parents=True,exist_ok=True)
    manifests=[]; instrumentations=[]
    for variant,revision in [('baseline',args.baseline),('candidate',args.candidate)]:
        commit=subprocess.check_output(['git','rev-parse',revision],text=True).strip()
        d=out/variant; (d/'source').mkdir(parents=True,exist_ok=True); (d/'plugin').mkdir(exist_ok=True)
        sources={f:subprocess.check_output(['git','show',commit+':integrations/noctalia-plugin/'+f]) for f in MODULES}
        hashes={f:hashlib.sha256(b).hexdigest() for f,b in sources.items()}
        identity={'variant':variant,'sourceCommit':commit,'sourceHash':hashes['panel.luau'],'activationNonce':args.nonce+'-'+variant,'block':args.block,'cli':str(Path(args.cli).resolve()),'coldPairs':args.cold_pairs,'launchPairs':args.launch_pairs}
        for f,b in sources.items(): (d/'source'/f).write_bytes(b); (d/'plugin'/f).write_bytes(b)
        manifest=subprocess.check_output(['git','show',commit+':integrations/noctalia-plugin/plugin.toml'])
        (d/'source'/'plugin.toml').write_bytes(manifest); (d/'plugin'/'plugin.toml').write_bytes(manifest)
        source=sources['panel.luau'].decode(); transformed,edits,wrappers=transform(source,identity)
        count=len(wrappers)
        for forbidden in ('getfenv','setfenv','gcinfo','collectgarbage','memo.trace','panel.render =','noctalia.runAsync ='): assert forbidden not in transformed
        original_release=re.search(r'local function endDrag\(key\).*?\nend',source,re.S).group()
        assert original_release in transformed
        (d/'plugin'/'panel.luau').write_text(transformed)
        (d/'identity.json').write_text(json.dumps(identity|{'sourceSha256':hashes},indent=2)+'\n')
        (d/'transform.diff').write_text(''.join(difflib.unified_diff(source.splitlines(True),transformed.splitlines(True),fromfile='source/panel.luau',tofile='plugin/panel.luau')))
        (d/'transform.json').write_text(json.dumps({'edits':edits,'inputWrappers':count,'wrappers':wrappers,'endDragUnchanged':True,'otherModulesUnchanged':True},indent=2)+'\n')
        manifests.append(identity|{'sourceSha256':hashes,'inputWrappers':count})
        tail='\n'+(HERE/'tail.lua').read_text().replace('local function diagnosticStart()','diagnosticStart=function()')
        assert transformed.endswith(tail)
        reversed_source=transformed[:-len(tail)]
        for wrapper in reversed(wrappers):
            start=wrapper['start']; after=wrapper['after']
            assert reversed_source[start:start+len(after)]==after
            reversed_source=reversed_source[:start]+wrapper['before']+reversed_source[start+len(after):]
        for edit in reversed(edits):
            assert reversed_source.count(edit['after'])==1
            reversed_source=reversed_source.replace(edit['after'],edit['before'],1)
        assert reversed_source==source,'reverse transform did not recover exact frozen bytes'
        instrumentations.append([(e['before'],e['after'].replace(lua(identity),'IDENTITY')) for e in edits]+[(w['before'],w['after']) for w in wrappers]+[('appendTail',tail)])
    assert instrumentations[0]==instrumentations[1],'variant instrumentation differs'
    (out/'manifest.json').write_text(json.dumps({'copies':manifests,'identicalInstrumentation':True,'instrumentationSha256':hashlib.sha256(json.dumps(instrumentations[0],sort_keys=True).encode()).hexdigest()},indent=2)+'\n')
    print('PASS builder: six frozen blobs each; identical instrumentation; explicit copied argv; unchanged endDrag/modules')
if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ('baseline','candidate','cli','output','nonce'): p.add_argument('--'+name,required=True)
    p.add_argument('--block',default='pilot'); p.add_argument('--cold-pairs',type=int,choices=(1,5),default=5); p.add_argument('--launch-pairs',type=int,choices=(0,1,5),default=0)
    build(p.parse_args())
