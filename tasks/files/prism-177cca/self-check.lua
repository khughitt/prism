local base, modelPath, encoderPath, cli = arg[1], arg[2], arg[3], arg[4]
local model, canonical = dofile(modelPath), dofile(encoderPath)
local function copy(v, ignore)
  if type(v)=='function' and ignore then return '<function>' end
  if type(v)~='table' then return v end
  local out={}; for k,x in pairs(v) do out[k]=copy(x,ignore) end; return out
end
local function nodes(t,out)
  out=out or {}; if type(t)~='table' then return out end
  if t.kind then out[#out+1]=t end
  for _,x in ipairs(t.children or {}) do nodes(x,out) end; return out
end
local function up(fn,want,seen)
  seen=seen or {}; if seen[fn] then return end; seen[fn]=true
  for i=1,100 do local n,v=debug.getupvalue(fn,i); if not n then break end
    if n==want then return v end
    if type(v)=='function' then local x=up(v,want,seen); if x~=nil then return x end end
  end
end
local success={exitCode=0,timedOut=false,stdout='same fixture',stderr='',stdoutTruncated=false,stderrTruncated=false}
local function jsonRecord(value)
  if type(value)=='string' then return '"'..value:gsub('\\','\\\\'):gsub('"','\\"'):gsub('\n','\\n'):gsub('\r','\\r'):gsub('\t','\\t')..'"' end
  if type(value)~='table' then return tostring(value) end
  local keys={};for key in pairs(value) do keys[#keys+1]=key end;table.sort(keys)
  local parts={};for _,key in ipairs(keys) do parts[#parts+1]=jsonRecord(key)..':'..jsonRecord(value[key]) end
  return '{'..table.concat(parts,',')..'}'
end
local function host(dir,probe)
  local h={renders=0,decodes=0,launches={},timeline={},logs={},failLaunch=false,model=copy(model)}
  local ui=setmetatable({}, {__index=function(_,kind) return function(props,children) return {kind=kind,props=props or {},children=children or {}} end end})
  local env
  env={ui=ui,panel={render=function(tree) h.tree=tree; h.renders=h.renders+1; h.timeline[#h.timeline+1]='render' end,setNeedsFrameTick=function(v) h.frame=v end,setWantsSecondTicks=function() end},
    noctalia={json={encode=function(v) return type(v)=='table' and v.schema==1 and jsonRecord(v) or canonical(v) end,decode=function() h.decodes=h.decodes+1; return copy(h.model) end},log=function(s) if probe then assert(up(env.onFrameTick,'diagnosticDepth')==0,'log inside timed target callback') end;h.logs[#h.logs+1]=s end,
      runAsync=function(command,callback,timeout)
        assert(timeout==10000); assert(command:sub(1,#cli+2)=="'"..cli.."'" or not probe)
        h.launches[#h.launches+1]={command=command,callback=callback}
        if h.comparing then h.timeline[#h.timeline+1]='comparison-launch' end
        return not h.failLaunch
      end}}
  setmetatable(env,{__index=_G}); env.require=function(name) return assert(loadfile(dir..'/'..name:gsub('^%./',''),'t',env))() end
  assert(loadfile(dir..'/panel.luau','t',env))(); h.env=env; h.state=assert(up(env.onFrameTick,'state'))
  assert(not h.state.model and not h.state.drag and h.state.enqueued==0 and h.state.queue.inFlight==nil and next(env.retainedMemo().entries)==nil)
  h.tick=function()
    if probe then
      local buffer=up(env.onFrameTick,'diagnosticBuffer');local sequence=up(env.onFrameTick,'diagnosticSequence');local pair=up(env.onFrameTick,'diagnosticPair')
      local urgent=h.state.renderPending or h.state.drag~=nil or (pair and not pair.frameDone) or (sequence and not pair)
      while #up(env.onFrameTick,'diagnosticBuffer')>0 and not urgent do env.onFrameTick(16) end
    end
    env.onFrameTick(16)
  end
  env.onOpen({}); h.launches[1].callback(success); h.tick()
  local expand={}; for _,n in ipairs(nodes(h.tree)) do if n.props.tooltip=='Show details' then expand[#expand+1]=n end end
  assert(#expand==12); for _,n in ipairs(expand) do n.props.onClick() end
  return h
end
local function tree(h) return canonical(copy(h.tree,true)) end
local function button(h,text) for _,n in ipairs(nodes(h.tree)) do if n.props.text==text then return n end end end
local function checkCold(variant)
  local h=host(base..'/'..variant..'/plugin',true); local plain=host(base..'/'..variant..'/source',false)
  local b=assert(button(h,'Sample diagnostics'),'missing transient diagnostic start control')
  local r,d=h.renders,h.decodes; b.props.onClick(); assert(h.renders==r,'removal callback rendered')
  for i=1,5 do
    local old,structure=h.state.model,h.state.structure; local before=h.renders
    h.tick(); assert(h.renders==before,'cold setup rendered'); assert(h.decodes==d+i,'shown stdout shortcut skipped decode')
    assert(h.state.model~=old and h.state.structure~=structure,'cold replay did not freshly accept')
    assert(next(h.env.retainedMemo().entries)==nil)
    local trace={}; h.env.retainedMemo().trace=trace
    h.tick(); h.env.retainedMemo().trace=nil
    assert(#trace==142,'not every retained unit rebuilt: '..#trace)
    assert(h.renders==before+1 and tree(h)==tree(plain),'cold tree differs from production')
    assert(not button(h,'Sample diagnostics'))
  end
  assert(h.decodes==d+5 and h.renders==r+5)
  -- Disable/enable creates a new runtime; close/open deliberately does not.
  local old=h.state.model; h.env.onClose(); h.env.onOpen({}); assert(h.state.model==old,'close/open incorrectly treated as reset')
  return h
end
if arg[5]=='periodic' then
  for _,variant in ipairs({'baseline','candidate'}) do
    local h=host(base..'/'..variant..'/plugin',true)
    assert(button(h,'Sample diagnostics')).props.onClick();h.env.onFrameTick(16);h.env.onFrameTick(16)
    local observed={}
    local function collect() for _,e in ipairs(up(h.env.onFrameTick,'diagnosticBuffer')) do observed[e.recordId]=copy(e) end end
    local function sequence() return up(h.env.onFrameTick,'diagnosticSequence') end
    local function currentPair() return up(h.env.onFrameTick,'diagnosticPair') end
    local function settledRefresh()
      local count=#h.launches;h.comparing=false;h.env.update();assert(#h.launches==count+1,'even update did not retain normal refresh')
      local running=sequence();local renders=h.renders;h.env.onFrameTick(16);collect()
      assert(sequence()==running and not sequence().failure and not currentPair() and h.renders==renders,'temporary refresh busy state aborted or launched a trial')
      h.launches[#h.launches].callback(success);collect()
      assert(sequence()==running and not sequence().failure,'unchanged refresh aborted the sequence')
    end
    local count=#h.launches;h.env.update();collect()
    assert(#h.launches==count and sequence() and not sequence().failure,'harmless odd update invalidated diagnostics')
    settledRefresh()
    local decodes,enqueued,modelRef=h.decodes,h.state.enqueued,h.state.model
    for index=1,10 do
      h.comparing=true;h.env.onFrameTick(16);collect()
      assert(currentPair() and currentPair().id=='pair-'..math.ceil(index/2)..(((index%2==0)==(variant=='baseline')) and '-control' or '-launch'))
      local control=currentPair().control;local completion=not control and h.launches[#h.launches].callback or nil
      count=#h.launches;h.env.update();collect()
      assert(#h.launches==count and not currentPair().interference and not sequence().failure,'odd update contaminated unchanged active pair')
      h.env.onFrameTick(16);collect()
      if completion then completion(success);collect() end
      assert(not currentPair() and sequence().launchIndex==index+1)
      settledRefresh()
    end
    h.env.onFrameTick(16);collect();assert(not sequence(),'periodic multi-pair sequence did not reach done')
    local valid,invalid,done=0,0,false
    for _,e in pairs(observed) do
      if e.class=='pairDone' then if e.valid then valid=valid+1 else invalid=invalid+1 end end
      if e.class=='sequenceDone' then done=true end
      assert(e.class~='sequenceFailure' and e.class~='sequenceFailureReason','periodic timeline contains false sequence failure')
    end
    assert(valid==10 and invalid==0 and done and h.decodes==decodes and h.state.enqueued==enqueued and h.state.model==modelRef)
    while #up(h.env.onFrameTick,'diagnosticBuffer')>0 do h.env.onFrameTick(16) end
    local file=assert(io.open(base..'/'..variant..'/periodic-fake.log','w'));file:write(table.concat(h.logs,'\n')..'\n');file:close()
  end
  for _,variant in ipairs({'baseline','candidate'}) do
    for _,case in ipairs({'changed','error','timeout'}) do
      local h=host(base..'/'..variant..'/plugin',true)
      assert(button(h,'Sample diagnostics')).props.onClick();h.env.onFrameTick(16);h.env.onFrameTick(16)
      h.env.update();h.env.update();h.env.onFrameTick(16)
      assert(up(h.env.onFrameTick,'diagnosticSequence'),'busy refresh ended sequence before result')
      local response=copy(success)
      if case=='changed' then
        response.stdout='changed periodic fixture'
        for _,param in ipairs(h.model.params) do if param.key=='glass.inactive.roughness' then param.value=param.value+0.01 end end
      elseif case=='error' then response.exitCode=1;response.stderr='normal refresh failure'
      else response.timedOut=true end
      h.launches[#h.launches].callback(response)
      local renders=h.renders;h.env.onFrameTick(16)
      assert(not up(h.env.onFrameTick,'diagnosticSequence') and h.renders==renders+1,'changed/error result failed to stop sequence or preserve original deferred frame')
      local reason=false;for _,e in ipairs(up(h.env.onFrameTick,'diagnosticBuffer')) do if e.class=='sequenceFailureReason' then reason=true end end;assert(reason)
    end
    local h=host(base..'/'..variant..'/plugin',true)
    assert(button(h,'Sample diagnostics')).props.onClick();h.env.onFrameTick(16);h.env.onFrameTick(16);h.env.onFrameTick(16)
    local pair=assert(up(h.env.onFrameTick,'diagnosticPair'));local control=pair.control
    local completion=not control and h.launches[#h.launches].callback or nil
    h.env.update();assert(not pair.interference,'odd update invalidated active pair')
    h.env.update();local normal=h.launches[#h.launches].callback
    assert(pair.interference=='foreign-launch','foreign refresh launch was not recorded')
    h.env.onFrameTick(16)
    normal(success);if completion then completion(success) end
    assert(not up(h.env.onFrameTick,'diagnosticPair') and up(h.env.onFrameTick,'diagnosticSequence') and not up(h.env.onFrameTick,'diagnosticSequence').failure)
    local reasons,invalid,dispositions={},{},{}
    for _,e in ipairs(up(h.env.onFrameTick,'diagnosticBuffer')) do
      if e.class=='pairInterference' then reasons[e.reason]=true end
      if e.class=='pairDone' then assert(not e.valid);invalid[e.pairId]=true end
    end
    assert(reasons['foreign-launch'] and (control or reasons['describe-result']) and next(invalid),'raw foreign/unchanged pair reasons were lost')
    for index=2,10 do
      h.env.onFrameTick(16);local p=assert(up(h.env.onFrameTick,'diagnosticPair'));local done=not p.control and h.launches[#h.launches].callback or nil
      h.env.onFrameTick(16);if done then done(success) end
      for _,e in ipairs(up(h.env.onFrameTick,'diagnosticBuffer')) do if e.class=='pairDone' then dispositions[e.pairId]=e.valid end end
    end
    h.env.onFrameTick(16);assert(not up(h.env.onFrameTick,'diagnosticSequence'),'foreign collision prevented finite completion after settlement')
    local good,bad=0,0;for _,valid in pairs(dispositions) do if valid then good=good+1 else bad=bad+1 end end
    assert(good==9 and bad==1,'contaminated pair disappeared or was falsely admitted')
    while #up(h.env.onFrameTick,'diagnosticBuffer')>0 do h.env.onFrameTick(16) end
    local file=assert(io.open(base..'/'..variant..'/periodic-interference-fake.log','w'));file:write(table.concat(h.logs,'\n')..'\n');file:close()
  end
  print('PASS periodic failures: changed/error/timeout stop with one original deferred frame; real foreign launch invalidates only its pair, preserves all reasons, settles and completes nine valid/one excluded trial')
  print('PASS periodic: regular odd ticks during all ten trials, eleven even refresh/unchanged callbacks between trials, busy waits, finite done, ten valid pairs per variant and unchanged model/decode/queue')
  os.exit(0)
end
if arg[5]=='sequence' then
  for _,variant in ipairs({'baseline','candidate'}) do
    local h=host(base..'/'..variant..'/plugin',true); local plain=host(base..'/'..variant..'/source',false)
    local inputQueue=canonical(h.state.queue); local enqueued=h.state.enqueued
    assert(button(h,'Sample diagnostics')).props.onClick(); h.tick(); h.tick()
    assert(tree(h)==tree(plain)); local done,seenDone={},{}
    for index=1,10 do
      local before=#h.launches; h.timeline={}; h.comparing=true; h.tick()
      local control=(index%2==0)==(variant=='baseline')
      local timeline_expected=control and {'render'} or {'comparison-launch','render'}
      assert(canonical(h.timeline)==canonical(timeline_expected),'automatic order mismatch')
      assert(#h.launches==before+(control and 0 or 1))
      if not control and index%4==1 then h.launches[#h.launches].callback(success) end
      h.tick(); assert(#h.timeline==#timeline_expected+1 and h.timeline[#h.timeline]=='render')
      assert(tree(h)==tree(plain),'automatic pair changed tree')
      local held=up(h.env.onFrameTick,'diagnosticPair')
      if held then assert(held.frameDone and held.pending); h.launches[#h.launches].callback(success) end
      assert(not up(h.env.onFrameTick,'diagnosticPair'))
      for _,e in ipairs(up(h.env.onFrameTick,'diagnosticBuffer')) do if e.class=='pairDone' and not seenDone[e.recordId] then seenDone[e.recordId]=true;done[#done+1]=e;assert(e.valid) end end
    end
    h.tick(); assert(not up(h.env.onFrameTick,'diagnosticSequence'))
    assert(#done==10 and canonical(h.state.queue)==inputQueue and h.state.enqueued==enqueued and h.decodes==2)
    while #up(h.env.onFrameTick,'diagnosticBuffer')>0 do h.env.onFrameTick(16) end
    local file=assert(io.open(base..'/'..variant..'/fake.log','w'));file:write(table.concat(h.logs,'\n')..'\n');file:close()
  end
  print('PASS sequence: one pilot cold pair then five launch/control pairs, reversed alternation, separate callback/frame/command drain, production trees, no model/queue writes')
  os.exit(0)
end
for _,variant in ipairs({'baseline','candidate'}) do checkCold(variant) end
print('PASS cold: both variants, five separate fresh setup/render callbacks, 142 units, production trees, close/open is not reset')
local function timeline(h,want)
  assert(#h.timeline==#want,'wrong timeline length '..canonical(h.timeline))
  for i,x in ipairs(want) do assert(h.timeline[i]==x,'wrong launch/render order '..canonical(h.timeline)) end
end
local function pair(h,id,control)
  local begin=assert(up(h.env.onFrameTick,'beginLaunchPair'))
  local cb=assert(up(h.env.onFrameTick,'diagnosticCallback'))
  h.comparing=true
  return cb('pairImmediate',begin,id,control)
end
local function pairState(h) return up(h.env.onFrameTick,'diagnosticPair') end
local function buffer(h) return assert(up(h.env.onFrameTick,'diagnosticBuffer')) end
local function finishSequence(h)
  assert(button(h,'Sample diagnostics')).props.onClick()
  for _=1,10 do h.tick() end
  h.tick(); -- finite sequenceDone
  while #buffer(h)>0 do h.env.onFrameTick(16) end
end
for _,variant in ipairs({'baseline','candidate'}) do
  for _,early in ipairs({false,true}) do
    local h=host(base..'/'..variant..'/plugin',true); finishSequence(h)
    local d,e,m,q=h.decodes,h.state.enqueued,h.state.model,canonical(h.state.queue)
    h.timeline={}; local count=#h.launches
    assert(pair(h,'launch-'..tostring(early),false)); timeline(h,{'comparison-launch','render'})
    assert(#h.launches==count+1)
    local complete=h.launches[#h.launches].callback
    if early then complete(success); assert(pairState(h) and not pairState(h).pending and not pairState(h).frameDone) end
    h.tick(); timeline(h,{'comparison-launch','render','render'})
    if not early then assert(pairState(h).pending and pairState(h).frameDone); complete(success) end
    assert(not pairState(h) and h.decodes==d and h.state.enqueued==e and h.state.model==m and canonical(h.state.queue)==q)
    local found=false; for _,event in ipairs(buffer(h)) do if event.class=='pairDone' then assert(event.valid); found=true end end; assert(found)
  end
  local h=host(base..'/'..variant..'/plugin',true); finishSequence(h); h.timeline={}; local count=#h.launches
  assert(pair(h,'control',true)); timeline(h,{'render'}); h.tick(); timeline(h,{'render','render'}); assert(#h.launches==count and not pairState(h))
  for _,case in ipairs({'failed-launch','failed-completion','malformed-completion','changed-describe','unchanged-describe','error-describe','focus','expansion','optimistic','overlap'}) do
    h=host(base..'/'..variant..'/plugin',true); finishSequence(h); h.timeline={}
    h.failLaunch=case=='failed-launch'
    local ok=pair(h,case,false)
    if case=='failed-launch' then assert(not ok and not pairState(h)); timeline(h,{'comparison-launch'})
    else
      local complete=h.launches[#h.launches].callback
      if case=='failed-completion' then local failed=copy(success); failed.exitCode=1; complete(failed)
      elseif case=='malformed-completion' then complete({})
      elseif case:find('describe',1,true) then
        local fn=assert(up(h.env.onFrameTick,'described')); local result=copy(success)
        if case=='changed-describe' then result.stdout='changed fixture'
        elseif case=='error-describe' then result.exitCode=1; result.stderr='failed' end
        fn(result)
      elseif case=='focus' then h.env.onKey('j',true)
      elseif case=='expansion' then for _,n in ipairs(nodes(h.tree)) do if n.props.tooltip=='Hide details' then n.props.onClick(); break end end
      elseif case=='optimistic' then for _,n in ipairs(nodes(h.tree)) do if n.kind=='slider' then n.props.onChange(n.props.value+0.1); break end end
      elseif case=='overlap' then assert(not pair(h,'overlap-attempt',true)) end
      assert(pairState(h).interference,'interference not captured: '..case)
      h.tick(); if pairState(h) and pairState(h).pending then complete(success) end
      assert(not pairState(h),'pair did not finish: '..case)
    end
    local invalid=false; for _,event in ipairs(buffer(h)) do if event.class=='pairDone' then assert(not event.valid); invalid=true end end
    assert(invalid,'missing invalid pair disposition: '..case)
  end
end
print('PASS pair timelines: launch then immediate/frame render; early/late completion and control separate; no decode/model/queue mutation; ten failure/interference cases excluded for both variants')
for _,variant in ipairs({'baseline','candidate'}) do
  local h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  local plain=host(base..'/'..variant..'/source',false)
  local function slider(x)
    for _,n in ipairs(nodes(x.tree)) do if n.kind=='slider' and n.props.key=='glass.inactive.roughness:slider' then return n end end
    error('roughness slider missing')
  end
  local startRenders=h.renders
  for _,x in ipairs({h,plain}) do
    local s=slider(x);s.props.onChange(s.props.value+0.1); x.tick(); s.props.onDragEnd()
  end
  assert(h.renders==startRenders+2 and tree(h)==tree(plain),'real drag/release render path changed')
  local callbackClasses={}; for _,e in ipairs(buffer(h)) do if e.scope=='callback' then callbackClasses[e.class]=e end end
  assert(callbackClasses.dragTick and callbackClasses.dragTick.rendered and callbackClasses.release and callbackClasses.release.rendered)
  local command=h.launches[#h.launches].command;local plainCommand=plain.launches[#plain.launches].command
  assert(command:sub(#cli+4)==plainCommand:sub(#'prism'+4),'queue argv order changed')
  for _,x in ipairs({h,plain}) do
    x.launches[#x.launches].callback(success)
    local changed=copy(success);changed.stdout='changed accepted fixture'
    x.launches[#x.launches].callback(changed);x.tick()
  end
  assert(tree(h)==tree(plain),'accepted changed-describe deferred tree differs')
  local deferred=false;for _,e in ipairs(buffer(h)) do if e.scope=='callback' and e.class=='deferredRender' then deferred=e.rendered end end;assert(deferred)
  for _,x in ipairs({h,plain}) do
    x.env.onKey('1',true)
    assert(x.state.selectionPending,'profile action did not enqueue')
    x.launches[#x.launches].callback(success)
    local changed=copy(success);changed.stdout='changed profile fixture'
    x.launches[#x.launches].callback(changed); x.tick()
  end
  assert(tree(h)==tree(plain),'profile deferred tree differs')
  local profile=false;for _,e in ipairs(buffer(h)) do if e.scope=='callback' and e.class=='profileRender' then profile=e.rendered and e.profileGeneration==1 end end;assert(profile)
  -- Idle/loading callbacks never provide drag/deferred/release samples.
  h.tick();local last=buffer(h)[#buffer(h)];assert(last.class=='idle' and not last.rendered)
end
print('PASS classification: real dirty drag/release and queue reconciliation unchanged; accepted changed describe deferred; profile generation render; idle excluded; both trees match plain')
for _,variant in ipairs({'baseline','candidate'}) do
  local h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  local plain=host(base..'/'..variant..'/source',false)
  for _,x in ipairs({h,plain}) do
    local key=x.state.structure.rack.cards[1].bypass.key
    for _,param in ipairs(x.model.params) do if param.key==key then param.effectiveDrag=nil end end
    local changed=copy(success);changed.stdout='unavailable light fixture'
    x.launches[1].callback(changed);x.tick()
  end
  assert(tree(h)==tree(plain),'optional nil callback changed the production tree')
end
print('PASS optional callbacks: unavailable native light keeps nil handler and production tree')
local h=host(base..'/candidate/plugin',true)
local input=assert(up(h.env.onFrameTick,'diagnosticInput'))
local returned=table.pack(input('onClick',function() return nil,'kept',false end)())
assert(returned.n==3 and returned[1]==nil and returned[2]=='kept' and returned[3]==false)
print('PASS wrappers: nil handlers and all original callback return values preserved; all logs outside target callbacks')
for _,variant in ipairs({'baseline','candidate'}) do
  local h=host(base..'/'..variant..'/plugin',true);finishSequence(h);h.timeline={}
  pair(h,'next-native-frame',false);h.env.onFrameTick(16)
  timeline(h,{'comparison-launch','render','render'})
  h.launches[#h.launches].callback(success)
  h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  local slider;for _,node in ipairs(nodes(h.tree)) do if node.kind=='slider' and node.props.key=='glass.inactive.roughness:slider' then slider=node end end
  for i=1,2 do local before=h.renders;slider.props.onChange(slider.props.value+i*0.1);h.env.onFrameTick(16);assert(h.renders==before+1,'flush delayed dirty native drag frame') end
  slider.props.onDragEnd()
  h.env.onClose();assert(not h.frame,'diagnostics reenabled frame ticks on close')
end
print('PASS native cadence: next actual frame renders pairs; consecutive dirty drag frames render without observer delay; close keeps ticks disabled')
for _,variant in ipairs({'baseline','candidate'}) do
  local function roughness(x) for _,n in ipairs(nodes(x.tree)) do if n.kind=='slider' and n.props.key=='glass.inactive.roughness:slider' then return n end end;error('slider missing') end
  local h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  for _,param in ipairs(h.model.params) do if param.key=='glass.inactive.roughness' then param.effectiveDrag='live' end end
  local live=copy(success);live.stdout='live-drag calibration fixture';h.launches[1].callback(live);h.tick()
  local s=roughness(h);s.props.onChange(s.props.value+0.1);h.env.onFrameTick(16)
  assert(h.state.drag and not h.state.drag.dirty and h.state.drag.pendingSample)
  local r,e,l=h.renders,h.state.enqueued,#h.launches
  h.env.onFrameTick(84)
  assert(h.renders==r and h.state.enqueued==e+1 and #h.launches==l+1 and not h.state.drag.pendingSample,'flush delayed nondirty drag 100ms sampling')
  h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  local changed=copy(success);changed.stdout='native deferred fixture';h.launches[1].callback(changed);r=h.renders
  h.env.onFrameTick(16);assert(h.renders==r+1 and not h.state.renderPending,'flush delayed ordinary deferred render')
  h=host(base..'/'..variant..'/plugin',true);r=h.renders;local d=h.decodes
  assert(button(h,'Sample diagnostics')).props.onClick();h.env.onFrameTick(16)
  assert(h.renders==r and h.decodes==d+1,'next requested callback did not perform cold setup')
  h.env.onFrameTick(16);assert(h.renders==r+1 and h.decodes==d+1,'cold render did not use next actual frame')
  h=host(base..'/'..variant..'/plugin',true);finishSequence(h);pair(h,'collision',false)
  s=roughness(h);s.props.onChange(s.props.value+0.1);r=h.renders;h.env.onFrameTick(16)
  assert(h.renders==r+1 and not h.state.drag.dirty,'collision duplicated or skipped ordinary frame work')
  assert(pairState(h).frameDone and pairState(h).pending and pairState(h).interference)
  h.launches[#h.launches].callback(success);local failed=false
  for _,event in ipairs(buffer(h)) do if event.class=='pairDone' and not event.valid then failed=true end end;assert(failed)
  h=host(base..'/'..variant..'/plugin',true);finishSequence(h)
  local input=assert(up(h.env.onFrameTick,'diagnosticInput'));for _=1,40 do input('onClick',function() end)() end
  r,d,e,l=h.renders,h.decodes,h.state.enqueued,#h.logs;local q=canonical(h.state.queue)
  h.env.onFrameTick(16)
  assert(#h.logs==l+17 and #buffer(h)==24,'observer flush was not bounded to sixteen records')
  assert(h.renders==r and h.decodes==d and h.state.enqueued==e and canonical(h.state.queue)==q,'idle observer changed normal state')
  while #buffer(h)>0 do h.env.onFrameTick(16) end
  assert(not h.frame and #buffer(h)==0,'final observer drain did not stop ticks')
end
print('PASS raw frames: nondirty active drag sampling, ordinary deferred, cold next frame, pair collision preserves one normal frame; idle flush chunks sixteen and fully drains')
