// Synthetic signed-in menu checks. The browser is limited to the local fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {launchBrowser}=require('./browser.cjs');
const {setFixtureHandler,serveFixture,redirectFixtureAPI}=require('./fixture-api.cjs');

const user={id:'22222222-2222-4222-8222-222222222228',email:'admin-menu@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01',user_metadata:{},app_metadata:{provider:'email'}};
const home='11111111-1111-4111-8111-111111111118';
const exp=Math.floor(Date.now()/1000)+86400;
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:[b64({alg:'HS256',typ:'JWT'}),b64({exp,sub:user.id,aud:'authenticated',session_id:home}),'fixture'].join('.'),refresh_token:'fixture',expires_in:86400,expires_at:exp,token_type:'bearer',user};
const member={user_id:user.id,display_name:'Fixture Admin',role:'owner',household_id:home};

async function run(){
 const dist=path.resolve(process.env.HH_ADMIN_MENU_DIST||'dist');
 const server=http.createServer(async(req,res)=>{
  if(await serveFixture(req,res))return;
  const relative=new URL(req.url,'http://localhost').pathname.replace(/^\/hummel-home\//,'')||'index.html';
  const file=path.join(dist,relative);
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await launchBrowser();
  const url='http://127.0.0.1:'+server.address().port+'/hummel-home/';
  for(const state of ['authorized','ordinary','unavailable','signout']){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort('blockedbyclient'));
   await context.routeWebSocket('**/*',socket=>socket.close());
   await context.addInitScript(redirectFixtureAPI);
   await context.addInitScript(value=>{
    if(sessionStorage.getItem('admin-menu-fixture'))return;
    localStorage.setItem('hh-test:hh-test:home-together-auth',JSON.stringify(value));
    sessionStorage.setItem('admin-menu-fixture','1');
   },session);
   const {promise:adminCheck,resolve:checked}=Promise.withResolvers();
   const {promise:waitToReply,resolve:reply}=Promise.withResolvers();
   setFixtureHandler(async route=>{
    const req=route.request(),target=new URL(req.url()),name=target.pathname.split('/').pop();
    let data=[];
    if(target.pathname.startsWith('/auth/'))data=user;
    else if(target.pathname.includes('/functions/'))data={configured:false,connected:false,nativeReady:true};
    else if(name==='household_members')data=req.headers().accept?.includes('vnd.pgrst.object')?member:[member];
    else if(name==='households')data={id:home,name:'Fixture Home',owner_id:user.id};
    else if(name==='household_calendar_source')data='hh';
    else if(name==='household_transition_active')data=false;
    else if(name==='pilot_status')data={is_host:false};
    else if(name==='hh_admin_status'){
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     if(state==='signout'){checked(true);await waitToReply}
     await route.fulfill(state==='unavailable'?{status:404,json:{message:'Missing RPC'}}:
      {json:{is_admin:state!=='ordinary',requires_mfa:state!=='ordinary'}});
     checked(true);
     return;
    }
    await route.fulfill({json:data});
   });
   try{
    const page=await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(url);
    await page.getByRole('button',{name:'Open Settings',exact:true}).click();
    assert.equal(await Promise.race([adminCheck,delay(10000,false,{ref:false})]),true,`Admin status fixture was not reached for ${state}`);
    const link=page.getByRole('link',{name:/Admin Dashboard/});
    if(state==='signout'){
     await page.getByRole('button',{name:'Sign out',exact:true}).click();
     await page.getByRole('heading',{name:'Welcome home.'}).waitFor();
     reply();
     assert.equal(await link.count(),0);
    }else{
     if(state==='authorized'){
      await link.waitFor();
      assert.equal(await link.getAttribute('href'),'./admin.html');
      assert.equal(await link.getAttribute('target'),'_blank');
     }else assert.equal(await link.count(),0,state);
    }
   }finally{reply();await context.close()}
  }
 }finally{if(browser)await browser.close();server.close()}
}

run().then(()=>console.log('Admin menu checks passed: approved identity, ordinary account, unavailable access check and sign-out during authorization.')).catch(error=>{console.error(error);process.exitCode=1});
