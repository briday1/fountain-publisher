var Bt=`Title: The Last Light
Credit: Written by
Author: Avery Stone
Draft date: August 25, 2026

INT. OBSERVATORY - NIGHT

A telescope turns beneath the open dome. Stars burn over the sleeping city.

MAYA CHEN
(quietly)
There you are.

A red point of light moves against the constellations.

ELI
Tell me that's a satellite.

MAYA CHEN
It isn't.

EXT. CITY ROOFTOP - NIGHT

The skyline flickers. Every window goes dark at once.

ELI
That wasn't the grid.

Maya raises a battered field radio. Static answers her.

MAYA CHEN
The observatory has an independent circuit.
(then)
Something switched off the sky.

EXT. RIVERSIDE AVENUE - NIGHT

Traffic coasts to a silent halt. Drivers step into the street and stare upward.

JUNE PARK, 30s, pushes through the gathering crowd with a camera in hand.

JUNE PARK
Maya? If you can hear me, call back.

Her camera screen flares white. One frame remains: the red light, now impossibly close.

INT. OBSERVATORY - CONTROL ROOM - CONTINUOUS

Emergency lamps pulse along the floor. Eli studies a wall of dead monitors.

ELI
You said it was moving against the stars.

MAYA CHEN
No. The stars were moving around it.

The radio crackles.

JUNE PARK (V.O.)
Maya, look east.

EXT. CITY ROOFTOP - CONTINUOUS

Maya crosses to the dome opening. Beyond the river, a second red light rises.

Then a third.

MAYA CHEN
June, get underground.

JUNE PARK (V.O.)
What are they?

Maya watches the lights arrange themselves into a perfect line.

MAYA CHEN
An answer.

INT. OBSERVATORY - CONTROL ROOM - MOMENTS LATER

Eli drags a steel cabinet across the door. Maya tunes the radio through bands of static.

ELI
Please tell me the basement has more than canned peaches.

MAYA CHEN
It has a seismograph, two bicycles, and six hours of battery.

The radio snaps into sudden clarity.

MISSION CONTROL (V.O.)
Observatory Seven, report your sky.

Maya and Eli exchange a look.

MAYA CHEN
Three objects. Stationary over the river. All ground power is gone.

MISSION CONTROL (V.O.)
They aren't stationary.

EXT. RIVERSIDE AVENUE - NIGHT

June runs as the crowd surges toward the subway. Above them, the red lights stretch into glowing vertical lines.

A LITTLE BOY stands alone beside an abandoned bus.

JUNE PARK
Hey! Blue jacket! Come with me.

She takes his hand. A low vibration ripples through the pavement.

INT. OBSERVATORY - CONTROL ROOM - NIGHT

Ink needles jump across the seismograph. Eli tears off the paper.

ELI
That's not an earthquake.

MAYA CHEN
It's a signal.

She lays the paper beside an old star chart. The peaks align with three marked coordinates.

MAYA CHEN (CONT'D)
They've been here before.

INT. SUBWAY STATION - NIGHT

June guides the boy down a stalled escalator. Hundreds wait below in the emergency glow.

LITTLE BOY
My dad says stars are already gone when we see them.

JUNE PARK
Some are. Most are still fighting.

Her radio chirps.

MAYA CHEN (V.O.)
June, can your camera transmit?

JUNE PARK
For about nine minutes.

MAYA CHEN (V.O.)
I only need one.

EXT. OBSERVATORY DOME - PRE-DAWN

Maya bolts June's image sensor to the telescope while Eli pedals a bicycle generator below.

ELI
This is humiliating technology.

MAYA CHEN
Keep pedaling.

The telescope turns toward the nearest red line. On the monitor, darkness resolves into thousands of tiny mirrors.

ELI
What do they reflect?

Maya magnifies the image. In every mirror: the same blue planet beneath unfamiliar constellations.

MAYA CHEN
Home.

She keys the transmitter.

MAYA CHEN
If you can hear us, we are still here.

For a long beat, nothing.

Then the city lights return one block at a time, drawing a path toward the river.

INT. SUBWAY STATION - PRE-DAWN

Phones wake across the platform. June's camera begins to upload.

The little boy smiles at the ceiling as the vibration becomes a deep, harmonic chord.

EXT. CITY - DAWN

The red lines fold inward and vanish. Morning breaks across the skyline.

On the observatory roof, Maya finds one red point remaining in the brightening sky.

ELI
An answer?

MAYA CHEN
A promise.

>**END**<
`;var o=(e,t=document)=>t.querySelector(e),j=(e,t=document)=>[...t.querySelectorAll(e)],$e=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),Dt=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=o("#source"),m=o("#screenplay-page"),tt="fountain-publisher.workspace.v1",Me="https://api.fountain-publisher.com",Z=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",N={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function qe(e,t){N[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:Ut(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null,previewContextEdit:null,previewContextText:"",githubConnected:!1,githubInstallUrl:"",githubPath:"",githubFile:null};function Ut(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function Wt(){try{let e=JSON.parse(localStorage.getItem(tt)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function nt(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(tt,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:o("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,githubFile:r.githubFile,updatedAt:Date.now()}))}catch{}}}function A(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(nt,120))}function Ie(){let e=localStorage.getItem("fountain-publisher.preview-background")||"dots",t=["blank","dots"].includes(e)?e:"dots",n=Number(localStorage.getItem("fountain-publisher.preview-dot-radius")),a=n>=.6&&n<=1.8?n:1,i=o("#preview-scroll");i.dataset.background=t,i.style.setProperty("--preview-dot-radius",`${a}px`),o("#preview-background").value=t,o("#preview-dot-radius").value=String(a),o("#preview-dot-radius-value").textContent=`${a.toFixed(1)}px`,o("#preview-dot-radius-row").hidden=t!=="dots"}function y(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function Re(e){return y(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Te(e){try{return decodeURIComponent(e)}catch{return e}}function ot(e){let t=e.trim().match(Dt);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Te(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Te(t[2].slice(0,n)),text:Te(t[2].slice(n+1))}}function it(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function zt(e){let t=[],n={},a=!1;return e.forEach((i,s)=>{if(i.includes("/*")&&(a=!0),a){i.includes("*/")&&(a=!1);return}let l=ot(i);l?.kind==="general"?t.push({line:s,text:l.text}):l?.kind==="character"&&(n[l.name]={line:s,text:l.text})}),{generalNotes:t,characterNotes:n}}function Oe(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function jt(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function Gt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||Oe(n))return!1;let i=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),s=t===0||!e[t-1].trim();return i&&s}function me(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],a=!0,i=!1,s=!1,l=!1,p=!1;for(let d=0;d<t.length;d+=1){let f=t[d],h=f.trim(),u="action",g=f,v="";if(h.includes("/*")&&(p=!0),p)u="boneyard";else if(!h)u="empty",l=!1,i&&(a=!1),s=!1;else if(a&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&$e.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let x=f.indexOf(":");v=f.slice(0,x+1),g=f.slice(x+1).trim(),u=v.toLowerCase()==="title:"?"title-value title":"title-value",i=!0,s=!0,l=!1}else a&&s&&/^\s+/.test(f)?(g=h,u="title-value",l=!1):(a=!1,/^#{1,6}\s/.test(h)?u="section":/^=/.test(h)&&!/^={3,}$/.test(h)?u="synopsis":/^\[\[.*\]\]$/.test(h)?u="note":/^~/.test(h)?(u="lyric",g=f.replace(/^\s*~/,"")):/^={3,}$/.test(h)?u="page-break":Oe(h)?(u="scene",l=!1):Gt(t,d)?(u="character",g=h.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(h)?u="parenthetical":l?u="dialogue":/^>.*<$/.test(h)?(u="centered",g=h.slice(1,-1).trim()):/^>/.test(h)||/^[A-Z0-9 .'-]+TO:$/.test(h)?u="transition":h.startsWith("!")&&(u="action",g=f.replace(/^\s*!/,"")));n.push({raw:f,display:g,prefix:v,type:u,index:d}),h.includes("*/")&&(p=!1)}return n}function Yt(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=me(e),a=zt(t),i=new Map,s=[],l=[],p=new Set,d=[],f="",h=0,u="",g=0,v=0,x=0;n.forEach((w,b)=>{let _=(w.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(w.prefix&&d.push(w.prefix.slice(0,-1)),w.type==="section"){let E=w.raw.trim().match(/^(#{1,6})\s+(.+)$/);E&&(l.push({level:E[1].length,title:E[2],line:b+1}),E[1].length===1&&(u=E[2],g+=1))}else if(w.type==="scene"){let E=w.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),H=w.display.match(/#([^#]+)#/)?.[1]||String(s.length+1);s.push({number:H,heading:E,line:b+1,words:0,act:u||"Screenplay",actNumber:g}),h=s.length;let ne=E.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ne&&p.add(ne),f=""}else if(w.type==="character"){f=jt(w.display);let E=i.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};E.cues+=1,E.lastLine=b+1,h&&E.sceneSet.add(h),i.set(f,E)}else if(w.type==="dialogue"){let E=i.get(f);E&&(E.lines+=1,E.words+=_,v+=_,h&&E.sceneLineMap.set(h,(E.sceneLineMap.get(h)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(w.type)||(f="",x+=_,s.length&&(s.at(-1).words+=_))});let P=[...i.values()].map(w=>({...w,seconds:Math.round(w.words/130*60),scenes:w.sceneSet.size,sceneLines:[...w.sceneLineMap].map(([b,_])=>({scene:b,lines:_})),sceneSet:void 0,sceneLineMap:void 0})).sort((w,b)=>b.words-w.words||w.name.localeCompare(b.name)),F=v+x,B=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:F,dialogueWords:v,actionWords:x,estimatedSeconds:B==null?0:B*60,characters:P,scenes:s,sections:l,locations:[...p].sort(),titleFields:d,pageCount:B,...a}}function Ne(e,t=null){let n=e.raw.trim().match(/^>\s*(.*?)\s*<$/),a=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,i=n?"centered":e.type,s=`script-line ${i}${a?" act":""}`,l=a?.[1]||e.display,p=a?"#":e.prefix;if(n?l=n[1]:i==="transition"&&e.raw.trim().startsWith(">")&&(l=e.raw.trim().slice(1).trimStart()),t!==null){let u=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");l=N.sceneNumbers==="inline"?`${t}. ${u}`:u}let d=i==="note"?ot(e.raw):null,f=l?Re(l):"<br>",h=t!==null?y(t):"";if(i==="note"&&!d){let u=it(e.raw);return`<div class="script-line note annotation-line" data-line="${e.index}"><button class="annotation-orb" type="button" data-annotation-line="${e.index}" title="${y(u)}" aria-label="Edit annotation: ${y(u)}"></button></div>`}return i==="note"&&d?`<div class="script-line note managed-note" data-line="${e.index}"></div>`:`<div class="${s}" data-line="${e.index}" data-prefix="${y(p)}" data-scene-number="${h}" data-display="${y(l)}">${f}</div>`}function Kt(e){let t=new Map;if(N.sceneNumbers==="off")return t;let n=0,a=0,i=0,s=N.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(a++,i=0):l.type==="scene"&&(n++,i++,t.set(l.index,s==="act"?`A${Math.max(a,1)}S${i}`:String(n)));return t}function qt(e){let t=Kt(e),n=[];for(let a=0;a<e.length;a+=1){if(e[a].type==="character"){let s=a+1;for(;s<e.length&&["dialogue","parenthetical","note"].includes(e[s].type);)s+=1;for(;s<e.length&&e[s].type==="empty";)s+=1;if(e[s]?.type==="character"&&e[s].raw.trim().endsWith("^")){let l=s+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(a,s).filter(f=>f.type!=="empty").map(f=>Ne(f)).join(""),d=e.slice(s,l).map(f=>Ne(f)).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${p}</div><div class="dual-right">${d}</div></div>`),a=l-1;continue}}let i=t.get(e[a].index)??null;n.push(Ne(e[a],i))}return n.join("")}function se({focusLine:e=null,focusOffset:t=null}={}){let n=me(c.value),a=o("#preview-scroll"),i=o("#preview-page-stage"),s=a.scrollTop,l=a.scrollLeft;m.innerHTML=qt(n),m.spellcheck=o("#spellcheck").checked;let p=n.some(d=>d.raw.trim());if(o("#empty-state").hidden=p,i.hidden=r.previewMode!=="live",m.hidden=r.previewMode!=="live",e!==null){let d=o(`[data-line="${e}"]`,m);if(m.focus({preventScroll:!0}),d){let f=t??d.textContent.length;J(d,f),D(d,f)}}a.scrollTop=s,a.scrollLeft=l,requestAnimationFrame(()=>{a.scrollTop=s,a.scrollLeft=l}),ut(),O()}function J(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),a=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),i=a.nextNode();for(;i&&n>i.textContent.length;)n-=i.textContent.length,i=a.nextNode();let s=document.createRange();i?s.setStart(i,n):(s.selectNodeContents(e),s.collapse(!1)),s.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(s)}function Zt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let d of e.matchAll(a)){let f=d[1].length;for(let h=d.index;h<d.index+f;h+=1)t[h]=!0;for(let h=d.index+d[0].length-f;h<d.index+d[0].length;h+=1)t[h]=!0,n[h]=!0}let i=t.flatMap((d,f)=>d?[]:[f]),s=Array.from({length:i.length+1},(d,f)=>f<i.length?i[f]:(i.at(-1)??-1)+1),l=Array.from({length:i.length+1},(d,f)=>f?i[f-1]+1:i[0]??0),p=Array.from({length:i.length+1},(d,f)=>{let h=f?i[f-1]+1:0,u=f<i.length?i[f]:e.length;for(;h<u&&n[h];)h+=1;return h});return{startMap:s,endMap:l,caretMap:p}}function Xt(e,t){let n=0,a=t.length,i=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",i)+1,t[n]===" "&&(n+=1);let s=t.lastIndexOf("<");a=s<n?a:s,t[a-1]===" "&&(a-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",i)+1;else if(e.classList.contains("character")&&t.slice(i).startsWith("@"))n=i+1;else if(e.classList.contains("transition")&&t.slice(i).startsWith(">"))for(n=i+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let s=t.indexOf(e.dataset.prefix,i);for(n=s<0?0:s+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let s=t.slice(n,a).match(/\s+#[^#]+#\s*$/);s&&(a=n+s.index)}return{start:n,end:a,map:Zt(t.slice(n,a))}}function W(e,t,n,a="caret"){let i=Xt(e,t),s=e.dataset.sceneNumber&&N.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-s,i.map.startMap.length-1)),p=a==="start"?i.map.startMap:a==="end"?i.map.endMap:i.map.caretMap;return i.start+(p[l]??i.end-i.start)}function Jt(e,t){let n=[],a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let i of e.matchAll(a)){let s=i.index+i[1].length,l=i.index+i[0].length-i[1].length;t>=s&&t<=l&&n.push(i[1])}return n}function Ze(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let a=document.createRange();return a.selectNodeContents(e),a.setEnd(t,n),a.toString().length}function R(e=k(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),a=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,i=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,s=a?.closest?.(".script-line")||e,l=i?.closest?.(".script-line")||e;return{startLine:s,endLine:l,startOffset:Ze(s,n.startContainer,n.startOffset),endOffset:Ze(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function Xe(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let a=R(e);if(!a||a.startLine!==a.endLine||a.startOffset!==a.endOffset)return!1;if(!e.textContent.length)return!0;let i=document.createRange();i.selectNodeContents(e);let s=[...i.getClientRects()],l=t==="first"?s[0]?.top:s.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let d=[...p.getClientRects()];return d.length?l!==void 0&&d.length>0&&d.every(f=>Math.abs(f.top-l)<1):t==="first"?a.startOffset===0:a.startOffset===e.textContent.length}function ie(e,t,n){return e.slice(0,t).reduce((a,i)=>a+i.length+1,0)+n}function D(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.dataset.line),i=W(e,n[a]||"",t),s=ie(n,a,i);c.setSelectionRange(s,s),Pe(a),I()}function at(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),a=Number(e.endLine.dataset.line),i=W(e.startLine,t[n]||"",e.startOffset,"start"),s=W(e.endLine,t[a]||"",e.endOffset,"end"),l=ie(t,n,i),p=ie(t,a,s);c.setSelectionRange(l,p,e.direction),Pe(e.direction==="backward"?n:a),I()}function st(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=e.dataset.display??e.textContent,i=e.textContent.replace(/\n/g,""),s=0;for(;s<a.length&&s<i.length&&a[s]===i[s];)s+=1;let l=a.length,p=i.length;for(;l>s&&p>s&&a[l-1]===i[p-1];)l-=1,p-=1;let d=s===l,f=W(e,n[t],s,d?"caret":"start"),h=W(e,n[t],l,d?"caret":"end"),u=n[t].slice(0,f)+i.slice(s,p)+n[t].slice(h);n[t]=u,e.dataset.display=i,e.innerHTML=Re(i)||"<br>",J(e,p),c.value=n.join(`
`);let g=ie(n,t,f+p-s);c.setSelectionRange(g,g),$({fromPreview:!0})}function U(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.startLine.dataset.line),i=Number(e.endLine.dataset.line),s=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),d=`${s}${p}${l}`.split(`
`),f=a===i&&e.startOffset===e.endOffset,h=W(e.startLine,n[a],e.startOffset,f?"caret":"start"),u=W(e.endLine,n[i],e.endOffset,f?"caret":"end"),g=n[i].slice(u),v=a===i?[]:n.slice(a+1,i).filter(b=>/^\s*\[\[.*\]\]\s*$/.test(b));if(a===i&&p.includes(`
`)){let b=Jt(n[a],h);b.length&&(p=p.replaceAll(`
`,`${[...b].reverse().join("")}
${b.join("")}`))}let x=`${n[a].slice(0,h)}${p}${n[i].slice(u)}`.split(`
`);if(a===i&&e.startLine.classList.contains("centered")&&x.length>1){x[0]=`${x[0].trimEnd()} <`,x[x.length-1]=`> ${x.at(-1).trimStart()}`;for(let b=1;b<x.length-1;b+=1)x[b]=`> ${x[b]} <`}n.splice(a,i-a+1,...x,...v),c.value=n.join(`
`);let P=a+d.length-1,F=d.length===1?s.length+t.length:t.split(/\r\n?|\n/).at(-1).length,B=x.at(-1).length-g.length,w=ie(n,P,Math.max(0,B));c.setSelectionRange(w,w),$({fromPreview:!0}),a===i&&d.length===1?(e.startLine.innerHTML=Re(d[0])||"<br>",e.startLine.dataset.display=d[0],m.focus({preventScroll:!0}),J(e.startLine,F),D(e.startLine,F),rt(e.startLine)):se({focusLine:P,focusOffset:F})}function Vt(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return U(e,"");let a=e.startLine,i=Number(a.dataset.line),s=a.textContent;if(t==="backward"&&e.startOffset>0){let l=s.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<s.length){let l=s.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=j(".script-line[data-display]",m),p=l.indexOf(a),d=l[p+(t==="backward"?-1:1)];if(!d)return;t==="backward"?(e.startLine=d,e.startOffset=d.textContent.length):(e.endLine=d,e.endOffset=0)}U(e,"")}function G(){o("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function rt(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),a=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(a)||n&&!/^[A-Z0-9 ._'-]*$/.test(a))return G();r.previewCompletionItems=r.metadata.characters.map(i=>i.name).filter((i,s,l)=>i.startsWith(a)&&i!==a&&l.indexOf(i)===s),r.previewCompletionIndex=0,r.previewCompletionLine=e,lt()}function lt(){let e=o("#preview-completion-menu");if(!r.previewCompletionItems.length)return G();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${y(t)}</span><small>Character</small></button>`).join(""),Qt()}function Qt(){let e=o("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=o(".preview-panel").getBoundingClientRect(),a=getSelection(),i=t.getBoundingClientRect();if(a?.rangeCount&&t.contains(a.focusNode)){let h=document.createRange();if(h.setStart(a.focusNode,a.focusOffset),h.collapse(!0),i=h.getClientRects()[0]||h.getBoundingClientRect(),!i.width&&!i.height){let u=document.createRange();u.selectNodeContents(t),u.setEnd(a.focusNode,a.focusOffset);let g=u.getBoundingClientRect(),v=t.getBoundingClientRect();i={left:g.right,right:g.right,top:v.top,bottom:v.bottom,width:0,height:v.height}}}let s=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-s-8,i.left)),p=Math.min(e.scrollHeight,245),d=i.bottom+6,f=d+p<=n.bottom-8?d:Math.max(n.top+8,i.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function ct(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,st(n),G(),m.focus({preventScroll:!0}),J(n,n.textContent.length))}function re(){nn(),ge(),en(),I()}function en(){let e=o("#line-numbers"),t=o("#source-highlight"),n=t.getBoundingClientRect(),a=c.value.split(`
`).map((s,l)=>{let d=o(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=d?d.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),i=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${a}<span class="line-number-spacer" style="height:${i}px"></span>`,e.scrollTop=c.scrollTop}function tn(e){return y(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function nn(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=me(c.value);o("#source-highlight").innerHTML=t.map((n,a)=>{let i=e[n.type],s=tn(n.raw)||" ",l=a<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${i?` class="syntax-${i}"`:""}>${s}${l}</span>`}).join("")}function fe(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function ge(){let e=o("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=fe(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=fe(e,t)}function V(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function on(e,t="nearest"){let n=o("#preview-scroll"),a=e.getBoundingClientRect(),i=n.getBoundingClientRect(),s=n.scrollTop,l=n.scrollLeft;t==="center"?s+=a.top-i.top-(n.clientHeight-a.height)/2:a.top<i.top?s+=a.top-i.top:a.bottom>i.bottom&&(s+=a.bottom-i.bottom),a.left<i.left?l+=a.left-i.left:a.right>i.right&&(l+=a.right-i.right),n.scrollTop=Math.max(0,s),n.scrollLeft=fe(n,l)}function Pe(e,t="nearest"){if(!c.clientHeight)return;let n=o("#source-highlight"),i=o(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!i)return;let s=getComputedStyle(c),l=parseFloat(s.paddingTop)||0,p=parseFloat(s.paddingBottom)||0,d=parseFloat(s.lineHeight)||20.15,f=i.top-n.getBoundingClientRect().top+n.scrollTop,h=f+d,u=c.scrollTop;t==="center"?u=f-(c.clientHeight-d)/2:f<c.scrollTop+l?u=f-l:h>c.scrollTop+c.clientHeight-p&&(u=h-c.clientHeight+p),c.scrollTop=Math.max(0,u),ge(),o("#line-numbers").scrollTop=c.scrollTop}function ut(e=!1,t="nearest"){let n=o(`[data-line="${V().line}"]`,m);j(".script-line.source-current",m).forEach(a=>a.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&on(n,t)}function I({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=V();o("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let a=me(c.value)[n.line]?.type||"action",i={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};o("#editor-status").textContent=i[a]||a[0].toUpperCase()+a.slice(1);let s=getComputedStyle(c),l=parseFloat(s.lineHeight)||20.15,p=o(`[data-source-line="${n.line}"]`,o("#source-highlight")),d=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(s.paddingTop):-c.scrollTop;o("#current-line").style.height=`${l}px`,o("#current-line").style.transform=`translateY(${d}px)`,ut(e,t)}function dt(e){r.metadata=e,o("#stat-pages").textContent=e.pageCount??"\u2014",o("#stat-scenes").textContent=e.scenes.length,o("#stat-words").textContent=e.wordCount.toLocaleString(),o("#scene-count").textContent=e.scenes.length,o("#character-count").textContent=e.characters.length,o("#scene-list").innerHTML=rn(e),an(),sn();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;o("#dialogue-bar").style.width=`${n}%`,o("#dialogue-percent").textContent=`${n}%`,o("#action-percent").textContent=`${100-n}%`,o("#character-analytics-dialog").open&&Fe()}function an(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};o("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let a=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${y(n.name)}">${y(n.name)}${a?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function sn(){let e=r.metadata.generalNotes||[];o("#general-note-count").textContent=e.length,o("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${y(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function _e(e,t=e.number){return`<li><span class="scene-num">${y(t)}</span><button type="button" data-line="${e.line}">${y(e.heading)}</button></li>`}function rn(e){let t=e.scenes||[],n=(e.sections||[]).filter(s=>s.level===1);if(!n.length)return t.length?t.map(s=>_e(s)).join(""):'<li class="empty-list">No scene headings yet.</li>';let a=t.filter(s=>!s.actNumber).map(s=>_e(s)).join(""),i=n.map((s,l)=>{let p=l+1,d=t.filter(f=>f.actNumber===p).map((f,h)=>_e(f,String(h+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${s.line}"><span>${l+1}</span>${y(s.title)}</button><ol>${d||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return a+i}function q(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function de(e,t,n){let a=String(t);if(e.measureText(a).width<=n)return a;let i=a;for(;i.length&&e.measureText(`${i}\u2026`).width>n;)i=i.slice(0,-1);return i?`${i}\u2026`:""}function Fe(){let e=o("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,a=Math.min(window.devicePixelRatio||1,2),i=150,s=92,l=28,p=54,d=34,f=Math.max(720,i+n.length*s+18),h=l+p+Math.max(t.length,1)*d+18;e.width=Math.ceil(f*a),e.height=Math.ceil(h*a),e.style.width=`${f}px`,e.style.height=`${h}px`;let u=e.getContext("2d");u.scale(a,a);let g=q("--surface","#fff"),v=q("--surface-2","#f2f2f2"),x=q("--ink","#202124"),P=q("--muted","#6b7280"),F=q("--border","#d7d9dd"),B=q("--syntax-character","#7c3aed"),w=t.flatMap(S=>(S.sceneLines||[]).map(L=>L.lines)).filter(S=>S>0),b=w.length?Math.min(...w):0,_=w.length?Math.max(...w):0,E=o("#character-analytics-legend");E.hidden=!w.length,o("#character-analytics-min").textContent=`${b} ${b===1?"line":"lines"}`,o("#character-analytics-max").textContent=`${_} ${_===1?"line":"lines"}`,u.fillStyle=g,u.fillRect(0,0,f,h),u.strokeStyle=F,u.lineWidth=1,u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.textBaseline="middle";let H=0;for(;H<n.length;){let S=n[H].act||"Screenplay",L=H+1;for(;L<n.length&&(n[L].act||"Screenplay")===S;)L+=1;let T=i+H*s,K=(L-H)*s;u.fillStyle=v,u.fillRect(T,0,K,l),u.fillStyle=x,u.textAlign="center",u.fillText(de(u,S,K-12),T+K/2,l/2),u.strokeRect(T+.5,.5,K,l),H=L}u.fillStyle=v,u.fillRect(0,0,i,l+p),u.fillStyle=P,u.textAlign="left",u.fillText("CHARACTER",12,l+p/2);let ne=new Map,Ht=n.map((S,L)=>{if(!S.actNumber)return String(L+1);let T=(ne.get(S.actNumber)||0)+1;return ne.set(S.actNumber,T),String(T)});n.forEach((S,L)=>{let T=i+L*s;u.strokeStyle=F,u.strokeRect(T+.5,l+.5,s,p),u.fillStyle=x,u.textAlign="center",u.fillText(de(u,Ht[L],s-10),T+s/2,l+16),u.fillStyle=P,u.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.fillText(de(u,S.heading,s-10),T+s/2,l+36),u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((S,L)=>{let T=l+p+L*d;L%2===1&&(u.fillStyle=v,u.fillRect(0,T,i+n.length*s,d)),u.fillStyle=x,u.textAlign="left",u.fillText(de(u,S.name,i-20),12,T+d/2);let K=new Map((S.sceneLines||[]).map(Se=>[Se.scene,Se.lines]));n.forEach((Se,Ge)=>{let Le=K.get(Ge+1)||0;if(!Le)return;let Ye=i+Ge*s+4,Ke=_===b?1:.25+.75*((Le-b)/(_-b));u.save(),u.globalAlpha=Ke,u.fillStyle=B,u.fillRect(Ye,T+7,s-8,d-14),u.restore(),u.fillStyle=Ke>=.6?"#fff":x,u.textAlign="center",u.fillText(String(Le),Ye+(s-8)/2,T+d/2)})}),n.length||(u.fillStyle=P,u.textAlign="center",u.fillText("Add scene headings to build the timeline.",f/2,l+p+d/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${b} to ${_} dialogue lines`)}function ln(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function cn(){Fe(),o("#character-analytics-dialog").showModal()}async function un(){try{await navigator.clipboard.writeText(ln()),C("Line usage CSV copied")}catch{C("Clipboard access was denied")}}async function dn(){Fe();let e=await new Promise(t=>o("#character-analytics-chart").toBlob(t,"image/png"));if(!e){C("Could not create analytics image");return}await ze(e,ae("character-analytics.png")),C("Character analytics PNG saved")}function pn(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function pt(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=m.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],$({fromPreview:t!==null,record:!1}),t!==null?se({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function ft(){pt(r.historyIndex-1)}function Ae(){pt(r.historyIndex+1)}function $({fromPreview:e=!1,record:t=!0}={}){t&&pn(),document.body.classList.toggle("dirty",c.value!==r.savedSource),re(),e||se(),dt(Yt(c.value)),He(),A()}function He(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;o("#compile-status").textContent="Editing\u2026",o("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>Z?mt(t):fn(t),Z?Math.max(e,700):e)}function ht(e,t=Z){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),a=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;o("#compile-status").textContent=a,o("#compile-status").title=a,o("#compile-status").classList.add("error")}async function mt(e){o("#compile-status").textContent="Compiling\u2026";try{let t=await Tt("pdf",o("#page-size").value),n=await gt(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,o("#stat-pages").textContent=n,o("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;ht(t,!0)}}async function fn(e){let t=new AbortController;r.compileController=t,o("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:o("#page-size").value,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat}),signal:t.signal});if(Nt(n,"application/json")){Z=!0,await mt(e);return}let a=await n.json();if(!n.ok)throw new Error(a.error||"Compilation failed");if(a.pageCount==null&&(a.pageCount=await gt(await he("/api/render/pdf"))),a.estimatedSeconds=a.pageCount*60,e!==r.compileRevision)return;dt(a),o("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;ht(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function gt(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function hn(){let{line:e,start:t}=V(),n=c.value.split(`
`),i=n[e].slice(0,c.selectionStart-t).trim(),s=i.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],d=(u,g,v="\u0192")=>p.push({value:u,detail:g,icon:v}),f=(s?i.slice(1):i.split(/\s+/).at(-1)).toUpperCase();(s||f&&r.metadata.characters.some(u=>u.name.startsWith(f)))&&r.metadata.characters.forEach(u=>d(u.name,`${u.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!i||/^[A-Za-z ]*$/.test(i))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(u=>!r.metadata.titleFields.some(g=>`${g}:`.toLowerCase()===u.trim().toLowerCase())).forEach(u=>d(u,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(i)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(u=>d(u,"Time of day","\u25F7")):Oe(i)||/^(?:INT|EXT|EST|I\/E)/i.test(i)?r.metadata.locations.forEach(u=>d(u,"Existing location","\u2302")):l&&(s||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(u=>d(u,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(u=>d(u,"Transition","\u2192"))));let h=(s?i.slice(1):i).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((u,g)=>p.findIndex(v=>v.value===u.value)===g&&(u.icon!=="@"||u.value.toUpperCase()!==f)&&(!h||u.value.toUpperCase().startsWith(h)||u.detail==="Existing location"))}function wt({allowBlank:e=!1}={}){let{line:t,start:n}=V(),a=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!a||(r.completionItems=hn(),r.completionIndex=0,!r.completionItems.length))return z();yt()}function yt(){let e=o("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${y(t.icon)}</span><span>${y(t.value)}</span><small>${y(t.detail)}</small></button>`).join(""),mn(),o(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function z(){o("#completion-menu").hidden=!0,r.completionItems=[]}function mn(){let e=o("#completion-menu"),t=c.getBoundingClientRect(),n=o("#source-panel").getBoundingClientRect(),a=getComputedStyle(c),i=document.createElement("div"),s=document.body.classList.contains("source-wrap"),l=fe(c);Object.assign(i.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:a.boxSizing,left:`${t.left-(s?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${s?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:a.padding,border:a.border,font:a.font,letterSpacing:a.letterSpacing,lineHeight:a.lineHeight,whiteSpace:s?"pre-wrap":"pre",overflowWrap:s?"anywhere":"normal",tabSize:a.tabSize}),i.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",i.append(p),document.body.append(i);let d=p.getBoundingClientRect();i.remove();let f=Math.min(310,n.width-16),h=Math.max(n.left+8,Math.min(n.right-f-8,d.left)),u=Math.min(e.scrollHeight,245),g=d.bottom+5,v=g+u<=n.bottom-8?g:Math.max(n.top+8,d.top-u-5);e.style.left=`${h}px`,e.style.top=`${v}px`,e.style.right="auto",e.style.bottom="auto"}function bt(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=V(),i=c.value.slice(0,c.selectionStart).slice(n.start),s=n.start;if(t.icon==="@"){let p=i.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";s=c.selectionStart-p.length}else/\s-\s/.test(i)?s=n.start+i.lastIndexOf("-")+2:i.trim()&&(s=n.start+i.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,s,c.selectionStart,"end"),z(),$()}async function vt(){await Be()&&(r.handle=null,Q("","Untitled.fountain",!0),c.focus())}async function Be(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function xt(){if(await Be()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();Q(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&C(e.message);return}o("#file-input").click()}}function Q(e,t,n=!1,a=null){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),r.githubFile=a,o("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,$()}async function De(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:ae("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await ze(new Blob([c.value],{type:"text/plain;charset=utf-8"}),ae("fountain"));r.savedSource=c.value,Q(c.value,r.filename,!0),C(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&C(t.message)}}async function Y(e,t={}){let n=await fetch(`${Me}${e}`,{credentials:"include",...t}),a=await n.json().catch(()=>({}));if(!n.ok)throw new Error(a.error||`GitHub request failed (${n.status})`);return a}function Ct(){o("#github-connect").textContent=r.githubConnected?"GitHub browser\u2026":"Connect GitHub\u2026",o("#github-open").disabled=!r.githubConnected,o("#github-save").disabled=!r.githubConnected}async function Ue({notify:e=!1}={}){try{let t=await Y("/api/session");r.githubConnected=!0,r.githubInstallUrl=t.installUrl,o("#github-account").textContent=`Connected as ${t.login}`,e&&C(`Connected to GitHub as ${t.login}`)}catch{r.githubConnected=!1,r.githubInstallUrl="",o("#github-account").textContent="Not connected"}return Ct(),r.githubConnected}function Et(e){let t=window.open(e,"fountain-publisher-github","popup,width=600,height=760");return t||C("Allow popups to connect GitHub"),t}async function St(){if(r.githubConnected)return be();Et(`${Me}/auth/github/start`)}function we(){let e=o("#github-repository").selectedOptions[0];if(!e?.value)return null;let[t,n]=e.value.split("/");return{owner:t,repo:n,fullName:e.value,defaultBranch:e.dataset.defaultBranch}}function We(e=r.githubPath){let t=we(),n=o("#github-branch").value;return t?`/api/contents?${new URLSearchParams({owner:t.owner,repo:t.repo,branch:n,path:e})}`:""}function gn(){let e=r.githubPath?r.githubPath.split("/"):[],t=['<button type="button" data-github-path="">Root</button>'];e.forEach((n,a)=>{t.push("<span>/</span>",`<button type="button" data-github-path="${y(e.slice(0,a+1).join("/"))}">${y(n)}</button>`)}),o("#github-breadcrumbs").innerHTML=t.join("")}async function ye(e=""){r.githubPath=e,gn();let t=o("#github-files");t.innerHTML='<div class="github-empty">Loading repository\u2026</div>';try{let n=await Y(We(e)),a=(Array.isArray(n)?n:[n]).filter(i=>i.type==="dir"||/\.(fountain|txt)$/i.test(i.name)).sort((i,s)=>i.type===s.type?i.name.localeCompare(s.name):i.type==="dir"?-1:1);t.innerHTML=a.length?a.map(i=>`<button type="button" role="listitem" data-github-entry="${y(i.path)}" data-github-type="${i.type}"><span>${i.type==="dir"?"\u25B8":"F"}</span><span>${y(i.name)}</span><small>${i.type==="dir"?"Folder":"Fountain"}</small></button>`).join(""):'<div class="github-empty">No Fountain files in this folder.</div>'}catch(n){t.innerHTML=`<div class="github-empty">${y(n.message)}</div>`}}async function Lt(){let e=we();if(!e)return;let t=await Y(`/api/branches?${new URLSearchParams({owner:e.owner,repo:e.repo})}`);o("#github-branch").innerHTML=t.branches.map(n=>`<option value="${y(n)}"${n===e.defaultBranch?" selected":""}>${y(n)}</option>`).join(""),await ye("")}async function wn(){let e=await Y("/api/repositories");if(r.githubInstallUrl=e.installUrl,o("#github-install").hidden=!1,o("#github-repository").innerHTML=e.repositories.map(t=>`<option value="${y(t.fullName)}" data-default-branch="${y(t.defaultBranch)}">${y(t.fullName)}${t.private?" \xB7 Private":""}</option>`).join(""),!e.repositories.length){o("#github-files").innerHTML='<div class="github-empty">Install Fountain Publisher on at least one repository to browse files.</div>',o("#github-branch").innerHTML="";return}await Lt()}async function be(){if(!r.githubConnected&&!await Ue())return St();je(),o("#github-filename").value=ae("fountain"),o("#github-dialog").showModal();try{await wn()}catch(e){C(e.message)}}function yn(e){let t=atob(e.replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(t,n=>n.charCodeAt(0)))}async function bn(e){if(await Be())try{let t=we(),n=o("#github-branch").value,a=await Y(We(e)),i={owner:t.owner,repo:t.repo,branch:n,path:e,sha:a.sha};r.handle=null,Q(yn(a.content),a.name,!0,i),o("#github-dialog").close(),C(`Opened ${t.fullName}/${e}`)}catch(t){C(t.message)}}async function vn(){let e=we(),t=o("#github-branch").value,n=o("#github-filename").value.trim(),a=o("#github-commit-message").value.trim();if(!e||!t||!/^[^/]+\.(fountain|txt)$/i.test(n))return C("Enter a .fountain file name");let i=[r.githubPath,n].filter(Boolean).join("/"),s=r.githubFile,l=s&&s.owner===e.owner&&s.repo===e.repo&&s.branch===t&&s.path===i?s.sha:void 0;try{let p=await Y(We(i),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({content:c.value,message:a||`Update ${n}`,sha:l})});r.githubFile={owner:e.owner,repo:e.repo,branch:t,path:i,sha:p.sha},r.filename=n,r.savedSource=c.value,o("#filename").textContent=n,document.title=`${n} \u2014 Fountain Publisher`,document.body.classList.remove("dirty"),o("#github-dialog").close(),C(`Committed ${e.fullName}/${i}`)}catch(p){C(p.message)}}function ae(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function ze(e,t){let n=URL.createObjectURL(e),a=document.createElement("a");a.href=n,a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function xn(e,t){let a={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(a)){await navigator.share(a);return}await ze(e,t)}var pe;async function Cn(){return pe||(pe=(async()=>{o("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let a=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(a.map(async i=>{let s=await fetch(new URL(`fonts/${i}`,import.meta.url));if(!s.ok)throw new Error(`Unable to load PDF font ${i}`);n.FS.writeFile(`/fonts/${i}`,new Uint8Array(await s.arrayBuffer()))})),await n.runPythonAsync(`
import micropip
await micropip.install(_fp_six_wheel, deps=False)
await micropip.install(_fp_pillow_wheel, deps=False)
await micropip.install(_fp_charset_wheel, deps=False)
await micropip.install(_fp_reportlab_wheel, deps=False)
await micropip.install(_fp_screenplain_wheel, deps=False)
`),n.runPython(`
import io
import re
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from screenplain.export import fdx, pdf
from screenplain.parsers.fountain import parse
from screenplain.richstring import bold, plain
from screenplain.types import Action, Section, Slug

def _fp_register_pdf_fonts():
    try:
        fonts = {
            "CourierPrime": "/fonts/CourierPrime-Regular.ttf",
            "CourierPrime-Bold": "/fonts/CourierPrime-Bold.ttf",
            "CourierPrime-Italic": "/fonts/CourierPrime-Italic.ttf",
            "CourierPrime-BoldItalic": "/fonts/CourierPrime-BoldItalic.ttf",
        }
        for name, path in fonts.items():
            try:
                pdfmetrics.getFont(name)
            except KeyError:
                pdfmetrics.registerFont(TTFont(name, path))
        pdfmetrics.registerFontFamily(
            "CourierPrime",
            normal="CourierPrime",
            bold="CourierPrime-Bold",
            italic="CourierPrime-Italic",
            boldItalic="CourierPrime-BoldItalic",
        )
        return ("CourierPrime", "CourierPrime", "CourierPrime-Bold", "CourierPrime-Italic", "CourierPrime-BoldItalic")
    except Exception:
        return ("Courier", "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique")

def _fp_number_scenes(screenplay, placement="margin", format_type="sequential"):
    if placement == "off":
        for paragraph in screenplay.paragraphs:
            if isinstance(paragraph, Slug):
                paragraph.scene_number = None
        return screenplay
    act_num = 0
    act_scene_num = 0
    sequential = 0
    try:
        from screenplain.types import Section as _Section
    except Exception:
        _Section = None
    for paragraph in screenplay.paragraphs:
        if _Section is not None and isinstance(paragraph, _Section) and getattr(paragraph, "level", 0) == 1:
            act_num += 1
            act_scene_num = 0
        elif isinstance(paragraph, Slug):
            sequential += 1
            act_scene_num += 1
            label = f"A{max(act_num, 1)}S{act_scene_num}" if format_type == "act" else str(sequential)
            if placement == "margin":
                paragraph.scene_number = plain(label)
            else:
                paragraph.line = plain(f"{label}. ") + paragraph.line
                paragraph.scene_number = None
    return screenplay

def _fp_prepare_screenplay(source, placement="margin", format_type="sequential"):
    from screenplain.types import PageBreak
    source = re.sub(r"(?m)^([^\\S\\r\\n]*)>(\\S(?:.*\\S)?)<[^\\S\\r\\n]*$", r"\\1> \\2 <", source)
    screenplay = parse(io.StringIO(source))
    if screenplay.title_page and screenplay.paragraphs and isinstance(screenplay.paragraphs[0], PageBreak):
        del screenplay.paragraphs[0]
    return _fp_number_scenes(screenplay, placement, format_type)

def _fp_format_pdf_act_headings(screenplay):
    screenplay.paragraphs = [
        Slug(bold(str(paragraph.text).upper()), scene_number=None)
        if isinstance(paragraph, Section)
        and getattr(paragraph, "level", 0) == 1
        and re.match(r"^Act\\b", str(paragraph.text), re.IGNORECASE)
        else paragraph
        for paragraph in screenplay.paragraphs
    ]
    return screenplay

def _fp_patch_scene_numbers_left_only():
    try:
        from reportlab.lib.units import inch as _inch
        def _left_only_draw(self):
            self.slug_paragraph.drawOn(self.canv, 0, 0)
            canvas = self.canv
            canvas.saveState()
            canvas.setFont(self.settings.font_settings.family_name, self.settings.font_size)
            canvas.drawString(-0.75 * _inch, 0, self.scene_number)
            canvas.restoreState()
        pdf.SlugWithSceneNumbers.draw = _left_only_draw
    except Exception:
        pass
_fp_patch_scene_numbers_left_only()

def _fp_compile(source, kind, page_size, scene_numbers="margin", scene_number_format="sequential"):
    screenplay = _fp_prepare_screenplay(source, scene_numbers, scene_number_format)
    font_family, regular_font, bold_font, italic_font, bold_italic_font = _fp_register_pdf_fonts()
    if kind == "pdf":
        screenplay = _fp_format_pdf_act_headings(screenplay)
        output = io.BytesIO()
        settings = pdf.Settings(page_size=A4 if page_size == "a4" else letter, strong_slugs=False)
        font_settings = getattr(settings, "font_settings", None)
        if font_settings is not None:
            font_settings.family_name = font_family
            font_settings.regular = regular_font
            font_settings.bold = bold_font
            font_settings.italic = italic_font
            font_settings.bold_italic = bold_italic_font
        if hasattr(settings, "slug_style"):
            settings.slug_style.fontName = bold_font
        settings.title_style.fontSize = settings.font_size
        title_leading = settings.line_height * 2
        for style_name in ("title_style", "centered_style", "default_style", "contact_style"):
            style = getattr(settings, style_name, None)
            if style is not None:
                style.fontName = regular_font
                style.fontSize = settings.font_size
                style.leading = title_leading
        if hasattr(settings, "title_style"):
            settings.title_style.spaceAfter = -settings.line_height
        if hasattr(settings, "default_style"):
            settings.default_style.spaceAfter = -settings.line_height
        if hasattr(settings, "contact_style"):
            settings.contact_style.spaceAfter = -settings.line_height
        class NumberedDocTemplate(pdf.DocTemplate):
            def handle_pageBegin(self):
                _font_settings = getattr(self.settings, "font_settings", None)
                self.canv.setFont(getattr(_font_settings, "family_name", "Courier"), self.settings.font_size, leading=self.settings.line_height)
                page = self.page if self.has_title_page else self.page + 1
                if page >= 1:
                    self.canv.drawRightString(self.settings.left_margin + self.settings.frame_width, self.settings.page_height - 42, f"{page}.")
                self._handle_pageBegin()
        pdf.to_pdf(screenplay, output, template_constructor=NumberedDocTemplate, settings=settings)
        return output.getvalue()
    if kind == "fdx":
        output = io.BytesIO()
        try:
            fdx.to_fdx(screenplay, output)
            return output.getvalue()
        except TypeError:
            text = io.StringIO()
            fdx.to_fdx(screenplay, text)
            return text.getvalue().encode("utf-8")
    raise ValueError(f"Unsupported export kind: {kind}")
`),o("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw pe=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),pe}async function Tt(e,t){let n=await Cn();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",N.sceneNumbers),n.globals.set("_fp_scene_number_format",N.sceneNumberFormat);let a=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),i=a instanceof Uint8Array?a:a.toJs();a.destroy?.();let s={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([i],{type:s[e]})}function Nt(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function Je(e,t){return Tt(e==="/api/render/pdf"?"pdf":"fdx",t)}async function he(e,t=o("#page-size").value){if(Z)return Je(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat})});if(Nt(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return Z=!0,Je(e,t);if(!n.ok){let i=await n.json().catch(()=>({}));throw new Error(i.error||"Export failed")}return n.blob()}async function En(e){o("#confirm-export").disabled=!0;try{let t=e==="pdf"?await he("/api/render/pdf",o("#export-page-size").value):await he("/api/export/fdx");await xn(t,ae(e)),o("#export-dialog").close(),C(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&C(t.message)}finally{o("#confirm-export").disabled=!1}}function _t(e){o("#export-format").value=e,o("#export-page-size").value=o("#page-size").value,o("#dialog-page-size").hidden=e!=="pdf",o("#export-dialog").showModal()}function le(){return matchMedia("(max-width: 640px)").matches}async function ve(e){le()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),j("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=o(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),o("#preview-page-stage").hidden=e!=="live",m.hidden=e!=="live",o("#empty-state").hidden=e!=="live"||!!c.value.trim(),o("#pdf-view").hidden=e!=="pdf",o("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),A(),e==="pdf"&&await xe()}async function xe(){o("#pdf-placeholder").hidden=!1,o("#pdf-frame").hidden=!0;try{let e=await he("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),o("#pdf-frame").src=r.pdfUrl,o("#pdf-frame").hidden=!1,o("#pdf-placeholder").hidden=!0}catch(e){o("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${y(e.message)}</span>`}}function At(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,o("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),o("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function Sn(){let e=document.documentElement.dataset.effectiveTheme||"light";At(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),o(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),o(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(O)}function Ve(e,t,n,a,i){let s=0,l=0,p=d=>{let f=Math.max(a,Math.min(i,d));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&re(),r.previewZoom==="fit"&&requestAnimationFrame(O)};e.addEventListener("pointerdown",d=>{s=d.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(d.pointerId)}),e.addEventListener("pointermove",d=>{e.hasPointerCapture(d.pointerId)&&p(l+(d.clientX-s)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",d=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(d.key))return;d.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));d.key==="Home"?p(a):d.key==="End"?p(i):p(f+(d.key==="ArrowRight"?1:-1)*n*(d.shiftKey?30:10))})}function Qe(e=o("#preview-scroll")){let t=Math.max(0,e.scrollHeight-e.clientHeight),n=Math.max(0,e.scrollWidth-e.clientWidth);e.scrollTop=Math.max(0,Math.min(e.scrollTop,t)),e.scrollLeft=Math.max(0,Math.min(e.scrollLeft,n))}function O(){let e=r.previewZoom,t=o("#zoom"),n=o("#zoom-fit-value");if(o("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),le()){let l=e==="fit"?1:Number(e)/100;n.hidden=e!=="fit",e==="fit"?(n.textContent="100%",t.value="fit"):t.value=e,m.style.transform="none",m.style.marginBottom="0",m.style.marginRight="0",o("#preview-page-stage").style.removeProperty("width"),o("#preview-page-stage").style.removeProperty("min-height"),m.style.setProperty("--mobile-preview-zoom",l),requestAnimationFrame(()=>Qe()),A();return}m.style.removeProperty("--mobile-preview-zoom");let a=Number(e)/100;if(e==="fit"){let l=o("#preview-scroll"),p=getComputedStyle(l),d=l.clientWidth-parseFloat(p.paddingLeft)-parseFloat(p.paddingRight);a=Math.max(.25,Math.min(2,d/816))}n.hidden=e!=="fit",e==="fit"?(n.textContent=`${Math.round(a*100)}%`,t.value="fit"):t.value=e;let i=o("#preview-page-stage");i.style.width=`${816*a}px`,i.style.minHeight=`${Math.max(1056,m.scrollHeight)*a}px`,m.style.transform=`scale(${a})`,m.style.marginBottom="0",m.style.marginRight="0";let s=o("#preview-scroll");requestAnimationFrame(()=>{s.scrollLeft=Math.max(0,(s.scrollWidth-s.clientWidth)/2),Qe(s)}),A()}function kt(e){let t=["70","85","100","115","130","150","175","200"],n=o("#zoom");if(r.previewZoom==="fit"){let i=Number.parseInt(o("#zoom-fit-value").textContent,10)||100,s=t.map(Number),l=e>0?s.find(p=>p>i)??s.at(-1):[...s].reverse().find(p=>p<i)??s[0];n.value=String(l),r.previewZoom=n.value,O();return}let a=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,a+e))],r.previewZoom=n.value,O()}function $t(e,t=!0){let n=c.value.split(`
`),a=0;for(let d=0;d<Math.max(0,e-1);d+=1)a+=n[d].length+1;t&&c.focus(),c.setSelectionRange(a,a+(n[e-1]?.length||0)),I({scrollPreview:!0,scrollBlock:"center"});let i=o("#source-highlight"),l=o(`[data-source-line="${Math.max(0,e-1)}"]`,i)?.getClientRects()[0],p=l?l.top-i.getBoundingClientRect().top+i.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),o("#line-numbers").scrollTop=c.scrollTop,o("#source-highlight").scrollTop=c.scrollTop,I({scrollPreview:!0,scrollBlock:"center"})}function Ln(e){r.insightLine=e,$t(e,!1)}var et;function C(e){let t=o("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(et),et=setTimeout(()=>t.classList.remove("show"),2200)}function ee(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function ce(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),$()}function Mt(e){let t=ee();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),ce(t)}function Tn(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function Nn(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function It(e=null,t=null){let n=e===null?"":it(ee()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},o("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",o("#annotation-text").value=n,o("#delete-annotation").hidden=e===null,o("#annotation-dialog").showModal(),setTimeout(()=>o("#annotation-text").focus(),0)}function te(){let e=o("#preview-context-menu");e.hidden=!0,r.previewContextLine=null,r.previewContextEdit=null,r.previewContextText=""}function k(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function oe(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return m.contains(t.commonAncestorContainer)?e:null}function _n(e,t,n){let a=(l,p)=>{let d=document.createRange();return d.selectNodeContents(e),d.setEnd(l,p),d.toString().length},i=document.caretPositionFromPoint?.(t,n);if(i&&e.contains(i.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(i.offsetNode,i.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),m.focus({preventScroll:!0}),D(e,a(i.offsetNode,i.offset));return}let s=document.caretRangeFromPoint?.(t,n);if(s&&e.contains(s.startContainer)){let l=getSelection();s.collapse(!0),l?.removeAllRanges(),l?.addRange(s),m.focus({preventScroll:!0}),D(e,a(s.startContainer,s.startOffset));return}m.focus({preventScroll:!0}),J(e,e.textContent.length),D(e)}function An(e,t,n){let a=o("#preview-context-menu"),i=oe();r.previewContextLine=Number(e.dataset.line),r.previewContextEdit=R(k(i?.focusNode)||e),r.previewContextText=i?.toString()||"",a.hidden=!1,a.style.left="0px",a.style.top="0px";let{width:s,height:l}=a.getBoundingClientRect();a.style.left=`${Math.max(8,Math.min(window.innerWidth-s-8,t))}px`;let p=n;if(le()&&r.previewContextText&&i.rangeCount){let d=i.getRangeAt(0).getBoundingClientRect(),f=d.bottom+12,h=d.top-l-12;p=f+l<=window.innerHeight-8?f:h}a.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,p))}px`}async function kn(e,t,n={}){let a=Number.isInteger(t)?o(`[data-line="${t}"]`,m):null;if(e==="copy"){let i=oe(),s=n.text||i?.toString()||"";if(!s)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(s),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let i=oe(),s=n.text||i?.toString()||"";if(!s)return"Select text to cut";let l=n.edit||R(k(i?.focusNode)||a);if(!l)return"Select text to cut";try{return await navigator.clipboard.writeText(s),U(l,""),""}catch{try{return document.execCommand("copy")?(U(l,""),""):"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}if(e==="paste"){let i=n.edit||R(a||k(oe()?.focusNode));if(!i)return"Click where you want to paste";try{return U(i,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function $n(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},o("#character-note-heading").textContent=`${e} notes`,o("#character-note-text").value=t?.text||"",o("#delete-character-note").hidden=!t,o("#character-note-dialog").showModal(),setTimeout(()=>o("#character-note-text").focus(),0)}function Rt(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},o("#general-note-heading").textContent=t?"Edit general note":"Add general note",o("#general-note-text").value=t?.text||"",o("#delete-general-note").hidden=!t,o("#general-note-dialog").showModal(),setTimeout(()=>o("#general-note-text").focus(),0)}function Ce(e){if(e==null)return;let t=ee();t.splice(e,1),ce(t)}var Ee=j(".toolbar-menu");function je(e=null){Ee.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{$(),e.inputType==="insertText"?wt():z()});c.addEventListener("scroll",()=>{o("#line-numbers").scrollTop=c.scrollTop,ge(),I(),A()});c.addEventListener("click",()=>{I({scrollPreview:!0}),z(),A()});c.addEventListener("select",()=>{I({scrollPreview:!0}),A()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||I({scrollPreview:!0}),A()});c.addEventListener("keydown",e=>{if(!o("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,yt();return}if(e.key==="Tab"){e.preventDefault(),bt();return}if(e.key==="Escape"){e.preventDefault(),z();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),wt({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),$()):e.key==="Enter"&&z()});m.addEventListener("beforeinput",e=>{let t=k(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);if(!n)return;let a=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),i=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!a.has(e.inputType)&&!i.has(e.inputType)))if(e.preventDefault(),G(),i.has(e.inputType)){let s=e.inputType.includes("Forward");Vt(n,s?"forward":"backward",e.inputType.includes("Word"))}else{let s=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";U(n,s)}});m.addEventListener("input",e=>{let t=k(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(st(t),rt(t))});m.addEventListener("paste",e=>{let t=k(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);n&&(e.preventDefault(),U(n,e.clipboardData?.getData("text/plain")||""))});m.addEventListener("keydown",e=>{let t=k(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!o("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,lt();return}if(e.key==="Tab"){e.preventDefault(),ct();return}if(e.key==="Escape"){e.preventDefault(),G();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,a=n===-1?Xe(t,"first"):n===1&&Xe(t,"last");if(n&&a){let i=R(t),s=o(`[data-line="${Number(t.dataset.line)+n}"]`,m);if(i&&i.startLine===i.endLine&&i.startOffset===i.endOffset&&s){e.preventDefault();let l=Math.min(i.startOffset,s.textContent.length);m.focus({preventScroll:!0}),J(s,l),D(s,l)}}});m.addEventListener("focusin",()=>{let e=k(getSelection()?.focusNode);e&&D(e)});m.addEventListener("pointerup",e=>{let t=k(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&at(n)});m.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=k(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&at(n)});m.addEventListener("focusout",()=>setTimeout(()=>{o("#preview-completion-menu").matches(":hover")||G()},0));m.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),G();let n=oe();(!n||n.isCollapsed)&&_n(t,e.clientX,e.clientY),An(t,e.clientX,e.clientY)});m.addEventListener("click",e=>{te();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),It(Number(t.dataset.annotationLine)))});o("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n,previewContextEdit:a,previewContextText:i}=r,s=t.dataset.previewMenuAction;if(te(),s==="annotation")return It(null,n);let l=await kn(s,n,{edit:a,text:i});l&&C(l)});o("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),ct(Number(t.dataset.index)))});o("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),bt(Number(t.dataset.index)))});o("[data-character-analytics]").addEventListener("click",cn);o("#close-character-analytics").addEventListener("click",()=>o("#character-analytics-dialog").close());o("#copy-character-lines").addEventListener("click",un);o("#save-character-analytics").addEventListener("click",dn);o("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&Ln(Number(t.dataset.line))});o("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&$n(t.dataset.characterNote)});o("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&Rt(Number(t.dataset.generalNoteLine))});o("#add-general-note").addEventListener("click",()=>Rt());o("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=ee();r.noteEditor.line===null?n.splice(r.noteEditor.insertAfter+1,0,`[[${t}]]`):n[r.noteEditor.line]=`[[${t}]]`,ce(n),o("#annotation-dialog").close()});o("#delete-annotation").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#annotation-dialog").close()});o("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#character-note-text").value.trim();if(!t){Ce(r.noteEditor.line),o("#character-note-dialog").close();return}let n=Nn(r.noteEditor.name,t);if(r.noteEditor.line===null)Mt(n);else{let a=ee();a[r.noteEditor.line]=n,ce(a)}o("#character-note-dialog").close()});o("#delete-character-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#character-note-dialog").close()});o("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#general-note-text").value.trim();if(!t)return;let n=Tn(t);if(r.noteEditor.line===null)Mt(n);else{let a=ee();a[r.noteEditor.line]=n,ce(a)}o("#general-note-dialog").close()});o("#delete-general-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#general-note-dialog").close()});o("#new-file").addEventListener("click",vt);o("#open-file").addEventListener("click",xt);o("#save-file").addEventListener("click",()=>De(!1));o("#save-file-as").addEventListener("click",()=>De(!0));o("#github-connect").addEventListener("click",St);o("#github-open").addEventListener("click",be);o("#github-save").addEventListener("click",be);o("#close-github-dialog").addEventListener("click",()=>o("#github-dialog").close());o("#github-install").addEventListener("click",()=>{r.githubInstallUrl&&Et(r.githubInstallUrl)});o("#github-disconnect").addEventListener("click",async()=>{try{await Y("/auth/logout",{method:"POST"})}catch{}r.githubConnected=!1,r.githubFile=null,Ct(),o("#github-dialog").close(),C("Disconnected from GitHub")});o("#github-repository").addEventListener("change",()=>Lt().catch(e=>C(e.message)));o("#github-branch").addEventListener("change",()=>ye("").catch(e=>C(e.message)));o("#github-breadcrumbs").addEventListener("click",e=>{let t=e.target.closest("[data-github-path]");t&&ye(t.dataset.githubPath)});o("#github-files").addEventListener("click",e=>{let t=e.target.closest("[data-github-entry]");t&&(t.dataset.githubType==="dir"?ye(t.dataset.githubEntry):bn(t.dataset.githubEntry))});o("#github-save-here").addEventListener("click",vn);window.addEventListener("message",async e=>{if(!(e.origin!==Me||!["github-connected","github-installed","github-error"].includes(e.data?.type))){if(e.data.type==="github-error")return C(e.data.message||"GitHub connection failed");await Ue({notify:!0})&&await be()}});o("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,Q(await t.text(),t.name,!0)),e.target.value=""});o("#export-pdf").addEventListener("click",()=>_t("pdf"));o("#export-fdx").addEventListener("click",()=>_t("fdx"));o("#export-format").addEventListener("change",e=>{o("#dialog-page-size").hidden=e.target.value!=="pdf"});o("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),En(o("#export-format").value))});o("#theme").addEventListener("click",Sn);o("#spellcheck").addEventListener("change",()=>{let e=o("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),o("#spellcheck-help").hidden=!e,se(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});o("#word-wrap").addEventListener("change",()=>{let e=o("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),re()});o("#preview-background").addEventListener("change",e=>{localStorage.setItem("fountain-publisher.preview-background",e.target.value),Ie()});o("#preview-dot-radius").addEventListener("input",e=>{localStorage.setItem("fountain-publisher.preview-dot-radius",e.target.value),Ie()});o("#page-size").addEventListener("change",()=>{He(0),r.previewMode==="pdf"&&xe()});j("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ve(e.dataset.previewMode)));o("#toggle-source").addEventListener("click",()=>X("source"));o("#menu-toggle-source").addEventListener("click",()=>X("source"));o("#toggle-stats").addEventListener("click",()=>X("stats"));o("#menu-toggle-stats").addEventListener("click",()=>X("stats"));o("#undo").addEventListener("click",ft);o("#redo").addEventListener("click",Ae);o("#zoom").addEventListener("change",()=>{r.previewZoom=o("#zoom").value,O()});o("#zoom-out").addEventListener("click",()=>kt(-1));o("#zoom-in").addEventListener("click",()=>kt(1));o("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",O()});o("#open-docs").addEventListener("click",()=>o("#docs-dialog").showModal());o("#close-docs").addEventListener("click",()=>o("#docs-dialog").close());function Mn(e){let t=c.value;c.value=e+(t?`
`+t:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function M(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,$(),c.focus()}function In(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),a=!1,i=null;for(let s of n){let l=s.trim();if(!l){if(a)break;continue}let p=s.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&$e.has(p[1].trim().toLowerCase()))i=p[1].trim().toLowerCase(),t[i]=p[2].trim(),a=!0;else if(a&&i&&/^\s+/.test(s))t[i]=(t[i]?t[i]+" ":"")+l;else break}return t}function Rn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,a=0;for(let i of t){if(!i.trim()){if(n){a+=1;break}a+=1;continue}let l=i.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&$e.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(i))n=!0,a+=1;else break}return a}o("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(a,i)=>{let s=o(`#${a}`).value.trim();s&&t.push(`${i}: ${s}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let a=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let i=c.value,s=Rn(i),l=i.replace(/\r\n?/g,`
`).split(`
`).slice(s).join(`
`);c.value=a+(l?`
`+l:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else Mn(a)}o("#title-page-dialog").close()});function Ot(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(o("#tp-heading").textContent=t,o("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=In(c.value),a=i=>n[i]??"";o("#tp-title").value=a("title"),o("#tp-credit").value=a("credit"),o("#tp-author").value=a("author")||a("authors"),o("#tp-date").value=a("draft date")||a("date"),o("#tp-contact").value=a("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});o("#tp-title").value="",o("#tp-credit").value="Written by",o("#tp-author").value="",o("#tp-date").value=n,o("#tp-contact").value=""}o("#title-page-dialog").showModal(),setTimeout(()=>o("#tp-title").focus(),0)}o("#insert-title-page").addEventListener("click",Ot);o("#insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-title-page").addEventListener("click",Ot);o("#menu-insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#menu-insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#menu-insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#menu-insert-transition").addEventListener("click",()=>{M(`CUT TO:

`)});o("#menu-insert-section").addEventListener("click",()=>{M(`# Act 1

`)});o("#menu-insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-centered").addEventListener("click",()=>{M(`> Centered text <

`)});function On(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${N.sceneNumbers}`),se(),He(0),r.previewMode==="pdf"&&xe()}o("#menu-scene-numbers").addEventListener("click",()=>{o("#scene-num-placement").value=N.sceneNumbers,o("#scene-num-format").value=N.sceneNumberFormat,o("#scene-num-dialog").showModal()});o("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),qe("sceneNumbers",o("#scene-num-placement").value),qe("sceneNumberFormat",o("#scene-num-format").value),On(),o("#scene-num-dialog").close())});function Pt(e){document.body.dataset.mobileTab=e,j(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&le()&&r.previewMode!=="live"?ve("live"):e==="preview"&&r.previewMode==="pdf"&&xe(),e==="source"&&(re(),Pe(V().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>$t(r.insightLine,!1))}j(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Pt(e.dataset.mobilePanel)));o("#preview-scroll").addEventListener("scroll",()=>{te(),A()});Ee.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&je(e)}));document.addEventListener("pointerdown",e=>Ee.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=o("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&te()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!o("#preview-context-menu").hidden?te():e.key==="Escape"&&Ee.some(t=>t.open)?je():(c===document.activeElement||m.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Ae():ft()):(c===document.activeElement||m.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Ae()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),De(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),xt()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),vt())});window.addEventListener("beforeunload",nt);var ke=0;function Ft(){ke=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function ue(){ke||(ke=requestAnimationFrame(Ft))}window.visualViewport?.addEventListener("resize",ue);window.visualViewport?.addEventListener("scroll",ue);window.addEventListener("scroll",ue);document.addEventListener("focusin",ue);window.addEventListener("resize",()=>{ue(),te(),re(),le()&&r.previewMode==="pdf"&&ve("live"),O()});async function Pn(){Ft(),At(r.theme),Ie();let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";o("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),document.body.classList.add(`scene-nums-${N.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),a=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),a&&document.documentElement.style.setProperty("--stats-w",`${a}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),Ve(o("#source-resizer"),"--source-w",1,250,650),Ve(o("#stats-resizer"),"--stats-w",-1,240,520);let i=new URLSearchParams(location.search),s=i.get("demo")==="1"?null:Wt(),l=i.get("demo")==="1"?Bt:"",p=i.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(i.has("project"))try{let g=await(await fetch("/api/project")).json();l=g.source,p=g.filename}catch{}let d=s&&(!i.has("project")||s.filename===p);d&&(l=s.source,p=s.filename||p,r.savedSource=typeof s.savedSource=="string"?s.savedSource:l);let f=i.get("demo")!=="1";Q(l,p,!d,d&&s.githubFile||null),Ue(),Pt(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),d&&["fit","70","85","100","115","130","150","175","200"].includes(String(s.zoom))&&(r.previewZoom=String(s.zoom),s.zoom!=="fit"&&(o("#zoom").value=String(s.zoom))),O();let h=["live","pdf"].includes(s?.previewMode)?s.previewMode:"live";await ve(d?h:localStorage.getItem("fountain-publisher.preview")||"live"),d?requestAnimationFrame(()=>{let u=Math.min(Number(s.selectionStart)||0,c.value.length),g=Math.min(Number(s.selectionEnd)||u,c.value.length);c.setSelectionRange(u,g),c.scrollTop=Math.max(0,Number(s.sourceScrollTop)||0),o("#preview-scroll").scrollTop=Math.max(0,Number(s.previewScrollTop)||0),o("#line-numbers").scrollTop=c.scrollTop,ge(),I(),r.cacheEnabled=f,A(),C("Workspace restored")}):(r.cacheEnabled=f,A())}Pn();
