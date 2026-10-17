local diagnosticIdentity = IDENTITY
local diagnosticBuffer, diagnosticCallbackId, diagnosticDepth = {}, 0, 0
local diagnosticRecordId=0
local diagnosticClockOrigin=diagnosticIdentity.activationNonce
local diagnosticClass, diagnosticRendered, diagnosticAccepted = 'idle', false, false
local diagnosticOutcome, diagnosticAcceptGeneration, diagnosticProfileGeneration = 'none', 0, 0
local diagnosticProfilePending, diagnosticDeferred, diagnosticCold = false, false, false
local diagnosticHidden, diagnosticSequence, diagnosticPair = false, nil, nil
local diagnosticInternal = false
local diagnosticReadyRequested=false
local function diagnosticEvent(class, elapsed, extra)
  diagnosticRecordId=diagnosticRecordId+1
  local event = {schema=1, recordId=diagnosticRecordId, callbackId=diagnosticDepth>0 and diagnosticCallbackId or 0,
    class=class, elapsedMs=elapsed, rendered=diagnosticRendered, accepted=diagnosticAccepted,
    pairId=diagnosticPair and diagnosticPair.id or false, control=diagnosticPair~=nil and diagnosticPair.control or false, pending=diagnosticPair and diagnosticPair.pending or false,
    interference=diagnosticPair and diagnosticPair.interference or false, timestamp=os.clock(),
    phase=class, complete=true, diagnosticsHidden=diagnosticHidden, acceptGeneration=diagnosticAcceptGeneration,
    profileGeneration=diagnosticProfileGeneration, outcome=diagnosticOutcome}
  if extra then for k,v in pairs(extra) do event[k]=v end end
  diagnosticBuffer[#diagnosticBuffer+1]=event
end
local function diagnosticInterfere(reason, inputChanged)
  if diagnosticPair then
    diagnosticPair.interference=reason
    diagnosticEvent('pairInterference',0,{scope='metadata',reason=reason})
  end
  if diagnosticSequence and not diagnosticInternal and inputChanged~=false then diagnosticSequence.failure=reason end
end
local function diagnosticCallback(class, fn, ...)
  if diagnosticDepth>0 then return fn(...) end
  diagnosticCallbackId=diagnosticCallbackId+1
  diagnosticDepth=1; diagnosticClass=class; diagnosticRendered=false; diagnosticAccepted=false; diagnosticOutcome='none'
  local started=os.clock()
  local returned=table.pack(fn(...))
  local elapsed=(os.clock()-started)*1000
  diagnosticEvent(diagnosticClass,elapsed,{scope='callback'})
  diagnosticDepth=0
  if state.open then panel.setNeedsFrameTick(true) end
  return table.unpack(returned,1,returned.n)
end
local function diagnosticInput(name, fn)
  if fn==nil then return nil end
  return function(...)
    diagnosticInterfere(name)
    return diagnosticCallback(name=='onDragEnd' and 'release' or 'input',fn,...)
  end
end
local function diagnosticExpand(event)
  event.clockOrigin=diagnosticClockOrigin; event.variant=diagnosticIdentity.variant
  event.sourceCommit=diagnosticIdentity.sourceCommit; event.sourceHash=diagnosticIdentity.sourceHash
  event.activationNonce=diagnosticIdentity.activationNonce; event.block=diagnosticIdentity.block
  return event
end
local function diagnosticDirect(class,elapsed,extra)
  diagnosticEvent(class,elapsed,extra)
  local event=diagnosticBuffer[#diagnosticBuffer];diagnosticBuffer[#diagnosticBuffer]=nil
  event.callbackId=diagnosticCallbackId
  event.rendered=false;event.accepted=false;event.pairId=false;event.control=false;event.pending=false;event.interference=false
  noctalia.log('prism-budget '..noctalia.json.encode(diagnosticExpand(event)))
end
local function diagnosticSnapshot(class)
  assert(diagnosticDepth==0,'snapshot must be outside target timing')
  local started=os.clock()
  diagnosticCallbackId=diagnosticCallbackId+1
  local expandedIds,rackIds={},{}
  for id,expanded in pairs(state.expanded) do if expanded==true then expandedIds[#expandedIds+1]=id end end
  if state.structure~=nil then for _,card in ipairs(state.structure.rack.cards) do rackIds[#rackIds+1]=card.device end end
  table.sort(expandedIds);table.sort(rackIds)
  local allExpanded=state.structure~=nil and #expandedIds==#rackIds
  for _,id in ipairs(rackIds) do if state.expanded[id]~=true then allExpanded=false end end
  local queueIdle=state.queue.inFlight==nil and #state.queue.pending==0
  local modelReady=state.model~=nil and state.structure~=nil
  local settled=state.open and modelReady and queueIdle and not describeRunning and state.drag==nil
    and not state.renderPending and not state.refreshPending and not state.refreshAfterDrag and not state.describeInvalidated
    and state.errorText==nil and not state.selectionPending and not state.help
  local bufferCount=#diagnosticBuffer
  diagnosticDirect(class,(os.clock()-started)*1000,{scope='metadata',observer=true,
    queueIdle=queueIdle,queuePendingCount=#state.queue.pending,queueInFlight=state.queue.inFlight~=nil,
    describeRunning=describeRunning,dragEmpty=state.drag==nil,renderPending=state.renderPending,
    refreshPending=state.refreshPending,refreshAfterDrag=state.refreshAfterDrag,describeInvalidated=state.describeInvalidated,
    selectionPending=state.selectionPending,help=state.help,errorText=state.errorText or false,errorSticky=state.errorSticky,open=state.open,modelReady=modelReady,
    pairEmpty=diagnosticPair==nil,pairPending=diagnosticPair~=nil and diagnosticPair.pending or false,
    pairFrameDone=diagnosticPair~=nil and diagnosticPair.frameDone or false,
    comparisonCallbacksComplete=diagnosticPair==nil or not diagnosticPair.pending,
    sequenceComplete=diagnosticSequence==nil,sequencePhase=diagnosticSequence~=nil and diagnosticSequence.phase or false,
    bufferEmpty=bufferCount==0,bufferCount=bufferCount,expandedIds=expandedIds,rackIds=rackIds,allRackExpanded=allExpanded,
    currentProfile=modelReady and (state.model.active.profile or false) or false,
    readyEligible=class=='ready' and settled and allExpanded and diagnosticPair==nil and diagnosticSequence~=nil and diagnosticSequence.phase=='setup' and not diagnosticSequence.failure,
    eligibleDrain=class=='drain' and settled and allExpanded and diagnosticPair==nil and diagnosticSequence==nil and bufferCount==0})
  diagnosticDirect('observerSnapshot',(os.clock()-started)*1000,{scope='observer',snapshotClass=class})
end
local function diagnosticFlush()
  local records=diagnosticBuffer; diagnosticBuffer={}
  local count=math.min(#records,16)
  local started=os.clock()
  for i=1,count do noctalia.log('prism-budget '..noctalia.json.encode(diagnosticExpand(records[i]))) end
  local elapsed=(os.clock()-started)*1000
  diagnosticCallbackId=diagnosticCallbackId+1; diagnosticDepth=1
  diagnosticEvent('observerFlush',elapsed,{scope='observer',recordCount=count,remainingRecords=#records-count,bufferEmpty=#records==count})
  local observer=diagnosticBuffer[1]; diagnosticBuffer={}; diagnosticDepth=0
  noctalia.log('prism-budget '..noctalia.json.encode(diagnosticExpand(observer)))
  for i=count+1,#records do diagnosticBuffer[#diagnosticBuffer+1]=records[i] end
  if #diagnosticBuffer==0 then diagnosticSnapshot('drain') end
end
