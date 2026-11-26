import {Check,Palette} from 'lucide-react';
import {PALETTES,SEASONAL_PALETTES,type Palette as PaletteOption,type SeasonalPaletteId} from './palettes';

export default function PaletteSettings({value,onChange,message,seasons=[]}:{value:string;onChange:(id:string)=>void;message:string;seasons?:readonly SeasonalPaletteId[]}){
 const choice=(p:PaletteOption)=><button key={p.id} type="button" className="palette-choice" aria-pressed={value===p.id} onClick={()=>onChange(p.id)}>
  <span className="palette-preview" aria-hidden="true">{p.swatches.map((colour,i)=><i key={i} style={{backgroundColor:colour}}/>)}</span>
  <span className="palette-copy"><b>{p.name}</b><small>{p.description}</small></span>
  <span className="palette-check" aria-hidden="true">{value===p.id&&<Check size={14}/>}</span>
 </button>;
 return <section className="palette-settings" aria-labelledby="palette-heading">
  <div className="palette-heading"><Palette size={18}/><h3 id="palette-heading">Colour palette</h3></div>
  <p>Make yourself at home. Choose the look you like.</p>
  <div className="palette-choices" role="group" aria-label="Colour palette choices">
   {PALETTES.map(choice)}
  </div>
  {seasons.length>0&&<div className="palette-seasonal" role="group" aria-label="Seasonal palettes">
   <h4>Seasonal palettes</h4>
   <div className="palette-choices">{seasons.map(id=>choice(SEASONAL_PALETTES[id]))}</div>
  </div>}
  <p className="palette-help">Your look on this device. Family event colours stay the same.</p>
  <p className="palette-status" role="status" aria-live="polite">{message}</p>
 </section>
}
