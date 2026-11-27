import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(source,globals={}){const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const context={exports:{},...globals};vm.runInNewContext(code,context);return context.exports;}
const config=(env={},path='/hh-family/',hostname='zethhummel-rgb.github.io')=>load(read('src/config.ts').replace('import.meta.env',JSON.stringify(env)),{location:{hostname,pathname:path}});
assert.equal(config({},'/','app.hhfamily.ca').publicConfig.url,'https://njpdqiwrwgoothkstoql.supabase.co');
assert.equal(config({VITE_APP_ENV:'test'},'/','test.hhfamily.ca').publicConfig.url,'https://ybizqfghnplcxlmlhvyn.supabase.co');
assert.throws(()=>config({},'/','test.hhfamily.ca'));
assert.throws(()=>config({VITE_APP_ENV:'test'},'/','app.hhfamily.ca'));
assert.throws(()=>config({VITE_SUPABASE_URL:'https://wrong.supabase.co'},'/','app.hhfamily.ca'));
assert.equal(config().publicConfig.url,'https://njpdqiwrwgoothkstoql.supabase.co');
assert.equal(config({VITE_APP_ENV:'test'},'/hummel-home/').publicConfig.url,'https://ybizqfghnplcxlmlhvyn.supabase.co');
assert.throws(()=>config({VITE_APP_ENV:'test',VITE_SUPABASE_URL:'https://njpdqiwrwgoothkstoql.supabase.co'},'/hummel-home/'));
assert.throws(()=>config({VITE_SUPABASE_URL:'https://ybizqfghnplcxlmlhvyn.supabase.co'}));
assert.throws(()=>config({},'/hummel-home/'));assert.throws(()=>config({VITE_APP_ENV:'test'},'/hh-family/'));
const {createLoginStorage}=load(read('src/loginStorage.ts')),{createAccountSwitchStorage}=load(read('src/accountSwitchStorage.ts'));
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
const local=memory(),tab=memory();
const prod=createLoginStorage(()=>local,()=>tab,()=> 'prod',()=>{},''),test=createLoginStorage(()=>local,()=>tab,()=> 'test',()=>{},'hh-test:');
for(const login of [prod,test])login.options().storage.setItem(login.options().storageKey,login===prod?'production-session':'test-session');
const prodOptions=prod.options();test.options().storage.removeItem(test.options().storageKey);
assert.equal(prodOptions.storage.getItem(prodOptions.storageKey),'production-session');assert.notEqual(prod.options().storageKey,test.options().storageKey);
test.select(false);assert.equal(prod.remember,true);
const prodAccounts=createAccountSwitchStorage(prod,()=> 'p'),testAccounts=createAccountSwitchStorage(test,()=> 't','hh-test:');
for(const email of ['zethhummel@gmail.com','hummelhomeapp@gmail.com'])assert.notEqual(prodAccounts.keyFor(email,true),testAccounts.keyFor(email,true));
test.visit.setItem('hh:account-links:v1','test-only');assert.equal(prod.visit.getItem('hh:account-links:v1'),null);
// Execute the actual test handlers; external integrations must be rejected before any fetch.
async function edge(name,action,path='',origin='https://zethhummel-rgb.github.io',method=path?'GET':'POST',env={}){
 let handler;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{role:'owner',user_id:'tester'},error:null})};
 const admin={auth:{getUser:async()=>({data:{user:{id:'tester',email:'tester@example.invalid'}},error:null})},from:()=>q,rpc:async()=>({data:{nativeReady:true,googleConnected:false,copyStatus:'disconnected'},error:null})};
 const source=ts.transpileModule(read('supabase/functions/'+name+'/index.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const modules={
  './handler.ts':load(read('supabase/functions/event-addresses/handler.ts'),{Response,fetch:()=>{throw Error('External fetch must not happen')}}),
  './import.ts':load(read('supabase/functions/google-calendar/import.ts'),{URL,URLSearchParams,Response,crypto,TextEncoder,require:()=>({})}),
  './personal.ts':load(read('supabase/functions/google-calendar/personal.ts'),{URL,URLSearchParams,Response}),
 };
 vm.runInNewContext(source,{exports:{},require:path=>modules[path]||new Proxy({createClient:()=>admin},{get:(obj,key)=>obj[key]||(()=>undefined)}),Deno:{env:{get:k=>({SUPABASE_URL:'https://ybizqfghnplcxlmlhvyn.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-key',HH_EMAIL_APP_PASSWORD:'fake-password-16',GOOGLE_CALENDAR_CLIENT_ID:'old-config',GOOGLE_CALENDAR_CLIENT_SECRET:'old-secret',...env})[k]},serve:f=>handler=f},URL,URLSearchParams,Response,Request,fetch:()=>{throw Error('External fetch must not happen')},console});
 return handler(new Request('https://ybizqfghnplcxlmlhvyn.supabase.co/functions/v1/'+name+path,{method,headers:{origin,authorization:'Bearer fake-session','content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({action,householdId:'11111111-1111-4111-8111-111111111111',kind:'family',token:'a'.repeat(64)})}:{})}));
}
for(const [marker,expected] of [['','https://zethhummel-rgb.github.io/hummel-home/'],['test_','https://test.hhfamily.ca/']]){
 const state='hhi_'+marker+'a'.repeat(43);
 const response=await edge('google-calendar','','/callback?'+new URLSearchParams({state,error:'access_denied'}),undefined,undefined,{
  TEST_GOOGLE_CALENDAR_CLIENT_ID:'test',TEST_GOOGLE_CALENDAR_CLIENT_SECRET:'test',
 });
 assert.equal(response.status,303);
 const target=new URL(response.headers.get('Location'));
 assert.equal(target.origin+target.pathname,expected);
 assert.equal(target.searchParams.get('calendar_import'),'error');
 assert.equal(target.hash,'');
}
for(const name of ['invitation-registration','invitation-email','event-guests','request-pilot-invitation','send-feedback','admin-households','self-service-deletion','event-addresses','event-reminders','google-calendar','outlook-calendar']){
 for(const origin of ['https://zethhummel-rgb.github.io','https://test.hhfamily.ca']){
  const preflight=await edge(name,'','',origin,'OPTIONS');
  assert.ok(preflight.ok,name);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin,name);
 }
 for(const origin of ['https://app.hhfamily.ca','https://test.hhfamily.ca.example.invalid']){
  const preflight=await edge(name,'','',origin,'OPTIONS');
  assert.equal(preflight.status,name==='outlook-calendar'?404:403,name);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),null,name);
 }
}
const code='test-code';
for(const [name,prefix,field,env] of [
 ['google-calendar','hhp_','personal_calendar',{TEST_GOOGLE_CALENDAR_CLIENT_ID:'test',TEST_GOOGLE_CALENDAR_CLIENT_SECRET:'test'}],
 ['outlook-calendar','','outlook',{}]
]){
 for(const [marker,expected] of [['','https://zethhummel-rgb.github.io/hummel-home/'],['test_','https://test.hhfamily.ca/']]){
  const state=prefix+marker+'a'.repeat(43);
  const response=await edge(name,'','/callback?'+new URLSearchParams({state,code}),undefined,undefined,env);
  assert.equal(response.status,303,name);
  const target=new URL(response.headers.get('Location'));
  assert.equal(target.origin+target.pathname,expected,name);
  const receipt=new URLSearchParams(target.hash.slice(1));
  assert.equal(receipt.get(field+'_state'),state,name);
  assert.equal(receipt.get(field+'_code'),code,name);
 }
}
for(const action of ['start','sync','import_start','import_finish'])assert.equal((await edge('google-calendar',action)).status,409);
assert.equal((await edge('google-calendar','', '/callback')).status,409);
for(const action of ['test','subscribe','dispatch'])assert.equal((await edge('event-reminders',action)).status,409);
assert.equal((await edge('invitation-email','send')).status,409);assert.equal((await (await edge('invitation-email','status')).json()).configured,false);
console.log('Staging checks passed: backend/host mismatch refusal, independent login storage and channels, account-switch isolation, server environment binding.');
