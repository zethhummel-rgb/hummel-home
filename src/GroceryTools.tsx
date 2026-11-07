import {useEffect,useRef,useState} from 'react';
import {Search,SlidersHorizontal,X} from 'lucide-react';
import type {GroceryGrouping} from './groceryData';
import './grocery-tools.css';

export default function GroceryTools({query,onQuery,grouping,onGrouping,store,onStore,stores}:{
  query:string;onQuery:(value:string)=>void;grouping:GroceryGrouping;onGrouping:(value:GroceryGrouping)=>void;
  store:string;onStore:(value:string)=>void;stores:string[];
}) {
  const [panel,setPanel]=useState<'search'|'filters'|null>(null);
  const root=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
  function close(){setPanel(null);trigger.current?.focus();}
  useEffect(()=>{
    if(!panel)return;
    if(panel==='search')search.current?.focus();
    else root.current?.querySelector<HTMLSelectElement>('select')?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setPanel(null);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setPanel(null);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[panel]);
  function toggle(value:'search'|'filters',button:HTMLButtonElement){trigger.current=button;setPanel(old=>old===value?null:value);}
  const active=store!=='all'||grouping!=='department';
  return <div className="grocery-tools" ref={root} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setPanel(null);}}>
    {!!query&&<span className="grocery-search-summary">Search: {query}</span>}
    {store!=='all'&&<span className="grocery-search-summary">{store==='none'?'No store set':stores.find(value=>'store:'+value.toLowerCase()===store)||'Store filter'}</span>}
    <button type="button" className={'grocery-tool-button'+(query?' is-active':'')} aria-label={query?'Search groceries, search active':'Search groceries'} aria-expanded={panel==='search'} aria-controls="grocery-search-panel" onClick={event=>toggle('search',event.currentTarget)}><Search size={19}/>{!!query&&<span className="grocery-tool-dot"/>}</button>
    <button type="button" className={'grocery-tool-button'+(active?' is-active':'')} aria-expanded={panel==='filters'} aria-controls="grocery-filter-panel" onClick={event=>toggle('filters',event.currentTarget)}><SlidersHorizontal size={18}/>Filters{active&&<span className="grocery-tool-dot"/>}</button>
    {panel==='search'&&<div className="grocery-tool-panel" id="grocery-search-panel" role="search" aria-label="Grocery search">
      <div className="grocery-tool-heading"><b>Search groceries</b><button type="button" aria-label="Close search" onClick={close}><X size={18}/></button></div>
      <form onSubmit={event=>{event.preventDefault();close();}}><input ref={search} type="search" aria-label="Search groceries" placeholder="Find an item or store" value={query} maxLength={160} onChange={event=>onQuery(event.target.value)}/></form>
      {!!query&&<button type="button" className="text-button" onClick={()=>{onQuery('');search.current?.focus();}}>Clear search</button>}
    </div>}
    {panel==='filters'&&<div className="grocery-tool-panel" id="grocery-filter-panel" role="region" aria-label="Grocery filters">
      <div className="grocery-tool-heading"><b>Filters</b><button type="button" aria-label="Close filters" onClick={close}><X size={18}/></button></div>
      <label>Group by<select aria-label="Group groceries by" value={grouping} onChange={event=>onGrouping(event.target.value as GroceryGrouping)}><option value="department">Department</option><option value="store">Store</option></select></label>
      <label>Store<select aria-label="Filter groceries by store" value={store} onChange={event=>onStore(event.target.value)}><option value="all">All stores</option><option value="none">No store set</option>{stores.map(value=><option key={value.toLowerCase()} value={'store:'+value.toLowerCase()}>{value}</option>)}</select></label>
      {active&&<button type="button" className="text-button" onClick={()=>{onGrouping('department');onStore('all');}}>Reset filters</button>}
    </div>}
  </div>;
}
