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
`;var i=(e,t=document)=>t.querySelector(e),z=(e,t=document)=>[...t.querySelectorAll(e)],_e=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),_t=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=i("#source"),h=i("#screenplay-page"),je="fountain-publisher.workspace.v1",Z=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",T={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function De(e,t){T[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:Nt(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null};function Nt(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function At(){try{let e=JSON.parse(localStorage.getItem(je)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function Ye(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(je,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:i("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,updatedAt:Date.now()}))}catch{}}}function I(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(Ye,120))}function E(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function Ne(e){return E(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Ee(e){try{return decodeURIComponent(e)}catch{return e}}function Ke(e){let t=e.trim().match(_t);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Ee(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Ee(t[2].slice(0,n)),text:Ee(t[2].slice(n+1))}}function Ze(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function kt(e){let t=[],n={},o=!1;return e.forEach((s,a)=>{if(s.includes("/*")&&(o=!0),o){s.includes("*/")&&(o=!1);return}let l=Ke(s);l?.kind==="general"?t.push({line:a,text:l.text}):l?.kind==="character"&&(n[l.name]={line:a,text:l.text})}),{generalNotes:t,characterNotes:n}}function Ae(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function $t(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function Mt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||Ae(n))return!1;let s=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),a=t===0||!e[t-1].trim();return s&&a}function fe(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],o=!0,s=!1,a=!1,l=!1,p=!1;for(let u=0;u<t.length;u+=1){let f=t[u],m=f.trim(),d="action",g=f,v="";if(m.includes("/*")&&(p=!0),p)d="boneyard";else if(!m)d="empty",l=!1,s&&(o=!1),a=!1;else if(o&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&_e.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let b=f.indexOf(":");v=f.slice(0,b+1),g=f.slice(b+1).trim(),d=v.toLowerCase()==="title:"?"title-value title":"title-value",s=!0,a=!0,l=!1}else o&&a&&/^\s+/.test(f)?(g=m,d="title-value",l=!1):(o=!1,/^#{1,6}\s/.test(m)?d="section":/^=/.test(m)&&!/^={3,}$/.test(m)?d="synopsis":/^\[\[.*\]\]$/.test(m)?d="note":/^~/.test(m)?(d="lyric",g=f.replace(/^\s*~/,"")):/^={3,}$/.test(m)?d="page-break":Ae(m)?(d="scene",l=!1):Mt(t,u)?(d="character",g=m.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(m)?d="parenthetical":l?d="dialogue":/^>.*<$/.test(m)?(d="centered",g=m.slice(1,-1).trim()):/^>/.test(m)||/^[A-Z0-9 .'-]+TO:$/.test(m)?d="transition":m.startsWith("!")&&(d="action",g=f.replace(/^\s*!/,"")));n.push({raw:f,display:g,prefix:v,type:d,index:u}),m.includes("*/")&&(p=!1)}return n}function It(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=fe(e),o=kt(t),s=new Map,a=[],l=[],p=new Set,u=[],f="",m=0,d="",g=0,v=0,b=0;n.forEach((y,w)=>{let _=(y.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(y.prefix&&u.push(y.prefix.slice(0,-1)),y.type==="section"){let x=y.raw.trim().match(/^(#{1,6})\s+(.+)$/);x&&(l.push({level:x[1].length,title:x[2],line:w+1}),x[1].length===1&&(d=x[2],g+=1))}else if(y.type==="scene"){let x=y.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),F=y.display.match(/#([^#]+)#/)?.[1]||String(a.length+1);a.push({number:F,heading:x,line:w+1,words:0,act:d||"Screenplay",actNumber:g}),m=a.length;let ee=x.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ee&&p.add(ee),f=""}else if(y.type==="character"){f=$t(y.display);let x=s.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};x.cues+=1,x.lastLine=w+1,m&&x.sceneSet.add(m),s.set(f,x)}else if(y.type==="dialogue"){let x=s.get(f);x&&(x.lines+=1,x.words+=_,v+=_,m&&x.sceneLineMap.set(m,(x.sceneLineMap.get(m)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(y.type)||(f="",b+=_,a.length&&(a.at(-1).words+=_))});let O=[...s.values()].map(y=>({...y,seconds:Math.round(y.words/130*60),scenes:y.sceneSet.size,sceneLines:[...y.sceneLineMap].map(([w,_])=>({scene:w,lines:_})),sceneSet:void 0,sceneLineMap:void 0})).sort((y,w)=>w.words-y.words||y.name.localeCompare(w.name)),P=v+b,B=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:P,dialogueWords:v,actionWords:b,estimatedSeconds:B==null?0:B*60,characters:O,scenes:a,sections:l,locations:[...p].sort(),titleFields:u,pageCount:B,...o}}function Ce(e,t=null){let n=e.raw.trim().match(/^>\s*(.*?)\s*<$/),o=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,s=n?"centered":e.type,a=`script-line ${s}${o?" act":""}`,l=o?.[1]||e.display,p=o?"#":e.prefix;if(n?l=n[1]:s==="transition"&&e.raw.trim().startsWith(">")&&(l=e.raw.trim().slice(1).trimStart()),t!==null){let d=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");l=T.sceneNumbers==="inline"?`${t}. ${d}`:d}let u=s==="note"?Ke(e.raw):null,f=l?Ne(l):"<br>",m=t!==null?E(t):"";if(s==="note"&&!u){let d=Ze(e.raw);return`<div class="script-line note annotation-line" data-line="${e.index}"><button class="annotation-orb" type="button" data-annotation-line="${e.index}" title="${E(d)}" aria-label="Edit annotation: ${E(d)}"></button></div>`}return s==="note"&&u?`<div class="script-line note managed-note" data-line="${e.index}"></div>`:`<div class="${a}" data-line="${e.index}" data-prefix="${E(p)}" data-scene-number="${m}" data-display="${E(l)}">${f}</div>`}function Rt(e){let t=new Map;if(T.sceneNumbers==="off")return t;let n=0,o=0,s=0,a=T.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(o++,s=0):l.type==="scene"&&(n++,s++,t.set(l.index,a==="act"?`A${Math.max(o,1)}S${s}`:String(n)));return t}function Ot(e){let t=Rt(e),n=[];for(let o=0;o<e.length;o+=1){if(e[o].type==="character"){let a=o+1;for(;a<e.length&&["dialogue","parenthetical","note"].includes(e[a].type);)a+=1;for(;a<e.length&&e[a].type==="empty";)a+=1;if(e[a]?.type==="character"&&e[a].raw.trim().endsWith("^")){let l=a+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(o,a).filter(f=>f.type!=="empty").map(f=>Ce(f)).join(""),u=e.slice(a,l).map(f=>Ce(f)).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${p}</div><div class="dual-right">${u}</div></div>`),o=l-1;continue}}let s=t.get(e[o].index)??null;n.push(Ce(e[o],s))}return n.join("")}function ne({focusLine:e=null,focusOffset:t=null}={}){let n=fe(c.value),o=i("#preview-scroll"),s=i("#preview-page-stage"),a=o.scrollTop,l=o.scrollLeft;h.innerHTML=Ot(n),h.spellcheck=i("#spellcheck").checked;let p=n.some(u=>u.raw.trim());if(i("#empty-state").hidden=p,s.hidden=r.previewMode!=="live",h.hidden=r.previewMode!=="live",e!==null){let u=i(`[data-line="${e}"]`,h);if(h.focus({preventScroll:!0}),u){let f=t??u.textContent.length;G(u,f),H(u,f)}}o.scrollTop=a,o.scrollLeft=l,requestAnimationFrame(()=>{o.scrollTop=a,o.scrollLeft=l}),Qe(),R()}function G(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),o=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),s=o.nextNode();for(;s&&n>s.textContent.length;)n-=s.textContent.length,s=o.nextNode();let a=document.createRange();s?a.setStart(s,n):(a.selectNodeContents(e),a.collapse(!1)),a.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(a)}function Pt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),o=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let u of e.matchAll(o)){let f=u[1].length;for(let m=u.index;m<u.index+f;m+=1)t[m]=!0;for(let m=u.index+u[0].length-f;m<u.index+u[0].length;m+=1)t[m]=!0,n[m]=!0}let s=t.flatMap((u,f)=>u?[]:[f]),a=Array.from({length:s.length+1},(u,f)=>f<s.length?s[f]:(s.at(-1)??-1)+1),l=Array.from({length:s.length+1},(u,f)=>f?s[f-1]+1:s[0]??0),p=Array.from({length:s.length+1},(u,f)=>{let m=f?s[f-1]+1:0,d=f<s.length?s[f]:e.length;for(;m<d&&n[m];)m+=1;return m});return{startMap:a,endMap:l,caretMap:p}}function Ft(e,t){let n=0,o=t.length,s=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",s)+1,t[n]===" "&&(n+=1);let a=t.lastIndexOf("<");o=a<n?o:a,t[o-1]===" "&&(o-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",s)+1;else if(e.classList.contains("character")&&t.slice(s).startsWith("@"))n=s+1;else if(e.classList.contains("transition")&&t.slice(s).startsWith(">"))for(n=s+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let a=t.indexOf(e.dataset.prefix,s);for(n=a<0?0:a+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let a=t.slice(n,o).match(/\s+#[^#]+#\s*$/);a&&(o=n+a.index)}return{start:n,end:o,map:Pt(t.slice(n,o))}}function U(e,t,n,o="caret"){let s=Ft(e,t),a=e.dataset.sceneNumber&&T.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-a,s.map.startMap.length-1)),p=o==="start"?s.map.startMap:o==="end"?s.map.endMap:s.map.caretMap;return s.start+(p[l]??s.end-s.start)}function Dt(e,t){let n=[],o=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let s of e.matchAll(o)){let a=s.index+s[1].length,l=s.index+s[0].length-s[1].length;t>=a&&t<=l&&n.push(s[1])}return n}function Be(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let o=document.createRange();return o.selectNodeContents(e),o.setEnd(t,n),o.toString().length}function D(e=M(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),o=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,s=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,a=o?.closest?.(".script-line")||e,l=s?.closest?.(".script-line")||e;return{startLine:a,endLine:l,startOffset:Be(a,n.startContainer,n.startOffset),endOffset:Be(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function He(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let o=D(e);if(!o||o.startLine!==o.endLine||o.startOffset!==o.endOffset)return!1;if(!e.textContent.length)return!0;let s=document.createRange();s.selectNodeContents(e);let a=[...s.getClientRects()],l=t==="first"?a[0]?.top:a.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let u=[...p.getClientRects()];return u.length?l!==void 0&&u.length>0&&u.every(f=>Math.abs(f.top-l)<1):t==="first"?o.startOffset===0:o.startOffset===e.textContent.length}function te(e,t,n){return e.slice(0,t).reduce((o,s)=>o+s.length+1,0)+n}function H(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),o=Number(e.dataset.line),s=U(e,n[o]||"",t),a=te(n,o,s);c.setSelectionRange(a,a),ke(o),$()}function qe(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),o=Number(e.endLine.dataset.line),s=U(e.startLine,t[n]||"",e.startOffset,"start"),a=U(e.endLine,t[o]||"",e.endOffset,"end"),l=te(t,n,s),p=te(t,o,a);c.setSelectionRange(l,p,e.direction),ke(e.direction==="backward"?n:o),$()}function Xe(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),o=e.dataset.display??e.textContent,s=e.textContent.replace(/\n/g,""),a=0;for(;a<o.length&&a<s.length&&o[a]===s[a];)a+=1;let l=o.length,p=s.length;for(;l>a&&p>a&&o[l-1]===s[p-1];)l-=1,p-=1;let u=a===l,f=U(e,n[t],a,u?"caret":"start"),m=U(e,n[t],l,u?"caret":"end"),d=n[t].slice(0,f)+s.slice(a,p)+n[t].slice(m);n[t]=d,e.dataset.display=s,e.innerHTML=Ne(s)||"<br>",G(e,p),c.value=n.join(`
`);let g=te(n,t,f+p-a);c.setSelectionRange(g,g),A({fromPreview:!0})}function q(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),o=Number(e.startLine.dataset.line),s=Number(e.endLine.dataset.line),a=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),u=`${a}${p}${l}`.split(`
`),f=o===s&&e.startOffset===e.endOffset,m=U(e.startLine,n[o],e.startOffset,f?"caret":"start"),d=U(e.endLine,n[s],e.endOffset,f?"caret":"end"),g=n[s].slice(d),v=o===s?[]:n.slice(o+1,s).filter(w=>/^\s*\[\[.*\]\]\s*$/.test(w));if(o===s&&p.includes(`
`)){let w=Dt(n[o],m);w.length&&(p=p.replaceAll(`
`,`${[...w].reverse().join("")}
${w.join("")}`))}let b=`${n[o].slice(0,m)}${p}${n[s].slice(d)}`.split(`
`);if(o===s&&e.startLine.classList.contains("centered")&&b.length>1){b[0]=`${b[0].trimEnd()} <`,b[b.length-1]=`> ${b.at(-1).trimStart()}`;for(let w=1;w<b.length-1;w+=1)b[w]=`> ${b[w]} <`}n.splice(o,s-o+1,...b,...v),c.value=n.join(`
`);let O=o+u.length-1,P=u.length===1?a.length+t.length:t.split(/\r\n?|\n/).at(-1).length,B=b.at(-1).length-g.length,y=te(n,O,Math.max(0,B));c.setSelectionRange(y,y),A({fromPreview:!0}),o===s&&u.length===1?(e.startLine.innerHTML=Ne(u[0])||"<br>",e.startLine.dataset.display=u[0],h.focus({preventScroll:!0}),G(e.startLine,P),H(e.startLine,P),Ge(e.startLine)):ne({focusLine:O,focusOffset:P})}function Bt(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return q(e,"");let o=e.startLine,s=Number(o.dataset.line),a=o.textContent;if(t==="backward"&&e.startOffset>0){let l=a.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<a.length){let l=a.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=z(".script-line[data-display]",h),p=l.indexOf(o),u=l[p+(t==="backward"?-1:1)];if(!u)return;t==="backward"?(e.startLine=u,e.startOffset=u.textContent.length):(e.endLine=u,e.endOffset=0)}q(e,"")}function j(){i("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function Ge(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),o=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(o)||n&&!/^[A-Z0-9 ._'-]*$/.test(o))return j();r.previewCompletionItems=r.metadata.characters.map(s=>s.name).filter((s,a,l)=>s.startsWith(o)&&s!==o&&l.indexOf(s)===a),r.previewCompletionIndex=0,r.previewCompletionLine=e,Je()}function Je(){let e=i("#preview-completion-menu");if(!r.previewCompletionItems.length)return j();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${E(t)}</span><small>Character</small></button>`).join(""),Ht()}function Ht(){let e=i("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=i(".preview-panel").getBoundingClientRect(),o=getSelection(),s=t.getBoundingClientRect();if(o?.rangeCount&&t.contains(o.focusNode)){let m=document.createRange();if(m.setStart(o.focusNode,o.focusOffset),m.collapse(!0),s=m.getClientRects()[0]||m.getBoundingClientRect(),!s.width&&!s.height){let d=document.createRange();d.selectNodeContents(t),d.setEnd(o.focusNode,o.focusOffset);let g=d.getBoundingClientRect(),v=t.getBoundingClientRect();s={left:g.right,right:g.right,top:v.top,bottom:v.bottom,width:0,height:v.height}}}let a=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-a-8,s.left)),p=Math.min(e.scrollHeight,245),u=s.bottom+6,f=u+p<=n.bottom-8?u:Math.max(n.top+8,s.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function Ve(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,Xe(n),j(),h.focus({preventScroll:!0}),G(n,n.textContent.length))}function oe(){zt(),me(),Ut(),$()}function Ut(){let e=i("#line-numbers"),t=i("#source-highlight"),n=t.getBoundingClientRect(),o=c.value.split(`
`).map((a,l)=>{let u=i(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=u?u.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),s=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${o}<span class="line-number-spacer" style="height:${s}px"></span>`,e.scrollTop=c.scrollTop}function Wt(e){return E(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function zt(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=fe(c.value);i("#source-highlight").innerHTML=t.map((n,o)=>{let s=e[n.type],a=Wt(n.raw)||" ",l=o<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${s?` class="syntax-${s}"`:""}>${a}${l}</span>`}).join("")}function de(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function me(){let e=i("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=de(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=de(e,t)}function J(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function jt(e,t="nearest"){let n=i("#preview-scroll"),o=e.getBoundingClientRect(),s=n.getBoundingClientRect(),a=n.scrollTop,l=n.scrollLeft;t==="center"?a+=o.top-s.top-(n.clientHeight-o.height)/2:o.top<s.top?a+=o.top-s.top:o.bottom>s.bottom&&(a+=o.bottom-s.bottom),o.left<s.left?l+=o.left-s.left:o.right>s.right&&(l+=o.right-s.right),n.scrollTop=Math.max(0,a),n.scrollLeft=de(n,l)}function ke(e,t="nearest"){if(!c.clientHeight)return;let n=i("#source-highlight"),s=i(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!s)return;let a=getComputedStyle(c),l=parseFloat(a.paddingTop)||0,p=parseFloat(a.paddingBottom)||0,u=parseFloat(a.lineHeight)||20.15,f=s.top-n.getBoundingClientRect().top+n.scrollTop,m=f+u,d=c.scrollTop;t==="center"?d=f-(c.clientHeight-u)/2:f<c.scrollTop+l?d=f-l:m>c.scrollTop+c.clientHeight-p&&(d=m-c.clientHeight+p),c.scrollTop=Math.max(0,d),me(),i("#line-numbers").scrollTop=c.scrollTop}function Qe(e=!1,t="nearest"){let n=i(`[data-line="${J().line}"]`,h);z(".script-line.source-current",h).forEach(o=>o.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&jt(n,t)}function $({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=J();i("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let o=fe(c.value)[n.line]?.type||"action",s={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};i("#editor-status").textContent=s[o]||o[0].toUpperCase()+o.slice(1);let a=getComputedStyle(c),l=parseFloat(a.lineHeight)||20.15,p=i(`[data-source-line="${n.line}"]`,i("#source-highlight")),u=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(a.paddingTop):-c.scrollTop;i("#current-line").style.height=`${l}px`,i("#current-line").style.transform=`translateY(${u}px)`,Qe(e,t)}function et(e){r.metadata=e,i("#stat-pages").textContent=e.pageCount??"\u2014",i("#stat-scenes").textContent=e.scenes.length,i("#stat-words").textContent=e.wordCount.toLocaleString(),i("#scene-count").textContent=e.scenes.length,i("#character-count").textContent=e.characters.length,i("#scene-list").innerHTML=Zt(e),Yt(),Kt();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;i("#dialogue-bar").style.width=`${n}%`,i("#dialogue-percent").textContent=`${n}%`,i("#action-percent").textContent=`${100-n}%`,i("#character-analytics-dialog").open&&$e()}function Yt(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};i("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let o=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${E(n.name)}">${E(n.name)}${o?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function Kt(){let e=r.metadata.generalNotes||[];i("#general-note-count").textContent=e.length,i("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${E(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function Se(e,t=e.number){return`<li><span class="scene-num">${E(t)}</span><button type="button" data-line="${e.line}">${E(e.heading)}</button></li>`}function Zt(e){let t=e.scenes||[],n=(e.sections||[]).filter(a=>a.level===1);if(!n.length)return t.length?t.map(a=>Se(a)).join(""):'<li class="empty-list">No scene headings yet.</li>';let o=t.filter(a=>!a.actNumber).map(a=>Se(a)).join(""),s=n.map((a,l)=>{let p=l+1,u=t.filter(f=>f.actNumber===p).map((f,m)=>Se(f,String(m+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${a.line}"><span>${l+1}</span>${E(a.title)}</button><ol>${u||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return o+s}function K(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function re(e,t,n){let o=String(t);if(e.measureText(o).width<=n)return o;let s=o;for(;s.length&&e.measureText(`${s}\u2026`).width>n;)s=s.slice(0,-1);return s?`${s}\u2026`:""}function $e(){let e=i("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,o=Math.min(window.devicePixelRatio||1,2),s=150,a=92,l=28,p=54,u=34,f=Math.max(720,s+n.length*a+18),m=l+p+Math.max(t.length,1)*u+18;e.width=Math.ceil(f*o),e.height=Math.ceil(m*o),e.style.width=`${f}px`,e.style.height=`${m}px`;let d=e.getContext("2d");d.scale(o,o);let g=K("--surface","#fff"),v=K("--surface-2","#f2f2f2"),b=K("--ink","#202124"),O=K("--muted","#6b7280"),P=K("--border","#d7d9dd"),B=K("--syntax-character","#7c3aed"),y=t.flatMap(C=>(C.sceneLines||[]).map(S=>S.lines)).filter(C=>C>0),w=y.length?Math.min(...y):0,_=y.length?Math.max(...y):0,x=i("#character-analytics-legend");x.hidden=!y.length,i("#character-analytics-min").textContent=`${w} ${w===1?"line":"lines"}`,i("#character-analytics-max").textContent=`${_} ${_===1?"line":"lines"}`,d.fillStyle=g,d.fillRect(0,0,f,m),d.strokeStyle=P,d.lineWidth=1,d.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",d.textBaseline="middle";let F=0;for(;F<n.length;){let C=n[F].act||"Screenplay",S=F+1;for(;S<n.length&&(n[S].act||"Screenplay")===C;)S+=1;let L=s+F*a,Y=(S-F)*a;d.fillStyle=v,d.fillRect(L,0,Y,l),d.fillStyle=b,d.textAlign="center",d.fillText(re(d,C,Y-12),L+Y/2,l/2),d.strokeRect(L+.5,.5,Y,l),F=S}d.fillStyle=v,d.fillRect(0,0,s,l+p),d.fillStyle=O,d.textAlign="left",d.fillText("CHARACTER",12,l+p/2);let ee=new Map,Lt=n.map((C,S)=>{if(!C.actNumber)return String(S+1);let L=(ee.get(C.actNumber)||0)+1;return ee.set(C.actNumber,L),String(L)});n.forEach((C,S)=>{let L=s+S*a;d.strokeStyle=P,d.strokeRect(L+.5,l+.5,a,p),d.fillStyle=b,d.textAlign="center",d.fillText(re(d,Lt[S],a-10),L+a/2,l+16),d.fillStyle=O,d.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",d.fillText(re(d,C.heading,a-10),L+a/2,l+36),d.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((C,S)=>{let L=l+p+S*u;S%2===1&&(d.fillStyle=v,d.fillRect(0,L,s+n.length*a,u)),d.fillStyle=b,d.textAlign="left",d.fillText(re(d,C.name,s-20),12,L+u/2);let Y=new Map((C.sceneLines||[]).map(be=>[be.scene,be.lines]));n.forEach((be,Oe)=>{let xe=Y.get(Oe+1)||0;if(!xe)return;let Pe=s+Oe*a+4,Fe=_===w?1:.25+.75*((xe-w)/(_-w));d.save(),d.globalAlpha=Fe,d.fillStyle=B,d.fillRect(Pe,L+7,a-8,u-14),d.restore(),d.fillStyle=Fe>=.6?"#fff":b,d.textAlign="center",d.fillText(String(xe),Pe+(a-8)/2,L+u/2)})}),n.length||(d.fillStyle=O,d.textAlign="center",d.fillText("Add scene headings to build the timeline.",f/2,l+p+u/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${w} to ${_} dialogue lines`)}function qt(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function Xt(){$e(),i("#character-analytics-dialog").showModal()}async function Gt(){try{await navigator.clipboard.writeText(qt()),N("Line usage CSV copied")}catch{N("Clipboard access was denied")}}async function Jt(){$e();let e=await new Promise(t=>i("#character-analytics-chart").toBlob(t,"image/png"));if(!e){N("Could not create analytics image");return}await Re(e,ue("character-analytics.png")),N("Character analytics PNG saved")}function Vt(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function tt(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=h.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],A({fromPreview:t!==null,record:!1}),t!==null?ne({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function nt(){tt(r.historyIndex-1)}function Le(){tt(r.historyIndex+1)}function A({fromPreview:e=!1,record:t=!0}={}){t&&Vt(),document.body.classList.toggle("dirty",c.value!==r.savedSource),oe(),e||ne(),et(It(c.value)),Me(),I()}function Me(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;i("#compile-status").textContent="Editing\u2026",i("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>Z?st(t):Qt(t),Z?Math.max(e,700):e)}function ot(e,t=Z){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),o=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;i("#compile-status").textContent=o,i("#compile-status").title=o,i("#compile-status").classList.add("error")}async function st(e){i("#compile-status").textContent="Compiling\u2026";try{let t=await pt("pdf",i("#page-size").value),n=await it(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,i("#stat-pages").textContent=n,i("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;ot(t,!0)}}async function Qt(e){let t=new AbortController;r.compileController=t,i("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:i("#page-size").value,sceneNumbers:T.sceneNumbers,sceneNumberFormat:T.sceneNumberFormat}),signal:t.signal});if(ft(n,"application/json")){Z=!0,await st(e);return}let o=await n.json();if(!n.ok)throw new Error(o.error||"Compilation failed");if(o.pageCount==null&&(o.pageCount=await it(await pe("/api/render/pdf"))),o.estimatedSeconds=o.pageCount*60,e!==r.compileRevision)return;et(o),i("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;ot(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function it(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function en(){let{line:e,start:t}=J(),n=c.value.split(`
`),s=n[e].slice(0,c.selectionStart-t).trim(),a=s.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],u=(d,g,v="\u0192")=>p.push({value:d,detail:g,icon:v}),f=(a?s.slice(1):s.split(/\s+/).at(-1)).toUpperCase();(a||f&&r.metadata.characters.some(d=>d.name.startsWith(f)))&&r.metadata.characters.forEach(d=>u(d.name,`${d.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!s||/^[A-Za-z ]*$/.test(s))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(d=>!r.metadata.titleFields.some(g=>`${g}:`.toLowerCase()===d.trim().toLowerCase())).forEach(d=>u(d,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(s)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(d=>u(d,"Time of day","\u25F7")):Ae(s)||/^(?:INT|EXT|EST|I\/E)/i.test(s)?r.metadata.locations.forEach(d=>u(d,"Existing location","\u2302")):l&&(a||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(d=>u(d,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(d=>u(d,"Transition","\u2192"))));let m=(a?s.slice(1):s).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((d,g)=>p.findIndex(v=>v.value===d.value)===g&&(d.icon!=="@"||d.value.toUpperCase()!==f)&&(!m||d.value.toUpperCase().startsWith(m)||d.detail==="Existing location"))}function at({allowBlank:e=!1}={}){let{line:t,start:n}=J(),o=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!o||(r.completionItems=en(),r.completionIndex=0,!r.completionItems.length))return W();rt()}function rt(){let e=i("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${E(t.icon)}</span><span>${E(t.value)}</span><small>${E(t.detail)}</small></button>`).join(""),tn(),i(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function W(){i("#completion-menu").hidden=!0,r.completionItems=[]}function tn(){let e=i("#completion-menu"),t=c.getBoundingClientRect(),n=i("#source-panel").getBoundingClientRect(),o=getComputedStyle(c),s=document.createElement("div"),a=document.body.classList.contains("source-wrap"),l=de(c);Object.assign(s.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:o.boxSizing,left:`${t.left-(a?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${a?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:o.padding,border:o.border,font:o.font,letterSpacing:o.letterSpacing,lineHeight:o.lineHeight,whiteSpace:a?"pre-wrap":"pre",overflowWrap:a?"anywhere":"normal",tabSize:o.tabSize}),s.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",s.append(p),document.body.append(s);let u=p.getBoundingClientRect();s.remove();let f=Math.min(310,n.width-16),m=Math.max(n.left+8,Math.min(n.right-f-8,u.left)),d=Math.min(e.scrollHeight,245),g=u.bottom+5,v=g+d<=n.bottom-8?g:Math.max(n.top+8,u.top-d-5);e.style.left=`${m}px`,e.style.top=`${v}px`,e.style.right="auto",e.style.bottom="auto"}function lt(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=J(),s=c.value.slice(0,c.selectionStart).slice(n.start),a=n.start;if(t.icon==="@"){let p=s.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";a=c.selectionStart-p.length}else/\s-\s/.test(s)?a=n.start+s.lastIndexOf("-")+2:s.trim()&&(a=n.start+s.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,a,c.selectionStart,"end"),W(),A()}async function ct(){await dt()&&(r.handle=null,se("","Untitled.fountain",!0),c.focus())}async function dt(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function ut(){if(await dt()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();se(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&N(e.message);return}i("#file-input").click()}}function se(e,t,n=!1){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),i("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,A()}async function Ie(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:ue("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await Re(new Blob([c.value],{type:"text/plain;charset=utf-8"}),ue("fountain"));r.savedSource=c.value,se(c.value,r.filename,!0),N(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&N(t.message)}}function ue(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function Re(e,t){let n=URL.createObjectURL(e),o=document.createElement("a");o.href=n,o.download=t,document.body.appendChild(o),o.click(),document.body.removeChild(o),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function nn(e,t){let o={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(o)){await navigator.share(o);return}await Re(e,t)}var le;async function on(){return le||(le=(async()=>{i("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let o=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(o.map(async s=>{let a=await fetch(new URL(`fonts/${s}`,import.meta.url));if(!a.ok)throw new Error(`Unable to load PDF font ${s}`);n.FS.writeFile(`/fonts/${s}`,new Uint8Array(await a.arrayBuffer()))})),await n.runPythonAsync(`
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
`),i("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw le=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),le}async function pt(e,t){let n=await on();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",T.sceneNumbers),n.globals.set("_fp_scene_number_format",T.sceneNumberFormat);let o=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),s=o instanceof Uint8Array?o:o.toJs();o.destroy?.();let a={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([s],{type:a[e]})}function ft(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function Ue(e,t){return pt(e==="/api/render/pdf"?"pdf":"fdx",t)}async function pe(e,t=i("#page-size").value){if(Z)return Ue(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:T.sceneNumbers,sceneNumberFormat:T.sceneNumberFormat})});if(ft(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return Z=!0,Ue(e,t);if(!n.ok){let s=await n.json().catch(()=>({}));throw new Error(s.error||"Export failed")}return n.blob()}async function sn(e){i("#confirm-export").disabled=!0;try{let t=e==="pdf"?await pe("/api/render/pdf",i("#export-page-size").value):await pe("/api/export/fdx");await nn(t,ue(e)),i("#export-dialog").close(),N(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&N(t.message)}finally{i("#confirm-export").disabled=!1}}function mt(e){i("#export-format").value=e,i("#export-page-size").value=i("#page-size").value,i("#dialog-page-size").hidden=e!=="pdf",i("#export-dialog").showModal()}function he(){return matchMedia("(max-width: 640px)").matches}async function ge(e){he()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),z("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=i(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),i("#preview-page-stage").hidden=e!=="live",h.hidden=e!=="live",i("#empty-state").hidden=e!=="live"||!!c.value.trim(),i("#pdf-view").hidden=e!=="pdf",i("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),I(),e==="pdf"&&await ye()}async function ye(){i("#pdf-placeholder").hidden=!1,i("#pdf-frame").hidden=!0;try{let e=await pe("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),i("#pdf-frame").src=r.pdfUrl,i("#pdf-frame").hidden=!1,i("#pdf-placeholder").hidden=!0}catch(e){i("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${E(e.message)}</span>`}}function ht(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,i("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),i("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function an(){let e=document.documentElement.dataset.effectiveTheme||"light";ht(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),i(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),i(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(R)}function We(e,t,n,o,s){let a=0,l=0,p=u=>{let f=Math.max(o,Math.min(s,u));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&oe(),r.previewZoom==="fit"&&requestAnimationFrame(R)};e.addEventListener("pointerdown",u=>{a=u.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(u.pointerId)}),e.addEventListener("pointermove",u=>{e.hasPointerCapture(u.pointerId)&&p(l+(u.clientX-a)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",u=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(u.key))return;u.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));u.key==="Home"?p(o):u.key==="End"?p(s):p(f+(u.key==="ArrowRight"?1:-1)*n*(u.shiftKey?30:10))})}function R(){let e=r.previewZoom;if(i("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),he()){let s=e==="fit"?1:Number(e)/100;h.style.transform="none",h.style.marginBottom="0",h.style.marginRight="0",i("#preview-page-stage").style.removeProperty("width"),i("#preview-page-stage").style.removeProperty("min-height"),h.style.setProperty("--mobile-preview-zoom",s),I();return}h.style.removeProperty("--mobile-preview-zoom");let t=Number(e)/100;if(e==="fit"){let s=i("#preview-scroll"),a=getComputedStyle(s),l=s.clientWidth-parseFloat(a.paddingLeft)-parseFloat(a.paddingRight);t=Math.max(.25,l/816)}let n=i("#preview-page-stage");n.style.width=`${816*t}px`,n.style.minHeight=`${1056*t}px`,h.style.transform=`scale(${t})`,h.style.marginBottom="0",h.style.marginRight="0";let o=i("#preview-scroll");requestAnimationFrame(()=>{o.scrollLeft=Math.max(0,(o.scrollWidth-o.clientWidth)/2)}),I()}function gt(e){let t=["70","85","100","115","130"],n=i("#zoom");if(r.previewZoom==="fit"){n.value="100",r.previewZoom="100",R();return}let o=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,o+e))],r.previewZoom=n.value,R()}function yt(e,t=!0){let n=c.value.split(`
`),o=0;for(let u=0;u<Math.max(0,e-1);u+=1)o+=n[u].length+1;t&&c.focus(),c.setSelectionRange(o,o+(n[e-1]?.length||0)),$({scrollPreview:!0,scrollBlock:"center"});let s=i("#source-highlight"),l=i(`[data-source-line="${Math.max(0,e-1)}"]`,s)?.getClientRects()[0],p=l?l.top-s.getBoundingClientRect().top+s.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),i("#line-numbers").scrollTop=c.scrollTop,i("#source-highlight").scrollTop=c.scrollTop,$({scrollPreview:!0,scrollBlock:"center"})}function rn(e){r.insightLine=e,yt(e,!1)}var ze;function N(e){let t=i("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(ze),ze=setTimeout(()=>t.classList.remove("show"),2200)}function V(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function ie(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),A()}function wt(e){let t=V();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),ie(t)}function ln(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function cn(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function vt(e=null,t=null){let n=e===null?"":Ze(V()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},i("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",i("#annotation-text").value=n,i("#delete-annotation").hidden=e===null,i("#annotation-dialog").showModal(),setTimeout(()=>i("#annotation-text").focus(),0)}function Q(){let e=i("#preview-context-menu");e.hidden=!0,r.previewContextLine=null}function M(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function ce(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return h.contains(t.commonAncestorContainer)?e:null}function dn(e,t,n){let o=(l,p)=>{let u=document.createRange();return u.selectNodeContents(e),u.setEnd(l,p),u.toString().length},s=document.caretPositionFromPoint?.(t,n);if(s&&e.contains(s.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(s.offsetNode,s.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),h.focus({preventScroll:!0}),H(e,o(s.offsetNode,s.offset));return}let a=document.caretRangeFromPoint?.(t,n);if(a&&e.contains(a.startContainer)){let l=getSelection();a.collapse(!0),l?.removeAllRanges(),l?.addRange(a),h.focus({preventScroll:!0}),H(e,o(a.startContainer,a.startOffset));return}h.focus({preventScroll:!0}),G(e,e.textContent.length),H(e)}function un(e,t,n){let o=i("#preview-context-menu");r.previewContextLine=Number(e.dataset.line),o.hidden=!1,o.style.left="0px",o.style.top="0px";let{width:s,height:a}=o.getBoundingClientRect();o.style.left=`${Math.max(8,Math.min(window.innerWidth-s-8,t))}px`,o.style.top=`${Math.max(8,Math.min(window.innerHeight-a-8,n))}px`}async function pn(e,t){let n=Number.isInteger(t)?i(`[data-line="${t}"]`,h):null;if(e==="copy"){let s=ce()?.toString()||"";if(!s)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(s),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let o=ce(),s=o?.toString()||"";if(!s)return"Select text to cut";try{if(document.execCommand("cut"))return""}catch{}let a=D(M(o?.focusNode)||n);if(!a)return"Select text to cut";try{return await navigator.clipboard.writeText(s),q(a,""),""}catch{return"Clipboard access was denied"}}if(e==="paste"){let o=D(n||M(ce()?.focusNode));if(!o)return"Click where you want to paste";try{return q(o,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function fn(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},i("#character-note-heading").textContent=`${e} notes`,i("#character-note-text").value=t?.text||"",i("#delete-character-note").hidden=!t,i("#character-note-dialog").showModal(),setTimeout(()=>i("#character-note-text").focus(),0)}function bt(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},i("#general-note-heading").textContent=t?"Edit general note":"Add general note",i("#general-note-text").value=t?.text||"",i("#delete-general-note").hidden=!t,i("#general-note-dialog").showModal(),setTimeout(()=>i("#general-note-text").focus(),0)}function we(e){if(e==null)return;let t=V();t.splice(e,1),ie(t)}var ve=z(".toolbar-menu");function xt(e=null){ve.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{A(),e.inputType==="insertText"?at():W()});c.addEventListener("scroll",()=>{i("#line-numbers").scrollTop=c.scrollTop,me(),$(),I()});c.addEventListener("click",()=>{$({scrollPreview:!0}),W(),I()});c.addEventListener("select",()=>{$({scrollPreview:!0}),I()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||$({scrollPreview:!0}),I()});c.addEventListener("keydown",e=>{if(!i("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,rt();return}if(e.key==="Tab"){e.preventDefault(),lt();return}if(e.key==="Escape"){e.preventDefault(),W();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),at({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),A()):e.key==="Enter"&&W()});h.addEventListener("beforeinput",e=>{let t=M(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=D(t);if(!n)return;let o=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),s=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!o.has(e.inputType)&&!s.has(e.inputType)))if(e.preventDefault(),j(),s.has(e.inputType)){let a=e.inputType.includes("Forward");Bt(n,a?"forward":"backward",e.inputType.includes("Word"))}else{let a=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";q(n,a)}});h.addEventListener("input",e=>{let t=M(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(Xe(t),Ge(t))});h.addEventListener("paste",e=>{let t=M(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=D(t);n&&(e.preventDefault(),q(n,e.clipboardData?.getData("text/plain")||""))});h.addEventListener("keydown",e=>{let t=M(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!i("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,Je();return}if(e.key==="Tab"){e.preventDefault(),Ve();return}if(e.key==="Escape"){e.preventDefault(),j();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,o=n===-1?He(t,"first"):n===1&&He(t,"last");if(n&&o){let s=D(t),a=i(`[data-line="${Number(t.dataset.line)+n}"]`,h);if(s&&s.startLine===s.endLine&&s.startOffset===s.endOffset&&a){e.preventDefault();let l=Math.min(s.startOffset,a.textContent.length);h.focus({preventScroll:!0}),G(a,l),H(a,l)}}});h.addEventListener("focusin",()=>{let e=M(getSelection()?.focusNode);e&&H(e)});h.addEventListener("pointerup",e=>{let t=M(getSelection()?.focusNode)||e.target.closest(".script-line"),n=D(t);n&&qe(n)});h.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=M(getSelection()?.focusNode)||e.target.closest(".script-line"),n=D(t);n&&qe(n)});h.addEventListener("focusout",()=>setTimeout(()=>{i("#preview-completion-menu").matches(":hover")||j()},0));h.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),j();let n=ce();(!n||n.isCollapsed)&&dn(t,e.clientX,e.clientY),un(t,e.clientX,e.clientY)});h.addEventListener("click",e=>{Q();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),vt(Number(t.dataset.annotationLine)))});i("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n}=r,o=t.dataset.previewMenuAction;if(Q(),o==="annotation")return vt(null,n);let s=await pn(o,n);s&&N(s)});i("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),Ve(Number(t.dataset.index)))});i("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),lt(Number(t.dataset.index)))});i("[data-character-analytics]").addEventListener("click",Xt);i("#close-character-analytics").addEventListener("click",()=>i("#character-analytics-dialog").close());i("#copy-character-lines").addEventListener("click",Gt);i("#save-character-analytics").addEventListener("click",Jt);i("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&rn(Number(t.dataset.line))});i("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&fn(t.dataset.characterNote)});i("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&bt(Number(t.dataset.generalNoteLine))});i("#add-general-note").addEventListener("click",()=>bt());i("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=V();r.noteEditor.line===null?n.splice(r.noteEditor.insertAfter+1,0,`[[${t}]]`):n[r.noteEditor.line]=`[[${t}]]`,ie(n),i("#annotation-dialog").close()});i("#delete-annotation").addEventListener("click",()=>{we(r.noteEditor?.line),i("#annotation-dialog").close()});i("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#character-note-text").value.trim();if(!t){we(r.noteEditor.line),i("#character-note-dialog").close();return}let n=cn(r.noteEditor.name,t);if(r.noteEditor.line===null)wt(n);else{let o=V();o[r.noteEditor.line]=n,ie(o)}i("#character-note-dialog").close()});i("#delete-character-note").addEventListener("click",()=>{we(r.noteEditor?.line),i("#character-note-dialog").close()});i("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#general-note-text").value.trim();if(!t)return;let n=ln(t);if(r.noteEditor.line===null)wt(n);else{let o=V();o[r.noteEditor.line]=n,ie(o)}i("#general-note-dialog").close()});i("#delete-general-note").addEventListener("click",()=>{we(r.noteEditor?.line),i("#general-note-dialog").close()});i("#new-file").addEventListener("click",ct);i("#open-file").addEventListener("click",ut);i("#save-file").addEventListener("click",()=>Ie(!1));i("#save-file-as").addEventListener("click",()=>Ie(!0));i("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,se(await t.text(),t.name,!0)),e.target.value=""});i("#export-pdf").addEventListener("click",()=>mt("pdf"));i("#export-fdx").addEventListener("click",()=>mt("fdx"));i("#export-format").addEventListener("change",e=>{i("#dialog-page-size").hidden=e.target.value!=="pdf"});i("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),sn(i("#export-format").value))});i("#theme").addEventListener("click",an);i("#spellcheck").addEventListener("change",()=>{let e=i("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),i("#spellcheck-help").hidden=!e,ne(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});i("#word-wrap").addEventListener("change",()=>{let e=i("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),oe()});i("#page-size").addEventListener("change",()=>{Me(0),r.previewMode==="pdf"&&ye()});z("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ge(e.dataset.previewMode)));i("#toggle-source").addEventListener("click",()=>X("source"));i("#menu-toggle-source").addEventListener("click",()=>X("source"));i("#toggle-stats").addEventListener("click",()=>X("stats"));i("#menu-toggle-stats").addEventListener("click",()=>X("stats"));i("#undo").addEventListener("click",nt);i("#redo").addEventListener("click",Le);i("#zoom").addEventListener("change",()=>{r.previewZoom=i("#zoom").value,R()});i("#zoom-out").addEventListener("click",()=>gt(-1));i("#zoom-in").addEventListener("click",()=>gt(1));i("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",R()});i("#open-docs").addEventListener("click",()=>i("#docs-dialog").showModal());i("#close-docs").addEventListener("click",()=>i("#docs-dialog").close());function mn(e){let t=c.value;c.value=e+(t?`
`+t:""),A(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function k(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,A(),c.focus()}function hn(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),o=!1,s=null;for(let a of n){let l=a.trim();if(!l){if(o)break;continue}let p=a.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&_e.has(p[1].trim().toLowerCase()))s=p[1].trim().toLowerCase(),t[s]=p[2].trim(),o=!0;else if(o&&s&&/^\s+/.test(a))t[s]=(t[s]?t[s]+" ":"")+l;else break}return t}function gn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,o=0;for(let s of t){if(!s.trim()){if(n){o+=1;break}o+=1;continue}let l=s.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&_e.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(s))n=!0,o+=1;else break}return o}i("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(o,s)=>{let a=i(`#${o}`).value.trim();a&&t.push(`${s}: ${a}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let o=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let s=c.value,a=gn(s),l=s.replace(/\r\n?/g,`
`).split(`
`).slice(a).join(`
`);c.value=o+(l?`
`+l:""),A(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else mn(o)}i("#title-page-dialog").close()});function Et(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(i("#tp-heading").textContent=t,i("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=hn(c.value),o=s=>n[s]??"";i("#tp-title").value=o("title"),i("#tp-credit").value=o("credit"),i("#tp-author").value=o("author")||o("authors"),i("#tp-date").value=o("draft date")||o("date"),i("#tp-contact").value=o("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});i("#tp-title").value="",i("#tp-credit").value="Written by",i("#tp-author").value="",i("#tp-date").value=n,i("#tp-contact").value=""}i("#title-page-dialog").showModal(),setTimeout(()=>i("#tp-title").focus(),0)}i("#insert-title-page").addEventListener("click",Et);i("#insert-scene").addEventListener("click",()=>{k(`INT. LOCATION - DAY

`)});i("#insert-dialogue").addEventListener("click",()=>{k(`CHARACTER
Dialogue here.

`)});i("#insert-direction").addEventListener("click",()=>{k(`Action description.

`)});i("#insert-pagebreak").addEventListener("click",()=>{k(`===

`)});i("#menu-insert-title-page").addEventListener("click",Et);i("#menu-insert-scene").addEventListener("click",()=>{k(`INT. LOCATION - DAY

`)});i("#menu-insert-dialogue").addEventListener("click",()=>{k(`CHARACTER
Dialogue here.

`)});i("#menu-insert-direction").addEventListener("click",()=>{k(`Action description.

`)});i("#menu-insert-transition").addEventListener("click",()=>{k(`CUT TO:

`)});i("#menu-insert-section").addEventListener("click",()=>{k(`# Act 1

`)});i("#menu-insert-pagebreak").addEventListener("click",()=>{k(`===

`)});i("#menu-insert-centered").addEventListener("click",()=>{k(`> Centered text <

`)});function yn(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${T.sceneNumbers}`),ne(),Me(0),r.previewMode==="pdf"&&ye()}i("#menu-scene-numbers").addEventListener("click",()=>{i("#scene-num-placement").value=T.sceneNumbers,i("#scene-num-format").value=T.sceneNumberFormat,i("#scene-num-dialog").showModal()});i("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),De("sceneNumbers",i("#scene-num-placement").value),De("sceneNumberFormat",i("#scene-num-format").value),yn(),i("#scene-num-dialog").close())});function Ct(e){document.body.dataset.mobileTab=e,z(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&he()&&r.previewMode!=="live"?ge("live"):e==="preview"&&r.previewMode==="pdf"&&ye(),e==="source"&&(oe(),ke(J().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>yt(r.insightLine,!1))}z(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Ct(e.dataset.mobilePanel)));i("#preview-scroll").addEventListener("scroll",()=>{Q(),I()});ve.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&xt(e)}));document.addEventListener("pointerdown",e=>ve.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=i("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&Q()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!i("#preview-context-menu").hidden?Q():e.key==="Escape"&&ve.some(t=>t.open)?xt():(c===document.activeElement||h.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Le():nt()):(c===document.activeElement||h.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Le()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),Ie(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),ut()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),ct())});window.addEventListener("beforeunload",Ye);var Te=0;function St(){Te=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function ae(){Te||(Te=requestAnimationFrame(St))}window.visualViewport?.addEventListener("resize",ae);window.visualViewport?.addEventListener("scroll",ae);window.addEventListener("scroll",ae);document.addEventListener("focusin",ae);window.addEventListener("resize",()=>{ae(),Q(),oe(),he()&&r.previewMode==="pdf"&&ge("live"),R()});async function wn(){St(),ht(r.theme);let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";i("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),document.body.classList.add(`scene-nums-${T.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),o=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),o&&document.documentElement.style.setProperty("--stats-w",`${o}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),We(i("#source-resizer"),"--source-w",1,250,650),We(i("#stats-resizer"),"--stats-w",-1,240,520);let s=new URLSearchParams(location.search),a=s.get("demo")==="1"?null:At(),l=s.get("demo")==="1"?Tt:"",p=s.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(s.has("project"))try{let d=await(await fetch("/api/project")).json();l=d.source,p=d.filename}catch{}let u=a&&(!s.has("project")||a.filename===p);u&&(l=a.source,p=a.filename||p,r.savedSource=typeof a.savedSource=="string"?a.savedSource:l),r.cacheEnabled=s.get("demo")!=="1",se(l,p,!u),Ct(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),u&&["fit","70","85","100","115","130"].includes(String(a.zoom))&&(r.previewZoom=String(a.zoom),a.zoom!=="fit"&&(i("#zoom").value=String(a.zoom))),R();let f=["live","pdf"].includes(a?.previewMode)?a.previewMode:"live";await ge(u?f:localStorage.getItem("fountain-publisher.preview")||"live"),u&&requestAnimationFrame(()=>{let m=Math.min(Number(a.selectionStart)||0,c.value.length),d=Math.min(Number(a.selectionEnd)||m,c.value.length);c.setSelectionRange(m,d),c.scrollTop=Math.max(0,Number(a.sourceScrollTop)||0),i("#preview-scroll").scrollTop=Math.max(0,Number(a.previewScrollTop)||0),i("#line-numbers").scrollTop=c.scrollTop,me(),$(),N("Workspace restored")})}wn();
