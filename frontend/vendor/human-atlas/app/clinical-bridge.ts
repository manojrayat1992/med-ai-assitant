import type {Atlas, Concept} from './anatomy';
export interface ClinicalTarget {structure:string;side:string;region?:string}
const names:Record<string,string>={LUNG:'lung',KIDNEY:'kidney',HUMERUS:'humerus',FEMUR:'femur',TIBIA:'tibia',FIBULA:'fibula',RADIUS:'radius',ULNA:'ulna',PATELLA:'patella',SCAPULA:'scapula',CLAVICLE:'clavicle',HEART:'heart',LIVER:'liver',SPLEEN:'spleen',STOMACH:'stomach',PANCREAS:'pancreas',BLADDER:'urinary bladder',BRAIN:'brain',TRACHEA:'trachea',STERNUM:'sternum',RIB:'rib'};
const paired=new Set(['LUNG','KIDNEY','HUMERUS','FEMUR','TIBIA','FIBULA','RADIUS','ULNA','PATELLA','SCAPULA','CLAVICLE']);
/** Exact concept mapping only. Never guess a side or substitute a joint with a bone. */
export function resolveClinicalTarget(atlas:Pick<Atlas,'concepts'>,target:ClinicalTarget):Concept|null {
  const code=target.structure.toUpperCase(), name=names[code];
  if(!name)return null;
  const exact=(value:string)=>atlas.concepts.find(c=>c.name.toLowerCase()===value&&c.elements.length>0);
  if(paired.has(code)) {
    if(target.side==='LEFT'||target.side==='RIGHT')return exact(`${target.side.toLowerCase()} ${name}`)??null;
    if(target.side==='BILATERAL'){
      const left=exact(`left ${name}`),right=exact(`right ${name}`);
      if(left&&right)return {id:`${left.id}+${right.id}`,name:`Bilateral ${name}`,elements:[...new Set([...left.elements,...right.elements])]};
    }
    return null;
  }
  return exact(name)??null;
}
export function connectClinicalBridge(atlas:Atlas,select:(c:Concept|null)=>void) {
  if(window.parent===window)return ()=>{};
  const send=(data:Record<string,unknown>)=>window.parent.postMessage({channel:'medai-human-atlas',version:1,...data},window.location.origin);
  const receive=(event:MessageEvent)=>{
    if(event.origin!==window.location.origin||event.source!==window.parent)return;
    const data=event.data;
    if(!data||data.channel!=='medai-human-atlas'||data.version!==1||data.type!=='select'||typeof data.requestId!=='string')return;
    const target=data.target;
    if(!target||typeof target.structure!=='string'||typeof target.side!=='string'||target.structure.length>80||target.side.length>20)return;
    const concept=resolveClinicalTarget(atlas,target);
    select(concept);
    send({type:'selection',requestId:data.requestId,mapped:!!concept,name:concept?.name??null});
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')send({type:'escape'});};
  window.addEventListener('message',receive);window.addEventListener('keydown',escape);
  send({type:'ready'});
  return ()=>{window.removeEventListener('message',receive);window.removeEventListener('keydown',escape);};
}
