import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const store = new Map();
const now = {user:'a',key:'login',member:true,online:true,transition:false,timeout:false};
const home='home', rows = new Map();
const item = (id,version=1,done=false) => ({id,household_id:home,kind:'grocery',category:'Produce',title:id,reminder_version:version,done});
function identity(user){now.user=user;store.set(now.key,JSON.stringify({user:{id:user}}));}
identity('a');
const backing={getItem:key=>store.get(key)??null,setItem:(key,val)=>store.set(key,val),removeItem:key=>store.delete(key)};
const locks={request:async (name,opts,fn)=>(fn||opts)({name})};
let writes=0;
const client={
 auth:{getSession:async()=>({data:{session:{user:{id:now.user}}}})},
 rpc:()=>({abortSignal:async()=>({data:now.transition})}),
 from(table){
   const filters={};let patch;
   const query={
     eq(key,value){filters[key]=value;return this},select(){return this},abortSignal(){return this},
     update(value){patch=value;return this},order(){return this},
     async maybeSingle(){
       if(table==='household_members')return {data:now.member?{household_id:home}:null};
       const record=rows.get(filters.id);
       if(!record||!Object.entries(filters).every(([k,v])=>record[k]===v))return {data:null};
       if(patch){Object.assign(record,patch);record.reminder_version++;writes++;
         if(now.timeout){now.timeout=false;return {error:Error('lost response')};}}
       return {data:{...record}};
     },
     then(resolve){resolve({data:[...rows.values()]})}
   };return query;
 }
};
const mod={};
const mocks={'./config':{authNamespace:'test'},'./supabase':{supabase:client,accountStorage:{store:()=>backing},
 activeAccountStorageCurrent:()=>true,currentAccountStorage:()=>({key:now.key,remember:true})}};
vm.runInNewContext(ts.transpileModule(read('src/offlineShopping.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,
 {exports:mod,require:n=>mocks[n],navigator:{locks,get onLine(){return now.online}},window:{dispatchEvent(){}},Event,AbortSignal,crypto});
for(const id of ['Milk','Bread','Eggs'])rows.set(id,item(id));
await mod.saveGroceries('a',home,'Test',[...rows.values(),{...item('secret task'),kind:'task'}]);
assert.equal(mod.savedTrip().rows.length,3);
now.online=false;
await mod.pickItem(mod.savedTrip(),'Milk',true);
await mod.syncTrip(mod.savedTrip());
assert.equal(writes,0);
assert.equal(mod.savedTrip().picks.Milk.done,true);
identity('b');assert.equal(mod.savedTrip(),null);identity('a');
await mod.pickItem(mod.savedTrip(),'Bread',true);
await mod.pickItem(mod.savedTrip(),'Eggs',true);
rows.delete('Bread');rows.get('Eggs').reminder_version++;
now.online=true;now.timeout=true;
await assert.rejects(mod.syncTrip(mod.savedTrip()));
assert.equal(rows.get('Milk').done,true);
await mod.syncTrip(mod.savedTrip());
assert.equal(writes,1,'lost acknowledgement must not apply a second write');
assert.equal(Object.keys(mod.savedTrip().picks).length,0);
assert.equal(mod.savedTrip().rows.find(r=>r.id==='Eggs').done,false);
assert.equal(mod.savedTrip().notices.length,2);
await mod.pickItem(mod.savedTrip(),'Milk',false);
now.transition=true;await assert.rejects(mod.syncTrip(mod.savedTrip()),/transfer/);assert.equal(writes,1);
now.transition=false;now.member=false;await mod.syncTrip(mod.savedTrip());
assert.equal(mod.savedTrip(),null);assert.equal(writes,1);
console.log('Offline grocery checks passed: saved list, scoped access, offline picks, lost acknowledgement, conflicts, removals and revoked membership.');
