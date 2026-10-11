local diagnosticPlainRender=render
render=function(...)
  if diagnosticPair and not diagnosticInternal then diagnosticInterfere('render-input-callback') end
  local started=os.clock()
  local returned=table.pack(diagnosticPlainRender(...))
  local elapsed=(os.clock()-started)*1000
  diagnosticRendered=state.model~=nil and not state.help
  diagnosticEvent(diagnosticClass,elapsed,{scope='render',rendered=diagnosticRendered})
  return table.unpack(returned,1,returned.n)
end
local diagnosticPlainDescribed=described
described=function(result)
  if not diagnosticCold then diagnosticInterfere('describe-result',false) end
  return diagnosticCallback(diagnosticCold and 'coldSetup' or 'describeResult',function()
    local previousError=state.errorText
    diagnosticPlainDescribed(result)
    if not diagnosticCold and (diagnosticAccepted or diagnosticOutcome=='rejected' or state.errorText~=previousError) then
      diagnosticInterfere('describe-'..diagnosticOutcome)
    end
    if diagnosticAccepted and not diagnosticCold then diagnosticClass='changedDescribe' end
  end)
end
local diagnosticPlainProfile=pickProfile
pickProfile=function(...) return diagnosticCallback('profileAction',diagnosticPlainProfile,...) end
local diagnosticPlainFinishWrite=finishWrite
finishWrite=function(...) diagnosticInterfere('writeCompletion'); return diagnosticCallback('writeCompletion',diagnosticPlainFinishWrite,...) end
local diagnosticPlainTick,diagnosticPlainUpdate=onFrameTick,update
local diagnosticPlainOpen,diagnosticPlainClose,diagnosticPlainKey=onOpen,onClose,onKey
onOpen=function(...) diagnosticInterfere('open'); return diagnosticCallback('open',diagnosticPlainOpen,...) end
onClose=function(...) diagnosticInterfere('close'); return diagnosticCallback('close',diagnosticPlainClose,...) end
onKey=function(...) diagnosticInterfere('key'); return diagnosticCallback('input',diagnosticPlainKey,...) end
update=function(...)
  return diagnosticCallback('secondTick',diagnosticPlainUpdate,...)
end
local function diagnosticReady()
  return state.open and state.model~=nil and state.shownStdout~=nil and not state.help and state.errorText==nil
    and state.drag==nil and state.queue.inFlight==nil and #state.queue.pending==0 and not describeRunning
    and not state.refreshPending and not state.refreshAfterDrag and not state.describeInvalidated
end
local function diagnosticPairFailure(reason)
  if diagnosticPair then
    diagnosticPair.interference=reason
    diagnosticEvent('pairInvalid',0,{scope='metadata',reason=reason})
  end
end
local function diagnosticFinishPair()
  if diagnosticPair and diagnosticPair.frameDone and not diagnosticPair.pending then
    diagnosticEvent('pairInterval',(os.clock()-diagnosticPair.started)*1000,{scope='interval',control=diagnosticPair.control,startTimestamp=diagnosticPair.started,endTimestamp=os.clock()})
    diagnosticEvent('pairDone',0,{scope='metadata',valid=not diagnosticPair.interference,
      control=diagnosticPair.control,completionState=diagnosticPair.completionState or 'done'})
    diagnosticPair=nil
    if diagnosticSequence then diagnosticSequence.launchIndex=diagnosticSequence.launchIndex+1 end
    syncFrameTick()
  end
end
local function beginLaunchPair(id,control)
  if diagnosticPair or not diagnosticReady() then
    diagnosticPairFailure('overlap-or-unsettled')
    diagnosticEvent('pairRefused',0,{scope='metadata',reason='overlap-or-unsettled'})
    return false
  end
  diagnosticPair={id=id,control=control,pending=not control,frameDone=false,started=os.clock(),model=state.model,enqueued=state.enqueued,interference=false}
  diagnosticInternal=true
  if not control then
    local started=os.clock()
    local ok=run({'prism','describe','--json'},function(result)
      return diagnosticCallback('comparisonCompletion',function()
        local p=diagnosticPair
        if not p then diagnosticEvent('orphanCompletion',0,{scope='metadata'}); return end
        p.pending=false
        if type(result)~='table' or type(result.exitCode)~='number' or result.exitCode~=0
          or result.timedOut~=false or result.stdoutTruncated~=false or result.stderrTruncated~=false
          or type(result.stdout)~='string' or type(result.stderr)~='string' then diagnosticPairFailure('completion-failure') end
        local metadata={scope='metadata',control=false,resultType=type(result)}
        if type(result)=='table' then
          for _,key in ipairs({'exitCode','timedOut','stdoutTruncated','stderrTruncated'}) do metadata[key]=result[key] end
        end
        diagnosticEvent('comparisonCompletionResult',0,metadata)
        diagnosticFinishPair()
      end)
    end)
    local elapsed=(os.clock()-started)*1000
    diagnosticEvent('launchHelper',elapsed,{scope='launchHelper',control=false})
    if not ok then diagnosticPairFailure('launch-failure'); diagnosticPair.pending=false; diagnosticPair.frameDone=true; diagnosticFinishPair(); diagnosticInternal=false; return false end
  end
  diagnosticClass='pairImmediate'
  render()
  diagnosticEvent('pairImmediateState',0,{scope='metadata',control=control})
  diagnosticInternal=false
  panel.setNeedsFrameTick(true)
  return true
end
local function diagnosticStart()
  if diagnosticHidden then return end
  return diagnosticCallback('diagnosticStart',function()
    assert(diagnosticReady(),'Diagnostics require a settled panel')
    for _,card in ipairs(state.structure.rack.cards) do assert(state.expanded[card.device]==true,'Expand every card first') end
    diagnosticHidden=true
    diagnosticReadyRequested=true
    diagnosticSequence={coldRemaining=diagnosticIdentity.coldPairs,phase='setup',launchIndex=1,stdout=state.shownStdout,model=state.model,enqueued=state.enqueued}
    panel.setNeedsFrameTick(true)
  end)
end
onFrameTick=function(deltaMs)
  local ordinaryTickDue=state.drag~=nil or state.renderPending
  local sequenceDue=diagnosticSequence~=nil and diagnosticPair==nil
  local pairRenderDue=diagnosticPair~=nil and not diagnosticPair.frameDone
  local coldRenderDue=diagnosticSequence~=nil and diagnosticSequence.phase=='render' and diagnosticSequence.coldRemaining>0
  if diagnosticReadyRequested and not (ordinaryTickDue or pairRenderDue or coldRenderDue) then
    diagnosticReadyRequested=false
    if #diagnosticBuffer>0 then diagnosticFlush() end
    diagnosticSnapshot('ready')
    syncFrameTick()
    return
  end
  if #diagnosticBuffer>0 and not (ordinaryTickDue or sequenceDue or pairRenderDue) then diagnosticFlush(); syncFrameTick(); return end
  if diagnosticPair and not diagnosticPair.frameDone then
    return diagnosticCallback('pairFrame',function()
      diagnosticInternal=true
      diagnosticPair.completionState=diagnosticPair.pending and 'pending' or 'done'
      if diagnosticPair.model~=state.model or diagnosticPair.enqueued~=state.enqueued then diagnosticPairFailure('input-reference-change') end
      if diagnosticPair.interference or ordinaryTickDue then
        diagnosticPairFailure(diagnosticPair.interference or 'ordinary-frame-work')
      else render() end
      diagnosticEvent('pairFrameState',0,{scope='metadata',control=diagnosticPair.control,completionState=diagnosticPair.completionState})
      diagnosticPair.frameDone=true
      diagnosticInternal=false
      diagnosticFinishPair()
      diagnosticPlainTick(deltaMs)
    end)
  end
  if diagnosticPair and not ordinaryTickDue then syncFrameTick(); return end
  if diagnosticSequence and diagnosticPair==nil then
    local sequence=diagnosticSequence
    if sequence.failure or sequence.model~=state.model or sequence.enqueued~=state.enqueued or sequence.stdout~=state.shownStdout or state.errorText~=nil or not state.open or state.help then
      return diagnosticCallback('sequenceFailure',function() diagnosticEvent('sequenceFailureReason',0,{scope='metadata',reason=sequence.failure or 'input-change'}); diagnosticSequence=nil; if ordinaryTickDue then diagnosticPlainTick(deltaMs) end; syncFrameTick() end)
    end
    if not diagnosticReady() then
      return diagnosticCallback('sequenceWait',function()
        diagnosticEvent('sequenceWaitReason',0,{scope='metadata',describePending=describeRunning,
          queueBusy=state.queue.inFlight~=nil or #state.queue.pending>0})
        if ordinaryTickDue then diagnosticPlainTick(deltaMs) end
        syncFrameTick()
      end)
    end
    if sequence.coldRemaining>0 then
      if sequence.phase=='setup' then
        return diagnosticCallback('coldSetup',function()
          diagnosticInternal=true; diagnosticCold=true
          sequence.coldStarted=os.clock()
          local saved=state.shownStdout
          Retain.clear(memo); state.shownStdout=nil
          described({timedOut=false,exitCode=0,stdout=saved,stderr='',stdoutTruncated=false,stderrTruncated=false})
          sequence.model=state.model; sequence.phase='render'
          diagnosticCold=false; diagnosticInternal=false
        end)
      end
      return diagnosticCallback('coldRender',function()
        diagnosticInternal=true; diagnosticPlainTick(deltaMs); diagnosticInternal=false
        diagnosticEvent('coldPairInterval',(os.clock()-sequence.coldStarted)*1000,{scope='interval',startTimestamp=sequence.coldStarted,endTimestamp=os.clock()})
        diagnosticDeferred=nil
        sequence.coldRemaining=sequence.coldRemaining-1; sequence.phase='setup'; syncFrameTick()
      end)
    end
    if diagnosticIdentity.launchPairs>0 and sequence.launchIndex<=diagnosticIdentity.launchPairs*2 then
      return diagnosticCallback('pairImmediate',function()
        local index=sequence.launchIndex
        local control=(index%2==0)==(diagnosticIdentity.variant=='baseline')
        beginLaunchPair('pair-'..math.ceil(index/2)..(control and '-control' or '-launch'),control)
      end)
    end
    return diagnosticCallback('sequenceDone',function() diagnosticSequence=nil; if ordinaryTickDue then diagnosticPlainTick(deltaMs) end; syncFrameTick() end)
  end
  local class=state.drag~=nil and state.drag.dirty and 'dragTick' or (state.renderPending and diagnosticDeferred or 'idle')
  diagnosticDeferred=nil
  return diagnosticCallback(class or 'idle',diagnosticPlainTick,deltaMs)
end

diagnosticEvent('activation',0,{scope='activation',initialModelEmpty=state.model==nil,initialStructureEmpty=state.structure==nil,initialMemoEmpty=next(memo.entries)==nil,initialEnqueued=state.enqueued,initialDragEmpty=state.drag==nil,initialRenderPending=state.renderPending,initialPairEmpty=diagnosticPair==nil,initialQueueEmpty=state.queue.inFlight==nil and #state.queue.pending==0})
