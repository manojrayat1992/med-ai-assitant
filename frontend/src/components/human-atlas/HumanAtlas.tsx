import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Box, X, RotateCcw, List, ExternalLink } from 'lucide-react';
import api from '@/services/api';
import type { AnatomySelection, AnatomyTarget } from '@/types/clinicalWorkspace';
import './human-atlas.css';

interface Finding { id:string; sourceText:string; status:string; certainty:string; sourceSection:string; anatomyTarget:AnatomyTarget|null }
interface Props { selection?:AnatomySelection|null; selections?:AnatomySelection[]; reviewId?:string|null; conflictNote?:string|null }
const toSelection=(f:Finding):AnatomySelection|null=>f.anatomyTarget?{
  structure:f.anatomyTarget.structureCode,displayName:f.anatomyTarget.displayName,side:f.anatomyTarget.side,
  region:f.anatomyTarget.region,system:f.anatomyTarget.system,sourceText:f.sourceText,
  sourceLabel:`${f.sourceSection} · ${f.status} · ${f.certainty}`,
}:null;

export function HumanAtlasLauncher({open:controlledOpen,onOpenChange,...props}:Props&{open?:boolean;onOpenChange?:(open:boolean)=>void}) {
  const [localOpen,setLocalOpen]=useState(false);
  const open=controlledOpen??localOpen;
  const setOpen=onOpenChange??setLocalOpen;
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className="atlas-launch"><Box size={16}/> Open 3D Atlas</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="atlas-overlay"/><Dialog.Content className="atlas-dialog" aria-describedby="atlas-description">
      <div className="atlas-dialog-title"><Dialog.Title>Human Atlas · report anatomy</Dialog.Title><Dialog.Close aria-label="Close 3D Atlas"><X size={20}/></Dialog.Close></div>
      <Dialog.Description id="atlas-description" className="sr-only">Full-screen reference anatomy explorer. Closing returns to your unchanged report workspace.</Dialog.Description>
      <HumanAtlasView {...props} onClose={()=>setOpen(false)}/>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

export function HumanAtlasView({selection=null,selections=[],reviewId=null,conflictNote,onClose}:Props&{onClose?:()=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const request=useRef('');
  const [ready,setReady]=useState(false);
  const [reload,setReload]=useState(0);
  const [chosen,setChosen]=useState<AnatomySelection|null>(selection);
  const [status,setStatus]=useState('Loading atlas…');
  const [rail,setRail]=useState(Boolean(selection||reviewId));
  const [findings,setFindings]=useState<Finding[]>([]);
  const [findingError,setFindingError]=useState('');
  const [loadingFindings,setLoadingFindings]=useState(false);
  useEffect(()=>{setChosen(selection);},[selection]);
  useEffect(()=>{
    if(!reviewId)return;
    let active=true;
    setLoadingFindings(true);setFindingError('');setFindings([]);
    api.get(`/reports/${reviewId}/anatomy-findings`).then(res=>{
      if(!active)return;
      const rows=res.data.data as Finding[];setFindings(rows);
      if(!selection)setChosen(rows.map(toSelection).find(Boolean)??null);
    }).catch(()=>{if(active)setFindingError('Could not load saved report findings. Close and reopen to retry.');})
      .finally(()=>{if(active)setLoadingFindings(false);});
    return ()=>{active=false;};
  },[reviewId]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
      const data=event.data;
      if(!data||data.channel!=='medai-human-atlas'||data.version!==1)return;
      if(data.type==='ready'){setReady(true);setStatus('Atlas ready. Explore any structure.');}
      if(data.type==='selection'&&data.requestId===request.current){
        setStatus(data.mapped===true&&typeof data.name==='string'
          ? `Highlighted: ${data.name}. Reference anatomy only.`
          : 'No exact atlas mapping for this structure and side. Use atlas search to explore; no finding is highlighted.');
      }
      if(data.type==='escape')onClose?.();
    };
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[onClose]);
  useEffect(()=>{
    if(!ready||!chosen)return;
    request.current=crypto.randomUUID();
    setStatus('Locating mapped structure…');
    // Send anatomy identifiers only: no patient IDs, report text, or clinical findings enter the frame.
    frame.current?.contentWindow?.postMessage({channel:'medai-human-atlas',version:1,type:'select',requestId:request.current,
      target:{structure:chosen.structure,side:chosen.side,region:chosen.region}},window.location.origin);
  },[ready,chosen]);
  useEffect(()=>{
    if(ready)return;
    const timer=window.setTimeout(()=>setStatus('Atlas is taking longer to load. Check your connection, then reload the viewer.'),20000);
    return ()=>window.clearTimeout(timer);
  },[ready,reload]);
  const alternatives=selections.filter((value,index,all)=>all.findIndex(v=>v.structure===value.structure&&v.side===value.side&&v.sourceText===value.sourceText)===index);
  return <div className="atlas-host">
    <div className="atlas-toolbar">
      <button onClick={()=>setRail(v=>!v)} aria-expanded={rail}><List size={16}/> Report findings</button>
      <span role="status">{status}</span>
      <button aria-label="Reload 3D Atlas" onClick={()=>{setReady(false);setStatus('Loading atlas…');setReload(n=>n+1);}}><RotateCcw size={16}/></button>
    </div>
    <div className={`atlas-body ${rail?'with-findings':''}`}>
      {rail&&<aside className="atlas-findings" aria-label="Report findings">
        <h2>Report context</h2>
        <p>Highlights locate reference structures. They do not show a patient-specific lesion, infection extent, or scan reconstruction.</p>
        {conflictNote&&<p className="atlas-warning">{conflictNote}</p>}
        {chosen&&<div className="atlas-current"><strong>{chosen.displayName}</strong><small>{chosen.sourceLabel||'Selected anatomy'} · {chosen.side}</small>{chosen.sourceText&&<blockquote>{chosen.sourceText}</blockquote>}</div>}
        {alternatives.map((item,index)=><button key={index} onClick={()=>setChosen(item)}>{item.displayName}<small>{item.sourceLabel||'QA / comparison selection'}</small></button>)}
        {loadingFindings&&<p>Loading saved report findings…</p>}
        {findingError&&<p role="alert">{findingError}</p>}
        {findings.map(f=><button key={f.id} disabled={!f.anatomyTarget} onClick={()=>setChosen(toSelection(f))}>
          <strong>{f.anatomyTarget?.displayName||'No mapped anatomy'}</strong><small>{f.sourceSection} · {f.status} · {f.certainty}</small><span>{f.sourceText}</span>
        </button>)}
        {!reviewId&&!chosen&&<p>No report selected. Use the atlas search or open this viewer from a saved report.</p>}
        {reviewId&&!loadingFindings&&!findingError&&findings.length===0&&<p>No structured findings were extracted from this saved report. You can still explore reference anatomy.</p>}
        <p>Exploring or selecting anatomy does not change your report.</p>
      </aside>}
      <iframe key={reload} ref={frame} title="Human Atlas anatomy explorer" src="/human-atlas/index.html" referrerPolicy="no-referrer" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"/>
    </div>
    <footer className="atlas-footer">Adult male reference anatomy · Human Atlas (MIT) · BodyParts3D (CC BY 4.0) <a href="/human-atlas/ATTRIBUTION.md" target="_blank" rel="noreferrer">Credits <ExternalLink size={11}/></a></footer>
  </div>;
}
