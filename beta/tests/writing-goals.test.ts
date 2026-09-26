import {expect,it,beforeEach,beforeAll} from 'vitest';
import {goalProgress,periodStart,recordGoalActivity,readGoalDays,recordGoalTime} from '../src/core/writingGoals';
import {EditorController} from '../src/editor/EditorController';
import {emptyScreenplay} from '../src/core/model';
beforeEach(()=>localStorage.clear());
beforeAll(()=>{Range.prototype.getBoundingClientRect=()=>new DOMRect(0,0,10,20);Range.prototype.getClientRects=()=>[new DOMRect(0,0,10,20)] as unknown as DOMRectList;HTMLElement.prototype.scrollIntoView=()=>{};window.scrollBy=()=>{};});
it('retains credit across browser instances and adds concurrent tab buckets without loss',()=>{
 const now=new Date(2026,8,25,12);recordGoalActivity(localStorage,'owner','tab1',now,500,0);recordGoalActivity(localStorage,'owner','tab2',now,20,60000);recordGoalActivity(localStorage,'owner','tab1',now,0,0);
 expect(goalProgress({id:'g',metric:'words',target:600,period:'day'},readGoalDays(localStorage,'owner'),now)).toBe(520);
 expect(readGoalDays(localStorage,'different-account')).toHaveLength(0);
});
it('uses local days, Monday weeks, months and splits time at midnight',()=>{
 const now=new Date(2026,8,27,12);expect(periodStart('week',now)).toBe('2026-09-21');expect(periodStart('month',now)).toBe('2026-09-01');
 recordGoalTime(localStorage,'owner','tab',new Date(2026,8,25,23,59,58).getTime(),new Date(2026,8,26,0,0,2).getTime());
 expect(readGoalDays(localStorage,'owner').map(d=>d.milliseconds)).toEqual([2000,2000]);
});
it('credits typed words once, never subtracts deletes, and excludes undo/redo, paste and reopened content',()=>{
 let earned=0;const host=document.createElement('div');document.body.append(host);const editor=new EditorController(host,emptyScreenplay(),{onWritingActivity:(words,paste)=>{if(!paste)earned+=words;}});
 try{
 for(const char of 'Hello world') editor.view.dispatch(editor.view.state.tr.insertText(char));
 expect(earned).toBe(2);
 editor.undo();editor.redo();expect(earned).toBe(2);
 editor.view.dispatch(editor.view.state.tr.delete(1,12));expect(earned).toBe(2);
 editor.view.dispatch(editor.view.state.tr.insertText('Pasted words',1).setMeta('paste',true));expect(earned).toBe(2);
 const other=emptyScreenplay();other.blocks[0].text='A large imported document';editor.setDocument(other);expect(earned).toBe(2);
 }finally{editor.destroy();host.remove();}
});
