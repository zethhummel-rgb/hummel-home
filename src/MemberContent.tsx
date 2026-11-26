import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {authNamespace} from './config';
import {isSeasonalPalette,type SeasonalPaletteId} from './palettes';
import {isCurrentAuthClient,supabase} from './supabase';
import './member-content.css';

type MemberNotice={id:string;kind:'notice'|'update';title:string;body:string;published_at:string};
type MemberContent={notices:MemberNotice[];seasons:SeasonalPaletteId[]};
const emptyContent:MemberContent={notices:[],seasons:[]};

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
 const dismissed=dismissal.userId===userId?dismissal.ids:readDismissals(userId);
 const content=enabled&&snapshot?.client===client&&snapshot.userId===userId?snapshot.content:emptyContent;

 useEffect(()=>{
  if(!enabled)return;
  let active=true,loading=false;
  async function refresh(){
   if(loading||document.hidden||!navigator.onLine||!isCurrentAuthClient(client))return;
   loading=true;
   try{
    const {data:auth,error:sessionError}=await client.auth.getSession();
    if(sessionError||auth.session?.user.id!==userId||!active||!isCurrentAuthClient(client))return;
    const {data,error}=await client.rpc('hh_member_content');
    if(error||!active||!isCurrentAuthClient(client))return;
    const notices=Array.isArray(data?.notices)?data.notices.filter(isMemberNotice):[];
    const seasons=Array.isArray(data?.seasonal_palettes)?[...new Set<SeasonalPaletteId>(data.seasonal_palettes.filter(isSeasonalPalette))]:[];
    setSnapshot({client,userId,content:{notices,seasons}});
   }catch{/* Notices and seasonal choices are optional when HH is offline or unavailable. */}
   finally{loading=false}
  }
  void refresh();
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  window.addEventListener('online',refresh);
  return()=>{
   active=false;
   document.removeEventListener('visibilitychange',refresh);
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

 return {notices:content.notices.filter(notice=>!dismissed.includes(notice.id)),seasons:content.seasons,dismiss};
}

const dateLabel=new Intl.DateTimeFormat('en-CA',{dateStyle:'medium'});

export function MemberNotices({notices,onDismiss}:{notices:MemberNotice[];onDismiss:(id:string)=>void}){
 if(!notices.length)return null;
 return <section className="member-notices" aria-label="Notices and updates from HH">
  {notices.map(notice=><article className="member-notice" key={notice.id}>
   <details>
    <summary><span><small>{notice.kind==='update'?'HH update':'HH notice'}</small><b>{notice.title}</b></span><ChevronDown size={16} aria-hidden="true"/></summary>
    <time dateTime={notice.published_at}>{dateLabel.format(new Date(notice.published_at))}</time>
    <p>{notice.body}</p>
   </details>
   <button type="button" aria-label={`Dismiss ${notice.title}`} onClick={event=>{
    const article=event.currentTarget.closest('article');
    const sibling=article?.nextElementSibling||article?.previousElementSibling;
    onDismiss(notice.id);
    sibling?.querySelector('summary')?.focus();
   }}>Dismiss</button>
  </article>)}
 </section>;
}
