import './seasonal-decor.css';

function CornerWeb() {
  return <g fill="none" stroke="#866487" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".86">
    <path d="M2 2h49M2 2l42 24M2 2l29 45M2 2v53"/>
    <path d="M14 2q-1 5-4 5 0 5-1 8-3 3-7 2M27 2q-1 10-8 10 1 7-3 12-7 7-14 6M39 2q-2 14-10 16 0 10-7 15-8 9-20 10"/>
  </g>;
}

function Halloween() {
  return <>
    <path d="M4 113c29-17 56-17 79-10s42 3 64-3 54-3 89 10v16H4Z" fill="#EBD8E7"/>
    <path d="M4 122c25-6 52-8 85-3s74 3 98-1 35 2 49 4v4H4Z" fill="#D7BCCD"/>
    <g transform="translate(7 8)"><CornerWeb/></g>
    <g transform="translate(233 8) scale(-1 1)"><CornerWeb/></g>
    <path d="M82 14a15 15 0 1 0 12 24 16 16 0 0 1-12-24Z" fill="#E8AA6B"/>
    <path d="M110 21v10m-5-5h10m61 9v8m-4-4h8" fill="none" stroke="#AB76A0" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M51 90v-8m41 8v-8" fill="none" stroke="#786080" strokeWidth="4" strokeLinecap="round"/>
    <path d="M49 82a23 23 0 0 1 46 0v23a8 8 0 0 1-8 8H57a8 8 0 0 1-8-8Z" fill="#AAB48B"/>
    <path d="M49 83a23 23 0 0 1 46 0l-9-5-5 6-7-5-6 5-7-5Z" fill="#625575"/>
    <path d="M53 97h10m-5-4v8" fill="none" stroke="#6B7457" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="66" cy="92" r="2.7" fill="#45364D"/>
    <circle cx="79" cy="92" r="2.7" fill="#45364D"/>
    <path d="M69 101q4 4 8 0" fill="none" stroke="#45364D" strokeWidth="1.9" strokeLinecap="round"/>
    <path d="M106 72a27 27 0 1 1 54 0v33c0 5-5 7-9 3s-8-4-12 0-8 4-12 0-8-4-12 0-9 2-9-3Z" fill="#FFF9F4" stroke="#B395B6" strokeWidth="1.7"/>
    <path d="M109 92q-9-1-11 9m60-11q9-1 13 6" fill="none" stroke="#B395B6" strokeWidth="2.2" strokeLinecap="round"/>
    <ellipse cx="123" cy="76" rx="2.5" ry="3.8" fill="#5F4269"/>
    <ellipse cx="143" cy="76" rx="2.5" ry="3.8" fill="#5F4269"/>
    <ellipse cx="117" cy="86" rx="4" ry="2.5" fill="#E8B5BB"/>
    <ellipse cx="149" cy="86" rx="4" ry="2.5" fill="#E8B5BB"/>
    <path d="M129 85q4 4 8 0" fill="none" stroke="#5F4269" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M190 79q-1-10 8-11" fill="none" stroke="#817655" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M171 95c0-10 6-16 12-16 4 0 6 2 8 2s5-2 9-2c7 0 13 6 13 16 0 12-7 18-21 18s-21-6-21-18Z" fill="#D68C53"/>
    <path d="M183 82q-6 15 1 28m15-28q7 15-1 28" fill="none" stroke="#AB613A" strokeWidth="1.4" opacity=".66"/>
    <path d="m181 94 4-4 2 5Zm14 1 3-5 4 4Zm-11 4q8 6 15 0-2 8-8 8-5 0-7-8Z" fill="#6C4348"/>
  </>;
}

function Easter() {
  return <>
    <circle cx="53" cy="32" r="20" fill="#F0D79B"/>
    <path d="M4 108c44-21 75-19 118-2 37-8 75-17 114-1v21H4Z" fill="#E3EACF"/>
    <path d="M4 121c38-10 87-13 122-6 43 8 77-4 110-3v14H4Z" fill="#C9D6B4"/>
    <path d="M129 70c-8-19-17-44-5-49 10-4 14 25 16 43m9 1c3-26 12-46 22-42 8 4-3 26-11 51" fill="#FFF9F3" stroke="#AE94B9" strokeWidth="2"/>
    <path d="M125 30q3-6 11 33m30-30q-4-4-13 31" fill="none" stroke="#E7B9C8" strokeWidth="4.4" strokeLinecap="round"/>
    <path d="M111 91c0-18 14-30 34-30s34 12 34 30c0 15-13 24-34 24s-34-9-34-24Z" fill="#FFF9F3" stroke="#AE94B9" strokeWidth="2"/>
    <circle cx="134" cy="87" r="2.6" fill="#5B4467"/>
    <circle cx="156" cy="87" r="2.6" fill="#5B4467"/>
    <ellipse cx="126" cy="95" rx="4" ry="2.8" fill="#E7B9C8"/>
    <ellipse cx="165" cy="95" rx="4" ry="2.8" fill="#E7B9C8"/>
    <path d="M142 94h6l-3 3Zm3 3v2m-5 0q2 3 5 0 3 3 5 0" fill="none" stroke="#855B76" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M48 98c0-13 8-28 17-28s17 15 17 28c0 10-7 17-17 17s-17-7-17-17Z" fill="#B9A2D1"/>
    <path d="m50 94 6-4 5 5 5-4 5 5 8-6" fill="none" stroke="#FFF5E8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M77 103c0-9 6-20 13-20s13 11 13 20c0 8-5 13-13 13s-13-5-13-13Z" fill="#E7B58F"/>
    <path d="m81 98 4 1m6-7 1 4m3 6 3-1" fill="none" stroke="#FFF2DE" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M196 115v-21m0 15q-12-11-15-4 5 7 15 6m0 1q11-10 15-5-4 7-15 7" fill="none" stroke="#849B72" strokeWidth="2" strokeLinecap="round"/>
    <path d="M196 97c-15-4-12-14-4-12 0-9 11-9 11 0 8-2 11 8-5 12Z" fill="#D99DAA"/>
    <circle cx="197" cy="90" r="3" fill="#F7DB9F"/>
  </>;
}

function Christmas() {
  return <>
    <circle cx="51" cy="34" r="19" fill="#F1DCA5"/>
    <path d="M5 108c33-13 61-17 96-9 45 11 91-13 134 3v24H5Z" fill="#E3EBDF"/>
    <path d="M5 122c44-10 76-12 127-2 44 8 69-4 103-6v12H5Z" fill="#CCDCCC"/>
    <path d="M66 113h8V94h-8Zm65 0h10V91h-10Z" fill="#92765A"/>
    <path d="m70 52 26 42H44Zm0 14 30 39H40Z" fill="#91AD94" stroke="#91AD94" strokeWidth="4" strokeLinejoin="round"/>
    <path d="m136 30 26 40h-52Zm0 21 31 39h-62Zm0 22 35 32h-70Z" fill="#587D65" stroke="#587D65" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M119 68q16 9 33 1m-37 23q20 8 42-1" fill="none" stroke="#DCC48B" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="m136 16 2.8 6.2 6.7.9-4.9 4.7 1.2 6.6-5.8-3.2-5.8 3.2 1.1-6.6-4.8-4.7 6.7-.9Z" fill="#CE9C4B"/>
    <circle cx="130" cy="63" r="3.4" fill="#CB736E"/>
    <circle cx="143" cy="79" r="3.4" fill="#E8C480"/>
    <circle cx="122" cy="91" r="3.4" fill="#CF7775"/>
    <circle cx="150" cy="99" r="3.1" fill="#CF7775"/>
    <path d="M180 90h27v24h-27Z" fill="#B96667" stroke="#B96667" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M177 87h33v7h-33Z" fill="#CC7B77" stroke="#CC7B77" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M193 87v27m0-28q-14-1-10-7 4-5 10 7 5-12 10-7 5 6-10 7Z" fill="none" stroke="#F6D9A2" strokeWidth="2.3" strokeLinecap="round"/>
    <g fill="none" stroke="#91A99A" strokeWidth="1.5" strokeLinecap="round">
      <path d="M89 30v9m-4.5-4.5h9m97-4v12m-6-6h12m21 17v7m-3.5-3.5h7"/>
    </g>
  </>;
}

function Thanksgiving() {
  return <>
    <circle cx="58" cy="33" r="18" fill="#EED4A6"/>
    <path d="M4 110c39-20 77-20 123-6 47-13 80-14 109 1v21H4Z" fill="#EFDFC3"/>
    <path d="M4 123c37-9 78-12 123-4 40 7 76-5 109-3v10H4Z" fill="#E0C6A6"/>
    <path d="M174 109q-9-25-1-57m-8 53q-3-26-18-39m27 42q4-23 20-36" fill="none" stroke="#A47C58" strokeWidth="2.4" strokeLinecap="round"/>
    <path d="M173 67c-5-3-12-6-16-5l1-8-9-5 8-5-4-10 10 3 8-12 6 9 10-4-1 10 10 5-7 7 3 9c-9-1-15 3-19 6Z" fill="#B36957"/>
    <path d="M151 81q-20-2-19-20 16 1 19 20" fill="#C68F53"/>
    <path d="M189 81q0-17 18-22 0 17-18 22" fill="#D2A35C"/>
    <path d="M97 71q-2-12 8-15" fill="none" stroke="#7D7760" strokeWidth="4" strokeLinecap="round"/>
    <path d="M66 92c0-15 9-24 19-24 6 0 9 3 12 3s8-3 14-3c10 0 19 9 19 24 0 15-10 24-32 24S66 107 66 92Z" fill="#C97F4C"/>
    <path d="M85 71q-12 20 0 42m24-42q11 20 0 42" fill="none" stroke="#A76042" strokeWidth="2" opacity=".75"/>
    <path d="M122 92q0-10 7-12" fill="none" stroke="#7D7760" strokeWidth="3" strokeLinecap="round"/>
    <path d="M109 104c0-10 7-15 13-13 3 1 5-1 8-1 7 0 11 5 11 14 0 10-5 14-16 14s-16-4-16-14Z" fill="#E1B27A"/>
    <path d="M119 94q-4 11 1 22m10-22q4 11-1 22" fill="none" stroke="#AF7959" strokeWidth="1.5" opacity=".65"/>
    <path d="M42 102q11-16 26-25m-19 18q-11-8-14-4 4 8 12 7m8-9q-8-11-10-12-2 7 8 15m7-9q2-12 8-11 2 7-8 11" fill="none" stroke="#A78D58" strokeWidth="2" strokeLinecap="round"/>
  </>;
}

function Summer() {
  return <>
    <circle cx="54" cy="37" r="19" fill="#EDC286"/>
    <path d="M5 86c50-13 83-12 120-2 36 9 80 3 110-8v50H5Z" fill="#D4E8E1"/>
    <path d="M5 104c25 6 63-1 94-5 37-5 91 5 136 0v27H5Z" fill="#B0CFC4"/>
    <path d="M5 120c19-6 47-8 64-6 45 6 81 0 112-7 21-5 40-3 54 0v19H5Z" fill="#E9D5AC"/>
    <path d="M12 93q19 3 35-1m14-1q13-3 24-2m-63 17q13 2 25-1m10 0q10-1 15-3" fill="none" stroke="#FBFAF0" strokeWidth="2" strokeLinecap="round"/>
    <path d="m154 51-17 61" fill="none" stroke="#766B56" strokeWidth="3" strokeLinecap="round"/>
    <path d="M109 58q41-37 79 18-22-12-32-7-11-9-25-5-10-7-22-6Z" fill="#CB937C" stroke="#AB7461" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M131 64q7-14 23-17 10 8 13 23-6-3-11-1-11-9-25-5Z" fill="#FFF0D2"/>
    <path d="M192 108q2-10 10-10t12 10-22 0Z" fill="#BC907E" stroke="#BC907E" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m201 100-2 7m6-7 3 7" fill="none" stroke="#F4DBBD" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M81 30q5-3 10 2 4-6 10-5m12-10q4-2 8 2 4-5 8-4" fill="none" stroke="#879E92" strokeWidth="1.7" strokeLinecap="round"/>
  </>;
}

const illustrations = {easter:Easter,halloween:Halloween,christmas:Christmas,thanksgiving:Thanksgiving,summer:Summer};
type DecoratedSeason = keyof typeof illustrations;

export function hasSeasonalDecor(paletteId: string): paletteId is DecoratedSeason {
  return Object.hasOwn(illustrations,paletteId);
}

export default function SeasonalDecor({paletteId}:{paletteId:string}) {
  if (!hasSeasonalDecor(paletteId)) return null;
  const Illustration = illustrations[paletteId];
  return <div className="seasonal-decor" aria-hidden="true">
    <svg className="seasonal-decor__scene" viewBox="0 0 240 128" focusable="false">
      <Illustration/>
    </svg>
  </div>;
}
