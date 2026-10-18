import {supabase} from './supabase';
export type Member={user_id:string;display_name:string;role:string;household_id:string};
export async function loadHousehold(id:string){
 const [items,home]=await Promise.all([supabase.from('household_items').select('*').eq('household_id',id).order('created_at'),supabase.from('households').select('calendar_id').eq('id',id).single()]);
 if(items.error)throw items.error;if(home.error)throw home.error;
 return {items:items.data.map(x=>({...x,due:x.due||'',done:x.done?1:0,createdAt:x.created_at})),calendarId:home.data.calendar_id};
}
type Change={action:string;id?:string;value?:string;kind?:string;title?:string;category?:string;person?:string;due?:string;done?:boolean};
export async function changeHousehold(id:string,body:unknown){
 const b=body as Change;let result;
 if(b.action==='setting')result=await supabase.from('households').update({calendar_id:b.value?.trim()||''}).eq('id',id).select('id').single();
 else if(b.action==='add')result=await supabase.from('household_items').insert({household_id:id,kind:b.kind,title:b.title?.trim(),category:b.category,person:b.person,due:b.due||null}).select('id').single();
 else if(b.action==='toggle')result=await supabase.from('household_items').update({done:b.done}).eq('household_id',id).eq('id',b.id!).select('id').single();
 else if(b.action==='delete')result=await supabase.from('household_items').delete().eq('household_id',id).eq('id',b.id!).select('id').single();
 else throw Error('Unknown change');
 if(result.error)throw result.error;
}
