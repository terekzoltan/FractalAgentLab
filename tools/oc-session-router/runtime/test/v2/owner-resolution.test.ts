import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { OperationStore } from "../../src/v2/state-store.js";
import { resolveOwnerStopped, type OwnerStoppedRequest } from "../../src/v2/owner-resolution.js";
import { textSha256 } from "../../src/v2/manual-continuation.js";
import type { AdapterReply, OpenCodeMessage } from "../../src/v2/opencode-adapter.js";
import type { ReconcileReader } from "../../src/v2/reconcile.js";
import { operationView } from "../../src/v2/cli.js";
const ok = <T>(value: T): AdapterReply<T> => ({status:200,bodySha256:"fixture",value});
function fixture(t: TestContext) {
 const dir=mkdtempSync(path.join(process.cwd(),'.owner-stop-'));
 const store=new OperationStore(path.join(dir,'router.sqlite'));
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 store.openWork({workId:'w',target:'t',directory:dir,instructionReference:'owner',scope:'bounded implement',allowedEffects:['WORKSPACE_WRITE'],stoppingPoint:'stop'});
 const action={workId:'w',actionKey:'implement',participant:{namespace:'n',project:'p',session:'ses_b'},recipientRole:'Track B',kind:'LIFECYCLE' as const,effect:'WORKSPACE_WRITE' as const,command:'implement',predecessor:null,input:{address:{origin:'http://127.0.0.1:1',directory:dir,session:'ses_b'}}};
 let op=store.prepareAction(action).operation;store.startDispatch(op.operationId);
 op=store.acknowledge(op.operationId,{rootMessageId:op.messageId,responseMessageId:'msg_old_response'});
 const now=Date.now()+1000;
 const parent:OpenCodeMessage={id:'msg_manual',session:'ses_b',role:'user',timeCreated:now,text:'Continue source authoring',hasCompactionPart:false};
 const terminal:OpenCodeMessage={id:'msg_terminal',session:'ses_b',role:'assistant',parentId:parent.id,timeCreated:now+1,timeCompleted:now+2,finish:'stop',text:'Stopped at entry. No source authored. IMPLEMENT_BLOCKED',hasCompactionPart:false};
 const state={busy:false,originalStatus:404,mutate:false,race:false,reads:0};
 const head=[parent,terminal];
 const adapter:ReconcileReader={getSession:async()=>ok({id:'ses_b',projectID:'p',directory:dir}),getStatus:async()=>ok(state.busy?'BUSY':'IDLE'),
 getMessage:async id=>id===op.messageId||id==='msg_old_response'?{status:state.originalStatus,bodySha256:'missing',problem:'HTTP_ERROR'}:ok(structuredClone(id===parent.id?parent:terminal)),
 getHistory:async()=>{state.reads++;if(state.race)store.observe(op.operationId,{observedAt:new Date().toISOString(),activity:'IDLE'});return ok({messages:structuredClone(head).map(m=>state.mutate&&state.reads>1?{...m,text:'changed'}:m)});}};
 const request:OwnerStoppedRequest={operationId:op.operationId,expectedInputDigest:op.inputDigest,terminalMessageId:terminal.id,terminalTextSha256:textSha256(terminal.text),instructionReference:'owner:explicit-stop',ownerDecision:'I accept this exact reply as proof of no implementation and waive native lineage proof.',disposition:'STOPPED_BEFORE_IMPLEMENTATION',acknowledgeUnverifiedNativeLineage:true};
 return {store,op,request,adapter,state,terminal,parent,head,action};
}
test('Owner negative resolution preserves history/pause, labels limitations and releases only this claim',async t=>{
 const f=fixture(t);
 const other=f.store.prepareAction({...f.action,workId:'w',actionKey:'other',participant:{...f.action.participant,session:'ses_other'}});
 f.store.recordOwnerPause('w',true,'preserved hold');
 const result=await resolveOwnerStopped(f.store,f.request,f.adapter);
 assert.equal(result.outcome?.execution,'FAILED');
 assert.equal(result.outcome?.reason,'OWNER_RESOLVED_STOPPED_BEFORE_IMPLEMENTATION');
 assert.deepEqual(result.correlation,f.op.correlation);
 assert.equal(result.messageId,f.op.messageId);assert.equal(result.inputDigest,f.op.inputDigest);
 assert.equal(result.outcome?.response,undefined);
 assert.equal(result.outcome?.artifact?.text,f.terminal.text);
 assert.equal(result.outcome?.ownerResolution?.nativeLineageRestored,false);
 assert.equal(result.outcome?.ownerResolution?.exhaustiveHistoryVerified,false);
 assert.equal(f.store.getWork('w').paused,true);
 assert.equal(f.store.getOperation(other.operation.operationId).completedAt,null);
 assert.equal(operationView(result).ownerResolution?.implementationAccepted,false);
 assert.equal((await resolveOwnerStopped(f.store,f.request,f.adapter)).resultDigest,result.resultDigest);
 await assert.rejects(resolveOwnerStopped(f.store,{...f.request,ownerDecision:'different'},f.adapter));
 f.store.recordOwnerPause('w',false,'owner resume');
 assert.equal(f.store.prepareAction({...f.action,actionKey:'new-plan'}).created,true);
 assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'other-duplicate',participant:{...f.action.participant,session:'ses_other'}}));
});

for(const scenario of ['wrong-input','wrong-hash','busy','503','original-present','changed-history','race','native-parent','later-user','missing-owner','wrong-disposition','wrong-session','nonterminal']) {
 test(`negative resolution rejects ${scenario}`,async t=>{
  const f=fixture(t);
  if(scenario==='wrong-input')f.request.expectedInputDigest='0'.repeat(64);
  if(scenario==='wrong-hash')f.request.terminalTextSha256='0'.repeat(64);
  if(scenario==='busy')f.state.busy=true;
  if(scenario==='503')f.state.originalStatus=503;
  if(scenario==='original-present')f.state.originalStatus=200;
  if(scenario==='changed-history')f.state.mutate=true;
  if(scenario==='race')f.state.race=true;
  if(scenario==='native-parent')f.terminal.parentId=f.op.messageId;
  if(scenario==='later-user')f.head.push({...f.parent,id:'msg_new_user',timeCreated:f.terminal.timeCreated!+1});
  if(scenario==='missing-owner')f.request.ownerDecision='';
  if(scenario==='wrong-disposition')f.request.disposition='SUCCESS' as never;
  if(scenario==='wrong-session')f.terminal.session='ses_other';
  if(scenario==='nonterminal')f.terminal.finish='tool-calls';
  await assert.rejects(resolveOwnerStopped(f.store,f.request,f.adapter));
  assert.equal(f.store.getOperation(f.op.operationId).resultDigest,null);
  assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'still-claimed'}));
 });
}
test('POSSIBLE dispatch is not eligible for Owner stopped resolution',async t=>{
 const f=fixture(t);const other=f.store.prepareAction({...f.action,actionKey:'possible',participant:{...f.action.participant,session:'ses_other'}}).operation;
 f.store.startDispatch(other.operationId);
 await assert.rejects(resolveOwnerStopped(f.store,{...f.request,operationId:other.operationId,expectedInputDigest:other.inputDigest},f.adapter));
 assert.equal(f.store.getOperation(other.operationId).acknowledgedAt,null);
});
test('resolution result and claim release roll back together on a write failure',async t=>{
 const f=fixture(t), crashing=new OperationStore(f.store.databasePath,{checkpoint:p=>{if(p==='RESULT_INSERTED')throw Error('fixture crash');}});
 try{await assert.rejects(resolveOwnerStopped(crashing,f.request,f.adapter));}finally{crashing.close();}
 assert.equal(f.store.getOperation(f.op.operationId).resultDigest,null);
 assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'still-claimed'}));
});
