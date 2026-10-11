local diagnosticIdentity = IDENTITY
local diagnosticBuffer, diagnosticCallbackId, diagnosticDepth = {}, 0, 0
local diagnosticRecordId=0
local diagnosticClockOrigin=diagnosticIdentity.activationNonce
local diagnosticClass, diagnosticRendered, diagnosticAccepted = 'idle', false, false
local diagnosticOutcome, diagnosticAcceptGeneration, diagnosticProfileGeneration = 'none', 0, 0
local diagnosticProfilePending, diagnosticDeferred, diagnosticCold = false, false, false
local diagnosticHidden, diagnosticSequence, diagnosticPair = false, nil, nil
local diagnosticInternal = false
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
local function diagnosticInterfere(reason)
  if diagnosticPair then diagnosticPair.interference=reason end
  if diagnosticSequence and not diagnosticInternal then diagnosticSequence.failure=reason end
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
local function diagnosticFlush()
  local records=diagnosticBuffer; diagnosticBuffer={}
  local count=math.min(#records,16)
  local started=os.clock()
  for i=1,count do noctalia.log('prism-budget '..noctalia.json.encode(diagnosticExpand(records[i]))) end
  local elapsed=(os.clock()-started)*1000
  diagnosticCallbackId=diagnosticCallbackId+1; diagnosticDepth=1
  diagnosticEvent('observerFlush',elapsed,{scope='observer',recordCount=count})
  local observer=diagnosticBuffer[1]; diagnosticBuffer={}; diagnosticDepth=0
  noctalia.log('prism-budget '..noctalia.json.encode(diagnosticExpand(observer)))
  for i=count+1,#records do diagnosticBuffer[#diagnosticBuffer+1]=records[i] end
end
