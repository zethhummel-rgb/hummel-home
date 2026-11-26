import {useEffect,useState} from 'react';
import {authNamespace} from './config';
import MemberPopup from './MemberPopup';
import NoticeCard from './NoticeCard';
import {isSeasonalPalette,type SeasonalPaletteId} from './palettes';
import {isCurrentAuthClient,supabase} from './supabase';

type MemberNotice={id:string;kind:'notice'|'update';title:string;body:string;published_at:string};
type MemberContent={notices:MemberNotice[];seasons:SeasonalPaletteId[];expiries:Partial<Record<SeasonalPaletteId,number>>;ratingEligible:boolean};
type RatingInput={stars:number;comment:string;allow_quote:boolean};
const emptyContent:MemberContent={notices:[],seasons:[],expiries:{},ratingEligible:false};

function isMemberNotice(value:unknown):value is MemberNotice{
 if(!value||typeof value!=='object')return false;
 const notice=value as Partial<MemberNotice>;
 return typeof notice.id==='string'&&(notice.kind==='notice'||notice.kind==='update')&&typeof notice.title==='string'
  &&typeof notice.body==='string'&&typeof notice.published_at==='string'&&Number.isFinite(Date.parse(notice.published_at));
}

const dismissalKey=(userId:string)=>`${authNamespace}hh:member-notice-dismissals:${userId}`;

function readDismissals(userId:string):string[]{
 try{
  const saved=JSON.parse(localStorage.getItem(dismissalKey(userId))||'[]');
  return Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[];
 }catch{return []}
}

export function useMemberContent(userId:string,enabled:boolean){
 const client=supabase;
 const [snapshot,setSnapshot]=useState<{client:typeof client;userId:string;content:MemberContent}|null>(null);
 const [dismissal,setDismissal]=useState(()=>({userId,ids:readDismissals(userId)}));
 const [completedRatingFor,setCompletedRatingFor]=useState<string>();
 const [themeClock,setThemeClock]=useState(()=>Date.now());
 const dismissed=dismissal.userId===userId?dismissal.ids:readDismissals(userId);
 const content=enabled&&snapshot?.client===client&&snapshot.userId===userId?snapshot.content:emptyContent;

 useEffect(()=>{
  if(!enabled)return;
  let active=true,loading=false;
  let boundary:number|undefined;
  async function refresh(){
   setThemeClock(Date.now());
   if(loading||document.hidden||!navigator.onLine||!isCurrentAuthClient(client))return;
   loading=true;
   try{
    const {data:auth,error:sessionError}=await client.auth.getSession();
    if(sessionError||auth.session?.user.id!==userId||!active||!isCurrentAuthClient(client))return;
    const {data,error}=await client.rpc('hh_member_content');
    if(error||!active||!isCurrentAuthClient(client))return;
    const notices=Array.isArray(data?.notices)?data.notices.filter(isMemberNotice):[];
    const seasons=Array.isArray(data?.seasonal_palettes)?[...new Set<SeasonalPaletteId>(data.seasonal_palettes.filter(isSeasonalPalette))]:[];
    const expiries:MemberContent['expiries']={};
    for(const id of seasons){
     const end=Date.parse(data?.palette_expiries?.[id]);
     if(Number.isFinite(end))expiries[id]=end;
    }
    setSnapshot({client,userId,content:{notices,seasons,expiries,ratingEligible:data?.rating_eligible===true}});
    window.clearTimeout(boundary);
    const wait=Date.parse(data?.next_palette_change_at)-Date.now();
    if(Number.isFinite(wait)&&wait>0)boundary=window.setTimeout(refresh,Math.min(wait+100,2_000_000_000));
   }catch{/* Notices and seasonal choices are optional when HH is offline or unavailable. */}
   finally{loading=false}
  }
  void refresh();
  const poll=window.setInterval(()=>void refresh(),60_000);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('pageshow',refresh);
  window.addEventListener('focus',refresh);
  window.addEventListener('online',refresh);
  return()=>{
   active=false;
   window.clearInterval(poll);
   window.clearTimeout(boundary);
   document.removeEventListener('visibilitychange',refresh);
   window.removeEventListener('pageshow',refresh);
   window.removeEventListener('focus',refresh);
   window.removeEventListener('online',refresh);
  };
 },[client,userId,enabled]);

 useEffect(()=>{
  function sync(event:StorageEvent){
   if(event.key===dismissalKey(userId)||event.key===null)setDismissal({userId,ids:readDismissals(userId)});
  }
  window.addEventListener('storage',sync);
  return()=>window.removeEventListener('storage',sync);
 },[userId]);

 function dismiss(id:string){
  const ids=[...new Set([...readDismissals(userId),...dismissed,id])];
  setDismissal({userId,ids});
  try{localStorage.setItem(dismissalKey(userId),JSON.stringify(ids))}catch{/* Keep the dismissal for this visit. */}
 }

 async function completeRating(input?:RatingInput){
  const {data:auth,error:authError}=await client.auth.getSession();
  if(authError||auth.session?.user.id!==userId||!isCurrentAuthClient(client))throw Error('Open HH and sign in again to continue.');
  const {data,error}=await client.rpc('hh_member_rating',{action:input?'submit':'dismiss',payload:input??{}});
  if(error||data?.completed!==true||!isCurrentAuthClient(client))throw Error('HH could not save your choice. Please try again.');
  setCompletedRatingFor(userId);
 }

 return {
  notices:content.notices.filter(notice=>!dismissed.includes(notice.id)),
  seasons:content.seasons.filter(id=>themeClock<(content.expiries[id]??Infinity)),
  ratingEligible:content.ratingEligible&&completedRatingFor!==userId,
  dismiss,completeRating,
 };
}

export function MemberNotices({notices,ready,onDismiss}:{notices:MemberNotice[];ready:boolean;onDismiss:(id:string)=>void}){
 const [openId,setOpenId]=useState<string>();
 const notice=notices.find(item=>item.id===openId)??notices[0];
 return ready&&notice?<NoticeDialog key={notice.id} notice={notice} onOpen={setOpenId} onDismiss={onDismiss}/>:null;
}

function NoticeDialog({notice,onOpen,onDismiss}:{notice:MemberNotice;onOpen:(id:string)=>void;onDismiss:(id:string)=>void}){
 return <MemberPopup onOpen={()=>onOpen(notice.id)} onCancel={()=>onDismiss(notice.id)}>
  {({headingId,headingRef})=><NoticeCard kind={notice.kind} title={notice.title} body={notice.body} publishedAt={notice.published_at} headingId={headingId} headingRef={headingRef}
   action={<button className="button primary" type="button" onClick={()=>onDismiss(notice.id)}>Got it</button>}/>}
 </MemberPopup>;
}
