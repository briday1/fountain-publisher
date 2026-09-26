import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {BeatBoard} from '../src/components/BeatBoard';
import {emptyScreenplay,type Screenplay} from '../src/core/model';
it('folds and restores nested detail, adds a child and preserves it when its parent is deleted', async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const initial=emptyScreenplay();initial.metadata.beats=[{id:'parent',title:'A choice',description:'Parent notes',act:'Act I',color:'#123456'},{id:'child',parentId:'parent',title:'A hesitation',description:'Keep this detail',act:'Act I',color:'#123456'}];
 let saved:Screenplay=initial;
 function Harness(){const [doc,setDoc]=useState(initial);return <BeatBoard doc={doc} onChange={d=>{saved=d;setDoc(d);}} onAssign={()=>{}} onRange={()=>{}} onExport={()=>{}} onExportCsv={()=>{}}/>;}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const click=async(label:string)=>{const node=host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);expect(node).not.toBeNull();await act(async()=>node!.click());};
 try {
 await act(async()=>root.render(<Harness/>));
 await click('Collapse sub-beats of A choice');expect(host.querySelector('input[value="A hesitation"]')).toBeNull();expect(saved.metadata.beats[1].description).toBe('Keep this detail');
 await click('Expand sub-beats of A choice');expect(host.querySelector('input[value="A hesitation"]')).not.toBeNull();
 await click('Add sub-beat to beat 1');expect(saved.metadata.beats).toHaveLength(3);expect(saved.metadata.beats[2].parentId).toBe('parent');
 await click('Delete beat 1');expect(saved.metadata.beats).toHaveLength(2);expect(saved.metadata.beats.every(b=>!b.parentId)).toBe(true);expect(saved.metadata.beats[0].description).toBe('Keep this detail');
 } finally {await act(async()=>root.unmount());host.remove();}
});
