import type {ReactNode,Ref} from 'react';
import {Bell,Sparkles} from 'lucide-react';
import './member-content.css';

const dates=new Intl.DateTimeFormat('en-CA',{dateStyle:'medium'});

export default function NoticeCard({kind,title,body,publishedAt,headingId,headingRef,action}:{
 kind:'notice'|'update';title:string;body:string;publishedAt:string;headingId?:string;
 headingRef?:Ref<HTMLHeadingElement>;action:ReactNode;
}){
 const update=kind==='update';
 const Icon=update?Sparkles:Bell;
 return <>
  <header className="member-notice-header">
   <span className="member-notice-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.6}/></span>
   <h2 id={headingId} ref={headingRef} tabIndex={headingRef?-1:undefined}>{update?'App update':'Notice'}</h2>
  </header>
  <section className="member-notice-copy">
   <h3>{title}</h3>
   <time dateTime={publishedAt}>{dates.format(new Date(publishedAt))}</time>
   <p>{body}</p>
  </section>
  <footer className="member-notice-footer">{action}</footer>
 </>;
}
