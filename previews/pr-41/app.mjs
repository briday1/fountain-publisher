var Tt=`Title: The Last Light
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
`;var s=(e,t=document)=>t.querySelector(e),j=(e,t=document)=>[...t.querySelectorAll(e)],_e=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),_t=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=s("#source"),h=s("#screenplay-page"),je="fountain-publisher.workspace.v1",q=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",T={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function De(e,t){T[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:Nt(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null,previewContextEdit:null,previewContextText:""};function Nt(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function At(){try{let e=JSON.parse(localStorage.getItem(je)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function Ye(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(je,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:s("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,updatedAt:Date.now()}))}catch{}}}function I(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(Ye,120))}function C(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function Ne(e){return C(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Ce(e){try{return decodeURIComponent(e)}catch{return e}}function Ke(e){let t=e.trim().match(_t);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Ce(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Ce(t[2].slice(0,n)),text:Ce(t[2].slice(n+1))}}function Ze(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function kt(e){let t=[],n={},i=!1;return e.forEach((o,a)=>{if(o.includes("/*")&&(i=!0),i){o.includes("*/")&&(i=!1);return}let l=Ke(o);l?.kind==="general"?t.push({line:a,text:l.text}):l?.kind==="character"&&(n[l.name]={line:a,text:l.text})}),{generalNotes:t,characterNotes:n}}function Ae(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function $t(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function Mt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||Ae(n))return!1;let o=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),a=t===0||!e[t-1].trim();return o&&a}function me(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],i=!0,o=!1,a=!1,l=!1,p=!1;for(let u=0;u<t.length;u+=1){let f=t[u],m=f.trim(),d="action",g=f,v="";if(m.includes("/*")&&(p=!0),p)d="boneyard";else if(!m)d="empty",l=!1,o&&(i=!1),a=!1;else if(i&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&_e.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let b=f.indexOf(":");v=f.slice(0,b+1),g=f.slice(b+1).trim(),d=v.toLowerCase()==="title:"?"title-value title":"title-value",o=!0,a=!0,l=!1}else i&&a&&/^\s+/.test(f)?(g=m,d="title-value",l=!1):(i=!1,/^#{1,6}\s/.test(m)?d="section":/^=/.test(m)&&!/^={3,}$/.test(m)?d="synopsis":/^\[\[.*\]\]$/.test(m)?d="note":/^~/.test(m)?(d="lyric",g=f.replace(/^\s*~/,"")):/^={3,}$/.test(m)?d="page-break":Ae(m)?(d="scene",l=!1):Mt(t,u)?(d="character",g=m.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(m)?d="parenthetical":l?d="dialogue":/^>.*<$/.test(m)?(d="centered",g=m.slice(1,-1).trim()):/^>/.test(m)||/^[A-Z0-9 .'-]+TO:$/.test(m)?d="transition":m.startsWith("!")&&(d="action",g=f.replace(/^\s*!/,"")));n.push({raw:f,display:g,prefix:v,type:d,index:u}),m.includes("*/")&&(p=!1)}return n}function It(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=me(e),i=kt(t),o=new Map,a=[],l=[],p=new Set,u=[],f="",m=0,d="",g=0,v=0,b=0;n.forEach((w,y)=>{let _=(w.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(w.prefix&&u.push(w.prefix.slice(0,-1)),w.type==="section"){let x=w.raw.trim().match(/^(#{1,6})\s+(.+)$/);x&&(l.push({level:x[1].length,title:x[2],line:y+1}),x[1].length===1&&(d=x[2],g+=1))}else if(w.type==="scene"){let x=w.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),D=w.display.match(/#([^#]+)#/)?.[1]||String(a.length+1);a.push({number:D,heading:x,line:y+1,words:0,act:d||"Screenplay",actNumber:g}),m=a.length;let ee=x.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ee&&p.add(ee),f=""}else if(w.type==="character"){f=$t(w.display);let x=o.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};x.cues+=1,x.lastLine=y+1,m&&x.sceneSet.add(m),o.set(f,x)}else if(w.type==="dialogue"){let x=o.get(f);x&&(x.lines+=1,x.words+=_,v+=_,m&&x.sceneLineMap.set(m,(x.sceneLineMap.get(m)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(w.type)||(f="",b+=_,a.length&&(a.at(-1).words+=_))});let P=[...o.values()].map(w=>({...w,seconds:Math.round(w.words/130*60),scenes:w.sceneSet.size,sceneLines:[...w.sceneLineMap].map(([y,_])=>({scene:y,lines:_})),sceneSet:void 0,sceneLineMap:void 0})).sort((w,y)=>y.words-w.words||w.name.localeCompare(y.name)),F=v+b,B=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:F,dialogueWords:v,actionWords:b,estimatedSeconds:B==null?0:B*60,characters:P,scenes:a,sections:l,locations:[...p].sort(),titleFields:u,pageCount:B,...i}}function Ee(e,t=null){let n=e.raw.trim().match(/^>\s*(.*?)\s*<$/),i=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,o=n?"centered":e.type,a=`script-line ${o}${i?" act":""}`,l=i?.[1]||e.display,p=i?"#":e.prefix;if(n?l=n[1]:o==="transition"&&e.raw.trim().startsWith(">")&&(l=e.raw.trim().slice(1).trimStart()),t!==null){let d=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");l=T.sceneNumbers==="inline"?`${t}. ${d}`:d}let u=o==="note"?Ke(e.raw):null,f=l?Ne(l):"<br>",m=t!==null?C(t):"";if(o==="note"&&!u){let d=Ze(e.raw);return`<div class="script-line note annotation-line" data-line="${e.index}"><button class="annotation-orb" type="button" data-annotation-line="${e.index}" title="${C(d)}" aria-label="Edit annotation: ${C(d)}"></button></div>`}return o==="note"&&u?`<div class="script-line note managed-note" data-line="${e.index}"></div>`:`<div class="${a}" data-line="${e.index}" data-prefix="${C(p)}" data-scene-number="${m}" data-display="${C(l)}">${f}</div>`}function Rt(e){let t=new Map;if(T.sceneNumbers==="off")return t;let n=0,i=0,o=0,a=T.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(i++,o=0):l.type==="scene"&&(n++,o++,t.set(l.index,a==="act"?`A${Math.max(i,1)}S${o}`:String(n)));return t}function Ot(e){let t=Rt(e),n=[];for(let i=0;i<e.length;i+=1){if(e[i].type==="character"){let a=i+1;for(;a<e.length&&["dialogue","parenthetical","note"].includes(e[a].type);)a+=1;for(;a<e.length&&e[a].type==="empty";)a+=1;if(e[a]?.type==="character"&&e[a].raw.trim().endsWith("^")){let l=a+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(i,a).filter(f=>f.type!=="empty").map(f=>Ee(f)).join(""),u=e.slice(a,l).map(f=>Ee(f)).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${p}</div><div class="dual-right">${u}</div></div>`),i=l-1;continue}}let o=t.get(e[i].index)??null;n.push(Ee(e[i],o))}return n.join("")}function oe({focusLine:e=null,focusOffset:t=null}={}){let n=me(c.value),i=s("#preview-scroll"),o=s("#preview-page-stage"),a=i.scrollTop,l=i.scrollLeft;h.innerHTML=Ot(n),h.spellcheck=s("#spellcheck").checked;let p=n.some(u=>u.raw.trim());if(s("#empty-state").hidden=p,o.hidden=r.previewMode!=="live",h.hidden=r.previewMode!=="live",e!==null){let u=s(`[data-line="${e}"]`,h);if(h.focus({preventScroll:!0}),u){let f=t??u.textContent.length;G(u,f),H(u,f)}}i.scrollTop=a,i.scrollLeft=l,requestAnimationFrame(()=>{i.scrollTop=a,i.scrollLeft=l}),Qe(),O()}function G(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),i=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),o=i.nextNode();for(;o&&n>o.textContent.length;)n-=o.textContent.length,o=i.nextNode();let a=document.createRange();o?a.setStart(o,n):(a.selectNodeContents(e),a.collapse(!1)),a.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(a)}function Pt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),i=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let u of e.matchAll(i)){let f=u[1].length;for(let m=u.index;m<u.index+f;m+=1)t[m]=!0;for(let m=u.index+u[0].length-f;m<u.index+u[0].length;m+=1)t[m]=!0,n[m]=!0}let o=t.flatMap((u,f)=>u?[]:[f]),a=Array.from({length:o.length+1},(u,f)=>f<o.length?o[f]:(o.at(-1)??-1)+1),l=Array.from({length:o.length+1},(u,f)=>f?o[f-1]+1:o[0]??0),p=Array.from({length:o.length+1},(u,f)=>{let m=f?o[f-1]+1:0,d=f<o.length?o[f]:e.length;for(;m<d&&n[m];)m+=1;return m});return{startMap:a,endMap:l,caretMap:p}}function Ft(e,t){let n=0,i=t.length,o=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",o)+1,t[n]===" "&&(n+=1);let a=t.lastIndexOf("<");i=a<n?i:a,t[i-1]===" "&&(i-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",o)+1;else if(e.classList.contains("character")&&t.slice(o).startsWith("@"))n=o+1;else if(e.classList.contains("transition")&&t.slice(o).startsWith(">"))for(n=o+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let a=t.indexOf(e.dataset.prefix,o);for(n=a<0?0:a+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let a=t.slice(n,i).match(/\s+#[^#]+#\s*$/);a&&(i=n+a.index)}return{start:n,end:i,map:Pt(t.slice(n,i))}}function W(e,t,n,i="caret"){let o=Ft(e,t),a=e.dataset.sceneNumber&&T.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-a,o.map.startMap.length-1)),p=i==="start"?o.map.startMap:i==="end"?o.map.endMap:o.map.caretMap;return o.start+(p[l]??o.end-o.start)}function Dt(e,t){let n=[],i=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let o of e.matchAll(i)){let a=o.index+o[1].length,l=o.index+o[0].length-o[1].length;t>=a&&t<=l&&n.push(o[1])}return n}function Be(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let i=document.createRange();return i.selectNodeContents(e),i.setEnd(t,n),i.toString().length}function R(e=A(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),i=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,o=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,a=i?.closest?.(".script-line")||e,l=o?.closest?.(".script-line")||e;return{startLine:a,endLine:l,startOffset:Be(a,n.startContainer,n.startOffset),endOffset:Be(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function He(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let i=R(e);if(!i||i.startLine!==i.endLine||i.startOffset!==i.endOffset)return!1;if(!e.textContent.length)return!0;let o=document.createRange();o.selectNodeContents(e);let a=[...o.getClientRects()],l=t==="first"?a[0]?.top:a.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let u=[...p.getClientRects()];return u.length?l!==void 0&&u.length>0&&u.every(f=>Math.abs(f.top-l)<1):t==="first"?i.startOffset===0:i.startOffset===e.textContent.length}function ne(e,t,n){return e.slice(0,t).reduce((i,o)=>i+o.length+1,0)+n}function H(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=Number(e.dataset.line),o=W(e,n[i]||"",t),a=ne(n,i,o);c.setSelectionRange(a,a),ke(i),M()}function qe(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),i=Number(e.endLine.dataset.line),o=W(e.startLine,t[n]||"",e.startOffset,"start"),a=W(e.endLine,t[i]||"",e.endOffset,"end"),l=ne(t,n,o),p=ne(t,i,a);c.setSelectionRange(l,p,e.direction),ke(e.direction==="backward"?n:i),M()}function Xe(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=e.dataset.display??e.textContent,o=e.textContent.replace(/\n/g,""),a=0;for(;a<i.length&&a<o.length&&i[a]===o[a];)a+=1;let l=i.length,p=o.length;for(;l>a&&p>a&&i[l-1]===o[p-1];)l-=1,p-=1;let u=a===l,f=W(e,n[t],a,u?"caret":"start"),m=W(e,n[t],l,u?"caret":"end"),d=n[t].slice(0,f)+o.slice(a,p)+n[t].slice(m);n[t]=d,e.dataset.display=o,e.innerHTML=Ne(o)||"<br>",G(e,p),c.value=n.join(`
`);let g=ne(n,t,f+p-a);c.setSelectionRange(g,g),k({fromPreview:!0})}function U(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=Number(e.startLine.dataset.line),o=Number(e.endLine.dataset.line),a=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),u=`${a}${p}${l}`.split(`
`),f=i===o&&e.startOffset===e.endOffset,m=W(e.startLine,n[i],e.startOffset,f?"caret":"start"),d=W(e.endLine,n[o],e.endOffset,f?"caret":"end"),g=n[o].slice(d),v=i===o?[]:n.slice(i+1,o).filter(y=>/^\s*\[\[.*\]\]\s*$/.test(y));if(i===o&&p.includes(`
`)){let y=Dt(n[i],m);y.length&&(p=p.replaceAll(`
`,`${[...y].reverse().join("")}
${y.join("")}`))}let b=`${n[i].slice(0,m)}${p}${n[o].slice(d)}`.split(`
`);if(i===o&&e.startLine.classList.contains("centered")&&b.length>1){b[0]=`${b[0].trimEnd()} <`,b[b.length-1]=`> ${b.at(-1).trimStart()}`;for(let y=1;y<b.length-1;y+=1)b[y]=`> ${b[y]} <`}n.splice(i,o-i+1,...b,...v),c.value=n.join(`
`);let P=i+u.length-1,F=u.length===1?a.length+t.length:t.split(/\r\n?|\n/).at(-1).length,B=b.at(-1).length-g.length,w=ne(n,P,Math.max(0,B));c.setSelectionRange(w,w),k({fromPreview:!0}),i===o&&u.length===1?(e.startLine.innerHTML=Ne(u[0])||"<br>",e.startLine.dataset.display=u[0],h.focus({preventScroll:!0}),G(e.startLine,F),H(e.startLine,F),Ge(e.startLine)):oe({focusLine:P,focusOffset:F})}function Bt(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return U(e,"");let i=e.startLine,o=Number(i.dataset.line),a=i.textContent;if(t==="backward"&&e.startOffset>0){let l=a.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<a.length){let l=a.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=j(".script-line[data-display]",h),p=l.indexOf(i),u=l[p+(t==="backward"?-1:1)];if(!u)return;t==="backward"?(e.startLine=u,e.startOffset=u.textContent.length):(e.endLine=u,e.endOffset=0)}U(e,"")}function Y(){s("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function Ge(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),i=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(i)||n&&!/^[A-Z0-9 ._'-]*$/.test(i))return Y();r.previewCompletionItems=r.metadata.characters.map(o=>o.name).filter((o,a,l)=>o.startsWith(i)&&o!==i&&l.indexOf(o)===a),r.previewCompletionIndex=0,r.previewCompletionLine=e,Je()}function Je(){let e=s("#preview-completion-menu");if(!r.previewCompletionItems.length)return Y();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${C(t)}</span><small>Character</small></button>`).join(""),Ht()}function Ht(){let e=s("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=s(".preview-panel").getBoundingClientRect(),i=getSelection(),o=t.getBoundingClientRect();if(i?.rangeCount&&t.contains(i.focusNode)){let m=document.createRange();if(m.setStart(i.focusNode,i.focusOffset),m.collapse(!0),o=m.getClientRects()[0]||m.getBoundingClientRect(),!o.width&&!o.height){let d=document.createRange();d.selectNodeContents(t),d.setEnd(i.focusNode,i.focusOffset);let g=d.getBoundingClientRect(),v=t.getBoundingClientRect();o={left:g.right,right:g.right,top:v.top,bottom:v.bottom,width:0,height:v.height}}}let a=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-a-8,o.left)),p=Math.min(e.scrollHeight,245),u=o.bottom+6,f=u+p<=n.bottom-8?u:Math.max(n.top+8,o.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function Ve(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,Xe(n),Y(),h.focus({preventScroll:!0}),G(n,n.textContent.length))}function ie(){zt(),he(),Ut(),M()}function Ut(){let e=s("#line-numbers"),t=s("#source-highlight"),n=t.getBoundingClientRect(),i=c.value.split(`
`).map((a,l)=>{let u=s(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=u?u.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),o=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${i}<span class="line-number-spacer" style="height:${o}px"></span>`,e.scrollTop=c.scrollTop}function Wt(e){return C(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function zt(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=me(c.value);s("#source-highlight").innerHTML=t.map((n,i)=>{let o=e[n.type],a=Wt(n.raw)||" ",l=i<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${o?` class="syntax-${o}"`:""}>${a}${l}</span>`}).join("")}function ue(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function he(){let e=s("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=ue(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=ue(e,t)}function J(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function jt(e,t="nearest"){let n=s("#preview-scroll"),i=e.getBoundingClientRect(),o=n.getBoundingClientRect(),a=n.scrollTop,l=n.scrollLeft;t==="center"?a+=i.top-o.top-(n.clientHeight-i.height)/2:i.top<o.top?a+=i.top-o.top:i.bottom>o.bottom&&(a+=i.bottom-o.bottom),i.left<o.left?l+=i.left-o.left:i.right>o.right&&(l+=i.right-o.right),n.scrollTop=Math.max(0,a),n.scrollLeft=ue(n,l)}function ke(e,t="nearest"){if(!c.clientHeight)return;let n=s("#source-highlight"),o=s(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!o)return;let a=getComputedStyle(c),l=parseFloat(a.paddingTop)||0,p=parseFloat(a.paddingBottom)||0,u=parseFloat(a.lineHeight)||20.15,f=o.top-n.getBoundingClientRect().top+n.scrollTop,m=f+u,d=c.scrollTop;t==="center"?d=f-(c.clientHeight-u)/2:f<c.scrollTop+l?d=f-l:m>c.scrollTop+c.clientHeight-p&&(d=m-c.clientHeight+p),c.scrollTop=Math.max(0,d),he(),s("#line-numbers").scrollTop=c.scrollTop}function Qe(e=!1,t="nearest"){let n=s(`[data-line="${J().line}"]`,h);j(".script-line.source-current",h).forEach(i=>i.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&jt(n,t)}function M({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=J();s("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let i=me(c.value)[n.line]?.type||"action",o={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};s("#editor-status").textContent=o[i]||i[0].toUpperCase()+i.slice(1);let a=getComputedStyle(c),l=parseFloat(a.lineHeight)||20.15,p=s(`[data-source-line="${n.line}"]`,s("#source-highlight")),u=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(a.paddingTop):-c.scrollTop;s("#current-line").style.height=`${l}px`,s("#current-line").style.transform=`translateY(${u}px)`,Qe(e,t)}function et(e){r.metadata=e,s("#stat-pages").textContent=e.pageCount??"\u2014",s("#stat-scenes").textContent=e.scenes.length,s("#stat-words").textContent=e.wordCount.toLocaleString(),s("#scene-count").textContent=e.scenes.length,s("#character-count").textContent=e.characters.length,s("#scene-list").innerHTML=Zt(e),Yt(),Kt();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;s("#dialogue-bar").style.width=`${n}%`,s("#dialogue-percent").textContent=`${n}%`,s("#action-percent").textContent=`${100-n}%`,s("#character-analytics-dialog").open&&$e()}function Yt(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};s("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let i=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${C(n.name)}">${C(n.name)}${i?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function Kt(){let e=r.metadata.generalNotes||[];s("#general-note-count").textContent=e.length,s("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${C(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function Se(e,t=e.number){return`<li><span class="scene-num">${C(t)}</span><button type="button" data-line="${e.line}">${C(e.heading)}</button></li>`}function Zt(e){let t=e.scenes||[],n=(e.sections||[]).filter(a=>a.level===1);if(!n.length)return t.length?t.map(a=>Se(a)).join(""):'<li class="empty-list">No scene headings yet.</li>';let i=t.filter(a=>!a.actNumber).map(a=>Se(a)).join(""),o=n.map((a,l)=>{let p=l+1,u=t.filter(f=>f.actNumber===p).map((f,m)=>Se(f,String(m+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${a.line}"><span>${l+1}</span>${C(a.title)}</button><ol>${u||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return i+o}function Z(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function ce(e,t,n){let i=String(t);if(e.measureText(i).width<=n)return i;let o=i;for(;o.length&&e.measureText(`${o}\u2026`).width>n;)o=o.slice(0,-1);return o?`${o}\u2026`:""}function $e(){let e=s("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,i=Math.min(window.devicePixelRatio||1,2),o=150,a=92,l=28,p=54,u=34,f=Math.max(720,o+n.length*a+18),m=l+p+Math.max(t.length,1)*u+18;e.width=Math.ceil(f*i),e.height=Math.ceil(m*i),e.style.width=`${f}px`,e.style.height=`${m}px`;let d=e.getContext("2d");d.scale(i,i);let g=Z("--surface","#fff"),v=Z("--surface-2","#f2f2f2"),b=Z("--ink","#202124"),P=Z("--muted","#6b7280"),F=Z("--border","#d7d9dd"),B=Z("--syntax-character","#7c3aed"),w=t.flatMap(E=>(E.sceneLines||[]).map(S=>S.lines)).filter(E=>E>0),y=w.length?Math.min(...w):0,_=w.length?Math.max(...w):0,x=s("#character-analytics-legend");x.hidden=!w.length,s("#character-analytics-min").textContent=`${y} ${y===1?"line":"lines"}`,s("#character-analytics-max").textContent=`${_} ${_===1?"line":"lines"}`,d.fillStyle=g,d.fillRect(0,0,f,m),d.strokeStyle=F,d.lineWidth=1,d.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",d.textBaseline="middle";let D=0;for(;D<n.length;){let E=n[D].act||"Screenplay",S=D+1;for(;S<n.length&&(n[S].act||"Screenplay")===E;)S+=1;let L=o+D*a,K=(S-D)*a;d.fillStyle=v,d.fillRect(L,0,K,l),d.fillStyle=b,d.textAlign="center",d.fillText(ce(d,E,K-12),L+K/2,l/2),d.strokeRect(L+.5,.5,K,l),D=S}d.fillStyle=v,d.fillRect(0,0,o,l+p),d.fillStyle=P,d.textAlign="left",d.fillText("CHARACTER",12,l+p/2);let ee=new Map,Lt=n.map((E,S)=>{if(!E.actNumber)return String(S+1);let L=(ee.get(E.actNumber)||0)+1;return ee.set(E.actNumber,L),String(L)});n.forEach((E,S)=>{let L=o+S*a;d.strokeStyle=F,d.strokeRect(L+.5,l+.5,a,p),d.fillStyle=b,d.textAlign="center",d.fillText(ce(d,Lt[S],a-10),L+a/2,l+16),d.fillStyle=P,d.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",d.fillText(ce(d,E.heading,a-10),L+a/2,l+36),d.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((E,S)=>{let L=l+p+S*u;S%2===1&&(d.fillStyle=v,d.fillRect(0,L,o+n.length*a,u)),d.fillStyle=b,d.textAlign="left",d.fillText(ce(d,E.name,o-20),12,L+u/2);let K=new Map((E.sceneLines||[]).map(be=>[be.scene,be.lines]));n.forEach((be,Oe)=>{let xe=K.get(Oe+1)||0;if(!xe)return;let Pe=o+Oe*a+4,Fe=_===y?1:.25+.75*((xe-y)/(_-y));d.save(),d.globalAlpha=Fe,d.fillStyle=B,d.fillRect(Pe,L+7,a-8,u-14),d.restore(),d.fillStyle=Fe>=.6?"#fff":b,d.textAlign="center",d.fillText(String(xe),Pe+(a-8)/2,L+u/2)})}),n.length||(d.fillStyle=P,d.textAlign="center",d.fillText("Add scene headings to build the timeline.",f/2,l+p+u/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${y} to ${_} dialogue lines`)}function qt(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function Xt(){$e(),s("#character-analytics-dialog").showModal()}async function Gt(){try{await navigator.clipboard.writeText(qt()),N("Line usage CSV copied")}catch{N("Clipboard access was denied")}}async function Jt(){$e();let e=await new Promise(t=>s("#character-analytics-chart").toBlob(t,"image/png"));if(!e){N("Could not create analytics image");return}await Re(e,pe("character-analytics.png")),N("Character analytics PNG saved")}function Vt(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function tt(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=h.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],k({fromPreview:t!==null,record:!1}),t!==null?oe({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function nt(){tt(r.historyIndex-1)}function Le(){tt(r.historyIndex+1)}function k({fromPreview:e=!1,record:t=!0}={}){t&&Vt(),document.body.classList.toggle("dirty",c.value!==r.savedSource),ie(),e||oe(),et(It(c.value)),Me(),I()}function Me(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;s("#compile-status").textContent="Editing\u2026",s("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>q?it(t):Qt(t),q?Math.max(e,700):e)}function ot(e,t=q){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),i=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;s("#compile-status").textContent=i,s("#compile-status").title=i,s("#compile-status").classList.add("error")}async function it(e){s("#compile-status").textContent="Compiling\u2026";try{let t=await pt("pdf",s("#page-size").value),n=await st(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,s("#stat-pages").textContent=n,s("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;ot(t,!0)}}async function Qt(e){let t=new AbortController;r.compileController=t,s("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:s("#page-size").value,sceneNumbers:T.sceneNumbers,sceneNumberFormat:T.sceneNumberFormat}),signal:t.signal});if(ft(n,"application/json")){q=!0,await it(e);return}let i=await n.json();if(!n.ok)throw new Error(i.error||"Compilation failed");if(i.pageCount==null&&(i.pageCount=await st(await fe("/api/render/pdf"))),i.estimatedSeconds=i.pageCount*60,e!==r.compileRevision)return;et(i),s("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;ot(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function st(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function en(){let{line:e,start:t}=J(),n=c.value.split(`
`),o=n[e].slice(0,c.selectionStart-t).trim(),a=o.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],u=(d,g,v="\u0192")=>p.push({value:d,detail:g,icon:v}),f=(a?o.slice(1):o.split(/\s+/).at(-1)).toUpperCase();(a||f&&r.metadata.characters.some(d=>d.name.startsWith(f)))&&r.metadata.characters.forEach(d=>u(d.name,`${d.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!o||/^[A-Za-z ]*$/.test(o))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(d=>!r.metadata.titleFields.some(g=>`${g}:`.toLowerCase()===d.trim().toLowerCase())).forEach(d=>u(d,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(o)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(d=>u(d,"Time of day","\u25F7")):Ae(o)||/^(?:INT|EXT|EST|I\/E)/i.test(o)?r.metadata.locations.forEach(d=>u(d,"Existing location","\u2302")):l&&(a||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(d=>u(d,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(d=>u(d,"Transition","\u2192"))));let m=(a?o.slice(1):o).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((d,g)=>p.findIndex(v=>v.value===d.value)===g&&(d.icon!=="@"||d.value.toUpperCase()!==f)&&(!m||d.value.toUpperCase().startsWith(m)||d.detail==="Existing location"))}function at({allowBlank:e=!1}={}){let{line:t,start:n}=J(),i=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!i||(r.completionItems=en(),r.completionIndex=0,!r.completionItems.length))return z();rt()}function rt(){let e=s("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${C(t.icon)}</span><span>${C(t.value)}</span><small>${C(t.detail)}</small></button>`).join(""),tn(),s(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function z(){s("#completion-menu").hidden=!0,r.completionItems=[]}function tn(){let e=s("#completion-menu"),t=c.getBoundingClientRect(),n=s("#source-panel").getBoundingClientRect(),i=getComputedStyle(c),o=document.createElement("div"),a=document.body.classList.contains("source-wrap"),l=ue(c);Object.assign(o.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:i.boxSizing,left:`${t.left-(a?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${a?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:i.padding,border:i.border,font:i.font,letterSpacing:i.letterSpacing,lineHeight:i.lineHeight,whiteSpace:a?"pre-wrap":"pre",overflowWrap:a?"anywhere":"normal",tabSize:i.tabSize}),o.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",o.append(p),document.body.append(o);let u=p.getBoundingClientRect();o.remove();let f=Math.min(310,n.width-16),m=Math.max(n.left+8,Math.min(n.right-f-8,u.left)),d=Math.min(e.scrollHeight,245),g=u.bottom+5,v=g+d<=n.bottom-8?g:Math.max(n.top+8,u.top-d-5);e.style.left=`${m}px`,e.style.top=`${v}px`,e.style.right="auto",e.style.bottom="auto"}function lt(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=J(),o=c.value.slice(0,c.selectionStart).slice(n.start),a=n.start;if(t.icon==="@"){let p=o.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";a=c.selectionStart-p.length}else/\s-\s/.test(o)?a=n.start+o.lastIndexOf("-")+2:o.trim()&&(a=n.start+o.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,a,c.selectionStart,"end"),z(),k()}async function ct(){await dt()&&(r.handle=null,se("","Untitled.fountain",!0),c.focus())}async function dt(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function ut(){if(await dt()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();se(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&N(e.message);return}s("#file-input").click()}}function se(e,t,n=!1){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),s("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,k()}async function Ie(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:pe("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await Re(new Blob([c.value],{type:"text/plain;charset=utf-8"}),pe("fountain"));r.savedSource=c.value,se(c.value,r.filename,!0),N(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&N(t.message)}}function pe(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function Re(e,t){let n=URL.createObjectURL(e),i=document.createElement("a");i.href=n,i.download=t,document.body.appendChild(i),i.click(),document.body.removeChild(i),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function nn(e,t){let i={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(i)){await navigator.share(i);return}await Re(e,t)}var de;async function on(){return de||(de=(async()=>{s("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let i=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(i.map(async o=>{let a=await fetch(new URL(`fonts/${o}`,import.meta.url));if(!a.ok)throw new Error(`Unable to load PDF font ${o}`);n.FS.writeFile(`/fonts/${o}`,new Uint8Array(await a.arrayBuffer()))})),await n.runPythonAsync(`
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
        Action([bold(str(paragraph.text).upper())], centered=True)
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
`),s("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw de=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),de}async function pt(e,t){let n=await on();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",T.sceneNumbers),n.globals.set("_fp_scene_number_format",T.sceneNumberFormat);let i=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),o=i instanceof Uint8Array?i:i.toJs();i.destroy?.();let a={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([o],{type:a[e]})}function ft(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function Ue(e,t){return pt(e==="/api/render/pdf"?"pdf":"fdx",t)}async function fe(e,t=s("#page-size").value){if(q)return Ue(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:T.sceneNumbers,sceneNumberFormat:T.sceneNumberFormat})});if(ft(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return q=!0,Ue(e,t);if(!n.ok){let o=await n.json().catch(()=>({}));throw new Error(o.error||"Export failed")}return n.blob()}async function sn(e){s("#confirm-export").disabled=!0;try{let t=e==="pdf"?await fe("/api/render/pdf",s("#export-page-size").value):await fe("/api/export/fdx");await nn(t,pe(e)),s("#export-dialog").close(),N(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&N(t.message)}finally{s("#confirm-export").disabled=!1}}function mt(e){s("#export-format").value=e,s("#export-page-size").value=s("#page-size").value,s("#dialog-page-size").hidden=e!=="pdf",s("#export-dialog").showModal()}function ae(){return matchMedia("(max-width: 640px)").matches}async function ge(e){ae()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),j("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=s(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),s("#preview-page-stage").hidden=e!=="live",h.hidden=e!=="live",s("#empty-state").hidden=e!=="live"||!!c.value.trim(),s("#pdf-view").hidden=e!=="pdf",s("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),I(),e==="pdf"&&await we()}async function we(){s("#pdf-placeholder").hidden=!1,s("#pdf-frame").hidden=!0;try{let e=await fe("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),s("#pdf-frame").src=r.pdfUrl,s("#pdf-frame").hidden=!1,s("#pdf-placeholder").hidden=!0}catch(e){s("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${C(e.message)}</span>`}}function ht(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,s("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),s("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function an(){let e=document.documentElement.dataset.effectiveTheme||"light";ht(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),s(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),s(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(O)}function We(e,t,n,i,o){let a=0,l=0,p=u=>{let f=Math.max(i,Math.min(o,u));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&ie(),r.previewZoom==="fit"&&requestAnimationFrame(O)};e.addEventListener("pointerdown",u=>{a=u.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(u.pointerId)}),e.addEventListener("pointermove",u=>{e.hasPointerCapture(u.pointerId)&&p(l+(u.clientX-a)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",u=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(u.key))return;u.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));u.key==="Home"?p(i):u.key==="End"?p(o):p(f+(u.key==="ArrowRight"?1:-1)*n*(u.shiftKey?30:10))})}function O(){let e=r.previewZoom;if(s("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),ae()){let o=e==="fit"?1:Number(e)/100;h.style.transform="none",h.style.marginBottom="0",h.style.marginRight="0",s("#preview-page-stage").style.removeProperty("width"),s("#preview-page-stage").style.removeProperty("min-height"),h.style.setProperty("--mobile-preview-zoom",o),I();return}h.style.removeProperty("--mobile-preview-zoom");let t=Number(e)/100;if(e==="fit"){let o=s("#preview-scroll"),a=getComputedStyle(o),l=o.clientWidth-parseFloat(a.paddingLeft)-parseFloat(a.paddingRight);t=Math.max(.25,l/816)}let n=s("#preview-page-stage");n.style.width=`${816*t}px`,n.style.minHeight=`${1056*t}px`,h.style.transform=`scale(${t})`,h.style.marginBottom="0",h.style.marginRight="0";let i=s("#preview-scroll");requestAnimationFrame(()=>{i.scrollLeft=Math.max(0,(i.scrollWidth-i.clientWidth)/2)}),I()}function gt(e){let t=["70","85","100","115","130"],n=s("#zoom");if(r.previewZoom==="fit"){n.value="100",r.previewZoom="100",O();return}let i=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,i+e))],r.previewZoom=n.value,O()}function wt(e,t=!0){let n=c.value.split(`
`),i=0;for(let u=0;u<Math.max(0,e-1);u+=1)i+=n[u].length+1;t&&c.focus(),c.setSelectionRange(i,i+(n[e-1]?.length||0)),M({scrollPreview:!0,scrollBlock:"center"});let o=s("#source-highlight"),l=s(`[data-source-line="${Math.max(0,e-1)}"]`,o)?.getClientRects()[0],p=l?l.top-o.getBoundingClientRect().top+o.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),s("#line-numbers").scrollTop=c.scrollTop,s("#source-highlight").scrollTop=c.scrollTop,M({scrollPreview:!0,scrollBlock:"center"})}function rn(e){r.insightLine=e,wt(e,!1)}var ze;function N(e){let t=s("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(ze),ze=setTimeout(()=>t.classList.remove("show"),2200)}function V(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function re(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),k()}function yt(e){let t=V();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),re(t)}function ln(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function cn(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function vt(e=null,t=null){let n=e===null?"":Ze(V()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},s("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",s("#annotation-text").value=n,s("#delete-annotation").hidden=e===null,s("#annotation-dialog").showModal(),setTimeout(()=>s("#annotation-text").focus(),0)}function Q(){let e=s("#preview-context-menu");e.hidden=!0,r.previewContextLine=null,r.previewContextEdit=null,r.previewContextText=""}function A(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function te(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return h.contains(t.commonAncestorContainer)?e:null}function dn(e,t,n){let i=(l,p)=>{let u=document.createRange();return u.selectNodeContents(e),u.setEnd(l,p),u.toString().length},o=document.caretPositionFromPoint?.(t,n);if(o&&e.contains(o.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(o.offsetNode,o.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),h.focus({preventScroll:!0}),H(e,i(o.offsetNode,o.offset));return}let a=document.caretRangeFromPoint?.(t,n);if(a&&e.contains(a.startContainer)){let l=getSelection();a.collapse(!0),l?.removeAllRanges(),l?.addRange(a),h.focus({preventScroll:!0}),H(e,i(a.startContainer,a.startOffset));return}h.focus({preventScroll:!0}),G(e,e.textContent.length),H(e)}function un(e,t,n){let i=s("#preview-context-menu"),o=te();r.previewContextLine=Number(e.dataset.line),r.previewContextEdit=R(A(o?.focusNode)||e),r.previewContextText=o?.toString()||"",i.hidden=!1,i.style.left="0px",i.style.top="0px";let{width:a,height:l}=i.getBoundingClientRect();i.style.left=`${Math.max(8,Math.min(window.innerWidth-a-8,t))}px`;let p=n;if(ae()&&r.previewContextText&&o.rangeCount){let u=o.getRangeAt(0).getBoundingClientRect(),f=u.bottom+12,m=u.top-l-12;p=f+l<=window.innerHeight-8?f:m}i.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,p))}px`}async function pn(e,t,n={}){let i=Number.isInteger(t)?s(`[data-line="${t}"]`,h):null;if(e==="copy"){let o=te(),a=n.text||o?.toString()||"";if(!a)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(a),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let o=te(),a=n.text||o?.toString()||"";if(!a)return"Select text to cut";let l=n.edit||R(A(o?.focusNode)||i);if(!l)return"Select text to cut";try{return await navigator.clipboard.writeText(a),U(l,""),""}catch{try{return document.execCommand("copy")?(U(l,""),""):"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}if(e==="paste"){let o=n.edit||R(i||A(te()?.focusNode));if(!o)return"Click where you want to paste";try{return U(o,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function fn(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},s("#character-note-heading").textContent=`${e} notes`,s("#character-note-text").value=t?.text||"",s("#delete-character-note").hidden=!t,s("#character-note-dialog").showModal(),setTimeout(()=>s("#character-note-text").focus(),0)}function bt(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},s("#general-note-heading").textContent=t?"Edit general note":"Add general note",s("#general-note-text").value=t?.text||"",s("#delete-general-note").hidden=!t,s("#general-note-dialog").showModal(),setTimeout(()=>s("#general-note-text").focus(),0)}function ye(e){if(e==null)return;let t=V();t.splice(e,1),re(t)}var ve=j(".toolbar-menu");function xt(e=null){ve.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{k(),e.inputType==="insertText"?at():z()});c.addEventListener("scroll",()=>{s("#line-numbers").scrollTop=c.scrollTop,he(),M(),I()});c.addEventListener("click",()=>{M({scrollPreview:!0}),z(),I()});c.addEventListener("select",()=>{M({scrollPreview:!0}),I()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||M({scrollPreview:!0}),I()});c.addEventListener("keydown",e=>{if(!s("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,rt();return}if(e.key==="Tab"){e.preventDefault(),lt();return}if(e.key==="Escape"){e.preventDefault(),z();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),at({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),k()):e.key==="Enter"&&z()});h.addEventListener("beforeinput",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);if(!n)return;let i=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),o=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!i.has(e.inputType)&&!o.has(e.inputType)))if(e.preventDefault(),Y(),o.has(e.inputType)){let a=e.inputType.includes("Forward");Bt(n,a?"forward":"backward",e.inputType.includes("Word"))}else{let a=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";U(n,a)}});h.addEventListener("input",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(Xe(t),Ge(t))});h.addEventListener("paste",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);n&&(e.preventDefault(),U(n,e.clipboardData?.getData("text/plain")||""))});h.addEventListener("keydown",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!s("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,Je();return}if(e.key==="Tab"){e.preventDefault(),Ve();return}if(e.key==="Escape"){e.preventDefault(),Y();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,i=n===-1?He(t,"first"):n===1&&He(t,"last");if(n&&i){let o=R(t),a=s(`[data-line="${Number(t.dataset.line)+n}"]`,h);if(o&&o.startLine===o.endLine&&o.startOffset===o.endOffset&&a){e.preventDefault();let l=Math.min(o.startOffset,a.textContent.length);h.focus({preventScroll:!0}),G(a,l),H(a,l)}}});h.addEventListener("focusin",()=>{let e=A(getSelection()?.focusNode);e&&H(e)});h.addEventListener("pointerup",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&qe(n)});h.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&qe(n)});h.addEventListener("focusout",()=>setTimeout(()=>{s("#preview-completion-menu").matches(":hover")||Y()},0));h.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),Y();let n=te();(!n||n.isCollapsed)&&dn(t,e.clientX,e.clientY),un(t,e.clientX,e.clientY)});h.addEventListener("click",e=>{Q();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),vt(Number(t.dataset.annotationLine)))});s("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n,previewContextEdit:i,previewContextText:o}=r,a=t.dataset.previewMenuAction;if(Q(),a==="annotation")return vt(null,n);let l=await pn(a,n,{edit:i,text:o});l&&N(l)});s("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),Ve(Number(t.dataset.index)))});s("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),lt(Number(t.dataset.index)))});s("[data-character-analytics]").addEventListener("click",Xt);s("#close-character-analytics").addEventListener("click",()=>s("#character-analytics-dialog").close());s("#copy-character-lines").addEventListener("click",Gt);s("#save-character-analytics").addEventListener("click",Jt);s("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&rn(Number(t.dataset.line))});s("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&fn(t.dataset.characterNote)});s("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&bt(Number(t.dataset.generalNoteLine))});s("#add-general-note").addEventListener("click",()=>bt());s("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=s("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=V();r.noteEditor.line===null?n.splice(r.noteEditor.insertAfter+1,0,`[[${t}]]`):n[r.noteEditor.line]=`[[${t}]]`,re(n),s("#annotation-dialog").close()});s("#delete-annotation").addEventListener("click",()=>{ye(r.noteEditor?.line),s("#annotation-dialog").close()});s("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=s("#character-note-text").value.trim();if(!t){ye(r.noteEditor.line),s("#character-note-dialog").close();return}let n=cn(r.noteEditor.name,t);if(r.noteEditor.line===null)yt(n);else{let i=V();i[r.noteEditor.line]=n,re(i)}s("#character-note-dialog").close()});s("#delete-character-note").addEventListener("click",()=>{ye(r.noteEditor?.line),s("#character-note-dialog").close()});s("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=s("#general-note-text").value.trim();if(!t)return;let n=ln(t);if(r.noteEditor.line===null)yt(n);else{let i=V();i[r.noteEditor.line]=n,re(i)}s("#general-note-dialog").close()});s("#delete-general-note").addEventListener("click",()=>{ye(r.noteEditor?.line),s("#general-note-dialog").close()});s("#new-file").addEventListener("click",ct);s("#open-file").addEventListener("click",ut);s("#save-file").addEventListener("click",()=>Ie(!1));s("#save-file-as").addEventListener("click",()=>Ie(!0));s("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,se(await t.text(),t.name,!0)),e.target.value=""});s("#export-pdf").addEventListener("click",()=>mt("pdf"));s("#export-fdx").addEventListener("click",()=>mt("fdx"));s("#export-format").addEventListener("change",e=>{s("#dialog-page-size").hidden=e.target.value!=="pdf"});s("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),sn(s("#export-format").value))});s("#theme").addEventListener("click",an);s("#spellcheck").addEventListener("change",()=>{let e=s("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),s("#spellcheck-help").hidden=!e,oe(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});s("#word-wrap").addEventListener("change",()=>{let e=s("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),ie()});s("#page-size").addEventListener("change",()=>{Me(0),r.previewMode==="pdf"&&we()});j("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ge(e.dataset.previewMode)));s("#toggle-source").addEventListener("click",()=>X("source"));s("#menu-toggle-source").addEventListener("click",()=>X("source"));s("#toggle-stats").addEventListener("click",()=>X("stats"));s("#menu-toggle-stats").addEventListener("click",()=>X("stats"));s("#undo").addEventListener("click",nt);s("#redo").addEventListener("click",Le);s("#zoom").addEventListener("change",()=>{r.previewZoom=s("#zoom").value,O()});s("#zoom-out").addEventListener("click",()=>gt(-1));s("#zoom-in").addEventListener("click",()=>gt(1));s("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",O()});s("#open-docs").addEventListener("click",()=>s("#docs-dialog").showModal());s("#close-docs").addEventListener("click",()=>s("#docs-dialog").close());function mn(e){let t=c.value;c.value=e+(t?`
`+t:""),k(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function $(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,k(),c.focus()}function hn(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),i=!1,o=null;for(let a of n){let l=a.trim();if(!l){if(i)break;continue}let p=a.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&_e.has(p[1].trim().toLowerCase()))o=p[1].trim().toLowerCase(),t[o]=p[2].trim(),i=!0;else if(i&&o&&/^\s+/.test(a))t[o]=(t[o]?t[o]+" ":"")+l;else break}return t}function gn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,i=0;for(let o of t){if(!o.trim()){if(n){i+=1;break}i+=1;continue}let l=o.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&_e.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(o))n=!0,i+=1;else break}return i}s("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(i,o)=>{let a=s(`#${i}`).value.trim();a&&t.push(`${o}: ${a}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let i=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let o=c.value,a=gn(o),l=o.replace(/\r\n?/g,`
`).split(`
`).slice(a).join(`
`);c.value=i+(l?`
`+l:""),k(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else mn(i)}s("#title-page-dialog").close()});function Ct(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(s("#tp-heading").textContent=t,s("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=hn(c.value),i=o=>n[o]??"";s("#tp-title").value=i("title"),s("#tp-credit").value=i("credit"),s("#tp-author").value=i("author")||i("authors"),s("#tp-date").value=i("draft date")||i("date"),s("#tp-contact").value=i("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});s("#tp-title").value="",s("#tp-credit").value="Written by",s("#tp-author").value="",s("#tp-date").value=n,s("#tp-contact").value=""}s("#title-page-dialog").showModal(),setTimeout(()=>s("#tp-title").focus(),0)}s("#insert-title-page").addEventListener("click",Ct);s("#insert-scene").addEventListener("click",()=>{$(`INT. LOCATION - DAY

`)});s("#insert-dialogue").addEventListener("click",()=>{$(`CHARACTER
Dialogue here.

`)});s("#insert-direction").addEventListener("click",()=>{$(`Action description.

`)});s("#insert-pagebreak").addEventListener("click",()=>{$(`===

`)});s("#menu-insert-title-page").addEventListener("click",Ct);s("#menu-insert-scene").addEventListener("click",()=>{$(`INT. LOCATION - DAY

`)});s("#menu-insert-dialogue").addEventListener("click",()=>{$(`CHARACTER
Dialogue here.

`)});s("#menu-insert-direction").addEventListener("click",()=>{$(`Action description.

`)});s("#menu-insert-transition").addEventListener("click",()=>{$(`CUT TO:

`)});s("#menu-insert-section").addEventListener("click",()=>{$(`# Act 1

`)});s("#menu-insert-pagebreak").addEventListener("click",()=>{$(`===

`)});s("#menu-insert-centered").addEventListener("click",()=>{$(`> Centered text <

`)});function wn(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${T.sceneNumbers}`),oe(),Me(0),r.previewMode==="pdf"&&we()}s("#menu-scene-numbers").addEventListener("click",()=>{s("#scene-num-placement").value=T.sceneNumbers,s("#scene-num-format").value=T.sceneNumberFormat,s("#scene-num-dialog").showModal()});s("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),De("sceneNumbers",s("#scene-num-placement").value),De("sceneNumberFormat",s("#scene-num-format").value),wn(),s("#scene-num-dialog").close())});function Et(e){document.body.dataset.mobileTab=e,j(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&ae()&&r.previewMode!=="live"?ge("live"):e==="preview"&&r.previewMode==="pdf"&&we(),e==="source"&&(ie(),ke(J().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>wt(r.insightLine,!1))}j(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Et(e.dataset.mobilePanel)));s("#preview-scroll").addEventListener("scroll",()=>{Q(),I()});ve.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&xt(e)}));document.addEventListener("pointerdown",e=>ve.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=s("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&Q()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!s("#preview-context-menu").hidden?Q():e.key==="Escape"&&ve.some(t=>t.open)?xt():(c===document.activeElement||h.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Le():nt()):(c===document.activeElement||h.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Le()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),Ie(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),ut()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),ct())});window.addEventListener("beforeunload",Ye);var Te=0;function St(){Te=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function le(){Te||(Te=requestAnimationFrame(St))}window.visualViewport?.addEventListener("resize",le);window.visualViewport?.addEventListener("scroll",le);window.addEventListener("scroll",le);document.addEventListener("focusin",le);window.addEventListener("resize",()=>{le(),Q(),ie(),ae()&&r.previewMode==="pdf"&&ge("live"),O()});async function yn(){St(),ht(r.theme);let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";s("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),document.body.classList.add(`scene-nums-${T.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),i=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),i&&document.documentElement.style.setProperty("--stats-w",`${i}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),We(s("#source-resizer"),"--source-w",1,250,650),We(s("#stats-resizer"),"--stats-w",-1,240,520);let o=new URLSearchParams(location.search),a=o.get("demo")==="1"?null:At(),l=o.get("demo")==="1"?Tt:"",p=o.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(o.has("project"))try{let d=await(await fetch("/api/project")).json();l=d.source,p=d.filename}catch{}let u=a&&(!o.has("project")||a.filename===p);u&&(l=a.source,p=a.filename||p,r.savedSource=typeof a.savedSource=="string"?a.savedSource:l),r.cacheEnabled=o.get("demo")!=="1",se(l,p,!u),Et(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),u&&["fit","70","85","100","115","130"].includes(String(a.zoom))&&(r.previewZoom=String(a.zoom),a.zoom!=="fit"&&(s("#zoom").value=String(a.zoom))),O();let f=["live","pdf"].includes(a?.previewMode)?a.previewMode:"live";await ge(u?f:localStorage.getItem("fountain-publisher.preview")||"live"),u&&requestAnimationFrame(()=>{let m=Math.min(Number(a.selectionStart)||0,c.value.length),d=Math.min(Number(a.selectionEnd)||m,c.value.length);c.setSelectionRange(m,d),c.scrollTop=Math.max(0,Number(a.sourceScrollTop)||0),s("#preview-scroll").scrollTop=Math.max(0,Number(a.previewScrollTop)||0),s("#line-numbers").scrollTop=c.scrollTop,he(),M(),N("Workspace restored")})}yn();
