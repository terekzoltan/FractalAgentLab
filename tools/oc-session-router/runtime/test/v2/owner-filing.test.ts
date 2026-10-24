import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { OperationStore } from "../../src/v2/state-store.js";
import { resolveOwnerFiling, type OwnerFilingRequest } from "../../src/v2/owner-filing.js";
import { textSha256 } from "../../src/v2/manual-continuation.js";
import type { AdapterReply, OpenCodeMessage, OpenCodeAdapter } from "../../src/v2/opencode-adapter.js";
import type { ReconcileReader } from "../../src/v2/reconcile.js";
import { operationView } from "../../src/v2/cli.js";
const ok = <T>(value: T): AdapterReply<T> => ({status:200,bodySha256:"fixture",value});
function fixture(t: TestContext) {
 const dir=mkdtempSync(path.join(process.cwd(),'.router-v2-owner-filing-'));
 mkdirSync(path.join(dir,'ops'));writeFileSync(path.join(dir,'ops/STATE.md'),'filed');
 const store=new OperationStore(path.join(dir,'router.sqlite'));
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 store.openWork({workId:'w',target:'t',directory:dir,instructionReference:'owner',scope:'documentation',allowedEffects:['WORKSPACE_WRITE'],stoppingPoint:'stop'});
 const action={workId:'w',actionKey:'filing',participant:{namespace:'n',project:'p',session:'ses_meta'},recipientRole:'Meta',kind:'CLARIFICATION' as const,effect:'WORKSPACE_WRITE' as const,command:'clarification',predecessor:null,input:{arguments:'File approved facts only',address:{origin:'http://127.0.0.1:1',directory:dir,session:'ses_meta'}}};
 let op=store.prepareAction(action).operation;store.startDispatch(op.operationId);op=store.acknowledge(op.operationId,{rootMessageId:op.messageId});
 const now=Date.now()+1000;
 const parent:OpenCodeMessage={id:'msg_separate',session:'ses_meta',role:'user',timeCreated:now,text:action.input.arguments,hasCompactionPart:false};
 const terminal:OpenCodeMessage={id:'msg_terminal',session:'ses_meta',role:'assistant',parentId:parent.id,timeCreated:now+1,timeCompleted:now+2,finish:'stop',text:'Facts filing complete',hasCompactionPart:false};
 const state={busy:false,originalStatus:404,mutate:false,race:false,reads:0,permission:0};
 const head=[parent,terminal];
 const adapter:ReconcileReader & Pick<OpenCodeAdapter,"getPendingInteractions">={getSession:async()=>ok({id:'ses_meta',projectID:'p',directory:dir}),getStatus:async()=>ok(state.busy?'BUSY':'IDLE'),
 getPendingInteractions:async()=>({permissions:state.permission,questions:0}),
 getMessage:async id=>id===op.messageId?{status:state.originalStatus,bodySha256:'missing',problem:'HTTP_ERROR'}:ok(structuredClone(id===parent.id?parent:terminal)),
 getHistory:async()=>{state.reads++;if(state.race)store.observe(op.operationId,{observedAt:new Date().toISOString(),activity:'IDLE'});return ok({messages:structuredClone(head).map(m=>state.mutate&&state.reads>1?{...m,text:'changed'}:m)});}};
 const request:OwnerFilingRequest={operationId:op.operationId,expectedInputDigest:op.inputDigest,terminalMessageId:terminal.id,terminalTextSha256:textSha256(terminal.text),instructionReference:'owner:filing',ownerDecision:'Accept this documentation filing without asserting native lineage.',disposition:'ACCEPT_DOCUMENTATION_FILING',acknowledgeUnverifiedNativeLineage:true,files:[{path:'ops/STATE.md',sha256:textSha256('filed')}]};
 return {store,op,request,adapter,state,terminal,parent,head,action,dir};
}
test('check is read-only; adoption retains provenance, pause, immutable input and unrelated claims',async t=>{
 const f=fixture(t);
 const other=f.store.prepareAction({...f.action,actionKey:'other',participant:{...f.action.participant,session:'ses_other'}}).operation;
 f.store.recordOwnerPause('w',true,'owner hold');
 const input=JSON.stringify(f.store.getOperation(f.op.operationId));
 const ro=new OperationStore(f.store.databasePath,{readOnly:true});
 try {await resolveOwnerFiling(ro,f.request,f.adapter,false);}finally{ro.close();}
 assert.equal(JSON.stringify(f.store.getOperation(f.op.operationId)),input);
 const result=await resolveOwnerFiling(f.store,f.request,f.adapter);
 assert.equal(result.outcome?.execution,'COMPLETED');assert.equal(result.outcome?.response,undefined);
 assert.equal(result.outcome?.artifact?.text,f.terminal.text);
 assert.equal(result.outcome?.ownerFiling?.nativeLineageRestored,false);
 assert.equal(result.outcome?.ownerFiling?.manualContinuationAsserted,false);
 assert.equal(result.outcome?.ownerFiling?.productAcceptance,false);
 assert.equal(operationView(result).ownerFiling?.disposition,'ACCEPT_DOCUMENTATION_FILING');
 assert.equal(operationView(result).ownerResolution,null);
 assert.deepEqual(result.correlation,f.op.correlation);assert.equal(result.inputDigest,f.op.inputDigest);
 assert.equal(f.store.getWork('w').paused,true);assert.equal(f.store.getOperation(other.operationId).completedAt,null);
 assert.equal(readFileSync(path.join(f.dir,'ops/STATE.md'),'utf8'),'filed');
 assert.equal((await resolveOwnerFiling(f.store,f.request,f.adapter)).resultDigest,result.resultDigest);
 await assert.rejects(resolveOwnerFiling(f.store,{...f.request,ownerDecision:'changed'},f.adapter));
 f.store.recordOwnerPause('w',false,'test only');
 assert.equal(f.store.prepareAction({...f.action,actionKey:'next'}).created,true);
 assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'other-next',participant:{...f.action.participant,session:'ses_other'}}));
});
for(const scenario of ['wrong-input','wrong-hash','busy','permission','503','original-present','changed-history','race','native-parent','later-user','competing-terminal','missing-owner','wrong-disposition','wrong-session','nonterminal','different-prompt','file-drift','traversal','duplicate-file','oversize-head']) {
 test(`filing rejects ${scenario}`,async t=>{
  const f=fixture(t);
  if(scenario==='wrong-input')f.request.expectedInputDigest='0'.repeat(64);
  if(scenario==='wrong-hash')f.request.terminalTextSha256='0'.repeat(64);
  if(scenario==='busy')f.state.busy=true;
  if(scenario==='permission')f.state.permission=1;
  if(scenario==='503')f.state.originalStatus=503;
  if(scenario==='original-present')f.state.originalStatus=200;
  if(scenario==='changed-history')f.state.mutate=true;
  if(scenario==='race')f.state.race=true;
  if(scenario==='native-parent')f.terminal.parentId=f.op.messageId;
  if(scenario==='later-user')f.head.push({...f.parent,id:'msg_new_user',timeCreated:f.terminal.timeCreated!+1});
  if(scenario==='competing-terminal')f.head.unshift({...f.terminal,id:'msg_competing',timeCreated:f.terminal.timeCreated!-1});
  if(scenario==='missing-owner')f.request.ownerDecision='';
  if(scenario==='wrong-disposition')f.request.disposition='SUCCESS' as never;
  if(scenario==='wrong-session')f.terminal.session='ses_other';
  if(scenario==='nonterminal')f.terminal.finish='tool-calls';
  if(scenario==='different-prompt')f.parent.text='Different task';
  if(scenario==='file-drift')writeFileSync(path.join(f.dir,'ops/STATE.md'),'changed');
  if(scenario==='traversal')f.request.files[0]!.path='ops/../outside.md';
  if(scenario==='duplicate-file')f.request.files.push(f.request.files[0]!);
  if(scenario==='oversize-head')for(let i=0;i<12;i++)f.head.unshift({...f.parent,id:`msg_${i}`,timeCreated:1});
  await assert.rejects(resolveOwnerFiling(f.store,f.request,f.adapter));
  assert.equal(f.store.getOperation(f.op.operationId).resultDigest,null);
  assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'still-claimed'}));
 });
}
test('lifecycle implementation and POSSIBLE delivery cannot use filing acceptance',async t=>{
 const f=fixture(t);
 for(const kind of ['LIFECYCLE','CLARIFICATION'] as const){
  const other=f.store.prepareAction({...f.action,actionKey:kind,kind,participant:{...f.action.participant,session:`ses_${kind}`}}).operation;
  f.store.startDispatch(other.operationId);
  if(kind==='LIFECYCLE')f.store.acknowledge(other.operationId,{rootMessageId:other.messageId});
  await assert.rejects(resolveOwnerFiling(f.store,{...f.request,operationId:other.operationId,expectedInputDigest:other.inputDigest},f.adapter));
 }
});
test('atomic finish failure preserves pending result and claim',async t=>{
 const f=fixture(t), crashing=new OperationStore(f.store.databasePath,{checkpoint:p=>{if(p==='RESULT_INSERTED')throw Error('fixture crash');}});
 try{await assert.rejects(resolveOwnerFiling(crashing,f.request,f.adapter));}finally{crashing.close();}
 assert.equal(f.store.getOperation(f.op.operationId).resultDigest,null);
 assert.throws(()=>f.store.prepareAction({...f.action,actionKey:'still-claimed'}));
});
