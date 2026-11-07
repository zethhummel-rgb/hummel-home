import {useCallback, useEffect, useRef, useState} from 'react';
import {savedTrip,pickItem,clearNotices,syncTrip,tripEvent,tripOpen,prepareShoppingShell,saveGroceries} from './offlineShopping';
import type {ReminderItem} from './taskReminders';
import './shopping-mode.css';

export function ShoppingEntry({user,home,name,items,ready}:{user:string;home:string;name:string;items:ReminderItem[];ready:boolean}) {
  const [available,setAvailable] = useState(false);
  const [problem,setProblem] = useState('');
  useEffect(() => {
    let alive = true;
    if (ready) {
      Promise.all([prepareShoppingShell(),saveGroceries(user,home,name,items)]).then(() => {
        if (alive) { setAvailable(true); setProblem(''); }
      }).catch(() => { if (alive) {setAvailable(false);setProblem('This browser could not save the list for offline shopping.');} });
    }
    return () => {alive=false;};
  },[user,home,name,items,ready]);
  return <div className="shopping-entry" data-shopping-ready={available}>
    <button type="button" className="text-button" disabled={!available} onClick={()=>window.dispatchEvent(new Event(tripOpen))}>Open shopping mode</button>
    <small>{problem || (available ? 'List saved on this device for offline shopping.' : 'Preparing your offline list…')}</small>
  </div>;
}

export default function ShoppingMode({leave}:{leave:()=>void}) {
  const [trip,setTrip] = useState(savedTrip);
  const [online,setOnline] = useState(navigator.onLine);
  const [syncing,setSyncing] = useState(false);
  const [error,setError] = useState('');
  const working = useRef(false);
  const mounted = useRef(false);
  const sync = useCallback(async () => {
    const current = savedTrip();
    if (!current || working.current || !navigator.onLine) return;
    working.current = true;
    setSyncing(true);
    try {await syncTrip(current);if(mounted.current)setError('');}
    catch {if(mounted.current)setError('Couldn’t reach your shared list. Your saved picks will retry when connected.');}
    finally {working.current=false;if(mounted.current)setSyncing(false);}
  },[]);
  useEffect(() => {
    mounted.current=true;
    const read=()=>setTrip(savedTrip());
    const wake=()=>{read();setOnline(navigator.onLine);if(!document.hidden)void sync();};
    window.addEventListener(tripEvent,read);
    window.addEventListener('storage',read);
    window.addEventListener('online',wake);
    window.addEventListener('offline',wake);
    document.addEventListener('visibilitychange',wake);
    const timer=setInterval(()=>{if(!document.hidden)void sync();},15000);
    wake();
    return ()=>{mounted.current=false;clearInterval(timer);window.removeEventListener(tripEvent,read);
      window.removeEventListener('storage',read);window.removeEventListener('online',wake);
      window.removeEventListener('offline',wake);document.removeEventListener('visibilitychange',wake);};
  },[sync]);
  const pending=Object.keys(trip?.picks || {}).length;
  const returnLink=<button className="text-button" type="button" onClick={leave}>Back to HH</button>;
  if (!trip) return <main className="shopping-mode">{returnLink}<h1>Offline groceries</h1><p>Connect and open Groceries to save a list on this device.</p></main>;
  const current=trip;
  const rows=current.rows.map(row=>({...row,done:current.picks[row.id]?.done ?? row.done}));
  const renderRow=(row:typeof rows[number])=><label key={row.id} className="shopping-pick">
    <input type="checkbox" checked={row.done} onChange={async event=>{
      const checked=event.currentTarget.checked;
      try {await pickItem(current,row.id,checked);void sync();}
      catch {setError('Couldn’t save that change on this device. Please try again.');}
    }}/><span>{row.title}{row.detail&&<small>{row.detail}</small>}</span>
  </label>;
  const open=rows.filter(row=>!row.done),picked=rows.filter(row=>row.done);
  return <main className="shopping-mode">
    {returnLink}<p className="eyebrow">{current.name}</p><h1>Shopping list</h1>
    <p role="status" className="shopping-status">{!online?'Offline':syncing?'Syncing…':'Shopping mode'} · {pending?
      pending+' '+(pending===1?'change':'changes')+' saved on this device to sync':
      'List saved on this device'}</p>
    {error&&<p role="alert">{error} {online&&<button className="text-button" onClick={()=>void sync()}>Retry</button>}</p>}
    {current.notices.length>0&&<section aria-label="List changes"><ul>{current.notices.map((notice,i)=><li key={i}>{notice}</li>)}</ul>
      <button className="text-button" onClick={()=>void clearNotices(current).catch(()=>setError('Couldn’t dismiss this notice.'))}>Dismiss</button></section>}
    {open.length===0&&<p>{picked.length?'Everything is picked up.':'Your grocery list is empty.'}</p>}
    {Array.from(new Set(open.map(row=>row.category))).sort().map(category=><section key={category}>
      <h2>{category}</h2>{open.filter(row=>row.category===category).map(renderRow)}</section>)}
    {!!picked.length&&<details><summary>Picked up ({picked.length})</summary>{picked.map(renderRow)}</details>}
  </main>;
}
