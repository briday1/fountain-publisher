var Ft=`Title: The Last Light
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
`;var i=(e,t=document)=>t.querySelector(e),j=(e,t=document)=>[...t.querySelectorAll(e)],ke=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),Ht=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=i("#source"),m=i("#screenplay-page"),Qe="fountain-publisher.workspace.v1",Me="https://api.fountain-publisher.com",q=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",_={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function Ke(e,t){_[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:Dt(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null,previewContextEdit:null,previewContextText:"",githubConnected:!1,githubInstallUrl:"",githubPath:"",githubFile:null};function Dt(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function Bt(){try{let e=JSON.parse(localStorage.getItem(Qe)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function et(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(Qe,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:i("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,githubFile:r.githubFile,updatedAt:Date.now()}))}catch{}}}function I(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(et,120))}function w(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function Ie(e){return w(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Te(e){try{return decodeURIComponent(e)}catch{return e}}function tt(e){let t=e.trim().match(Ht);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Te(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Te(t[2].slice(0,n)),text:Te(t[2].slice(n+1))}}function nt(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function Ut(e){let t=[],n={},a=!1;return e.forEach((o,s)=>{if(o.includes("/*")&&(a=!0),a){o.includes("*/")&&(a=!1);return}let l=tt(o);l?.kind==="general"?t.push({line:s,text:l.text}):l?.kind==="character"&&(n[l.name]={line:s,text:l.text})}),{generalNotes:t,characterNotes:n}}function Re(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function Wt(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function zt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||Re(n))return!1;let o=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),s=t===0||!e[t-1].trim();return o&&s}function me(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],a=!0,o=!1,s=!1,l=!1,p=!1;for(let d=0;d<t.length;d+=1){let f=t[d],h=f.trim(),u="action",g=f,v="";if(h.includes("/*")&&(p=!0),p)u="boneyard";else if(!h)u="empty",l=!1,o&&(a=!1),s=!1;else if(a&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&ke.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let C=f.indexOf(":");v=f.slice(0,C+1),g=f.slice(C+1).trim(),u=v.toLowerCase()==="title:"?"title-value title":"title-value",o=!0,s=!0,l=!1}else a&&s&&/^\s+/.test(f)?(g=h,u="title-value",l=!1):(a=!1,/^#{1,6}\s/.test(h)?u="section":/^=/.test(h)&&!/^={3,}$/.test(h)?u="synopsis":/^\[\[.*\]\]$/.test(h)?u="note":/^~/.test(h)?(u="lyric",g=f.replace(/^\s*~/,"")):/^={3,}$/.test(h)?u="page-break":Re(h)?(u="scene",l=!1):zt(t,d)?(u="character",g=h.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(h)?u="parenthetical":l?u="dialogue":/^>.*<$/.test(h)?(u="centered",g=h.slice(1,-1).trim()):/^>/.test(h)||/^[A-Z0-9 .'-]+TO:$/.test(h)?u="transition":h.startsWith("!")&&(u="action",g=f.replace(/^\s*!/,"")));n.push({raw:f,display:g,prefix:v,type:u,index:d}),h.includes("*/")&&(p=!1)}return n}function jt(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=me(e),a=Ut(t),o=new Map,s=[],l=[],p=new Set,d=[],f="",h=0,u="",g=0,v=0,C=0;n.forEach((y,b)=>{let N=(y.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(y.prefix&&d.push(y.prefix.slice(0,-1)),y.type==="section"){let E=y.raw.trim().match(/^(#{1,6})\s+(.+)$/);E&&(l.push({level:E[1].length,title:E[2],line:b+1}),E[1].length===1&&(u=E[2],g+=1))}else if(y.type==="scene"){let E=y.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),H=y.display.match(/#([^#]+)#/)?.[1]||String(s.length+1);s.push({number:H,heading:E,line:b+1,words:0,act:u||"Screenplay",actNumber:g}),h=s.length;let ne=E.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ne&&p.add(ne),f=""}else if(y.type==="character"){f=Wt(y.display);let E=o.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};E.cues+=1,E.lastLine=b+1,h&&E.sceneSet.add(h),o.set(f,E)}else if(y.type==="dialogue"){let E=o.get(f);E&&(E.lines+=1,E.words+=N,v+=N,h&&E.sceneLineMap.set(h,(E.sceneLineMap.get(h)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(y.type)||(f="",C+=N,s.length&&(s.at(-1).words+=N))});let P=[...o.values()].map(y=>({...y,seconds:Math.round(y.words/130*60),scenes:y.sceneSet.size,sceneLines:[...y.sceneLineMap].map(([b,N])=>({scene:b,lines:N})),sceneSet:void 0,sceneLineMap:void 0})).sort((y,b)=>b.words-y.words||y.name.localeCompare(b.name)),F=v+C,D=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:F,dialogueWords:v,actionWords:C,estimatedSeconds:D==null?0:D*60,characters:P,scenes:s,sections:l,locations:[...p].sort(),titleFields:d,pageCount:D,...a}}function _e(e,t=null){let n=e.raw.trim().match(/^>\s*(.*?)\s*<$/),a=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,o=n?"centered":e.type,s=`script-line ${o}${a?" act":""}`,l=a?.[1]||e.display,p=a?"#":e.prefix;if(n?l=n[1]:o==="transition"&&e.raw.trim().startsWith(">")&&(l=e.raw.trim().slice(1).trimStart()),t!==null){let u=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");l=_.sceneNumbers==="inline"?`${t}. ${u}`:u}let d=o==="note"?tt(e.raw):null,f=l?Ie(l):"<br>",h=t!==null?w(t):"";if(o==="note"&&!d){let u=nt(e.raw);return`<div class="script-line note annotation-line" data-line="${e.index}"><button class="annotation-orb" type="button" data-annotation-line="${e.index}" title="${w(u)}" aria-label="Edit annotation: ${w(u)}"></button></div>`}return o==="note"&&d?`<div class="script-line note managed-note" data-line="${e.index}"></div>`:`<div class="${s}" data-line="${e.index}" data-prefix="${w(p)}" data-scene-number="${h}" data-display="${w(l)}">${f}</div>`}function Gt(e){let t=new Map;if(_.sceneNumbers==="off")return t;let n=0,a=0,o=0,s=_.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(a++,o=0):l.type==="scene"&&(n++,o++,t.set(l.index,s==="act"?`A${Math.max(a,1)}S${o}`:String(n)));return t}function Yt(e){let t=Gt(e),n=[];for(let a=0;a<e.length;a+=1){if(e[a].type==="character"){let s=a+1;for(;s<e.length&&["dialogue","parenthetical","note"].includes(e[s].type);)s+=1;for(;s<e.length&&e[s].type==="empty";)s+=1;if(e[s]?.type==="character"&&e[s].raw.trim().endsWith("^")){let l=s+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(a,s).filter(f=>f.type!=="empty").map(f=>_e(f)).join(""),d=e.slice(s,l).map(f=>_e(f)).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${p}</div><div class="dual-right">${d}</div></div>`),a=l-1;continue}}let o=t.get(e[a].index)??null;n.push(_e(e[a],o))}return n.join("")}function se({focusLine:e=null,focusOffset:t=null}={}){let n=me(c.value),a=i("#preview-scroll"),o=i("#preview-page-stage"),s=a.scrollTop,l=a.scrollLeft;m.innerHTML=Yt(n),m.spellcheck=i("#spellcheck").checked;let p=n.some(d=>d.raw.trim());if(i("#empty-state").hidden=p,o.hidden=r.previewMode!=="live",m.hidden=r.previewMode!=="live",e!==null){let d=i(`[data-line="${e}"]`,m);if(m.focus({preventScroll:!0}),d){let f=t??d.textContent.length;J(d,f),B(d,f)}}a.scrollTop=s,a.scrollLeft=l,requestAnimationFrame(()=>{a.scrollTop=s,a.scrollLeft=l}),lt(),O()}function J(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),a=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),o=a.nextNode();for(;o&&n>o.textContent.length;)n-=o.textContent.length,o=a.nextNode();let s=document.createRange();o?s.setStart(o,n):(s.selectNodeContents(e),s.collapse(!1)),s.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(s)}function Kt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let d of e.matchAll(a)){let f=d[1].length;for(let h=d.index;h<d.index+f;h+=1)t[h]=!0;for(let h=d.index+d[0].length-f;h<d.index+d[0].length;h+=1)t[h]=!0,n[h]=!0}let o=t.flatMap((d,f)=>d?[]:[f]),s=Array.from({length:o.length+1},(d,f)=>f<o.length?o[f]:(o.at(-1)??-1)+1),l=Array.from({length:o.length+1},(d,f)=>f?o[f-1]+1:o[0]??0),p=Array.from({length:o.length+1},(d,f)=>{let h=f?o[f-1]+1:0,u=f<o.length?o[f]:e.length;for(;h<u&&n[h];)h+=1;return h});return{startMap:s,endMap:l,caretMap:p}}function Zt(e,t){let n=0,a=t.length,o=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",o)+1,t[n]===" "&&(n+=1);let s=t.lastIndexOf("<");a=s<n?a:s,t[a-1]===" "&&(a-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",o)+1;else if(e.classList.contains("character")&&t.slice(o).startsWith("@"))n=o+1;else if(e.classList.contains("transition")&&t.slice(o).startsWith(">"))for(n=o+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let s=t.indexOf(e.dataset.prefix,o);for(n=s<0?0:s+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let s=t.slice(n,a).match(/\s+#[^#]+#\s*$/);s&&(a=n+s.index)}return{start:n,end:a,map:Kt(t.slice(n,a))}}function W(e,t,n,a="caret"){let o=Zt(e,t),s=e.dataset.sceneNumber&&_.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-s,o.map.startMap.length-1)),p=a==="start"?o.map.startMap:a==="end"?o.map.endMap:o.map.caretMap;return o.start+(p[l]??o.end-o.start)}function qt(e,t){let n=[],a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let o of e.matchAll(a)){let s=o.index+o[1].length,l=o.index+o[0].length-o[1].length;t>=s&&t<=l&&n.push(o[1])}return n}function Ze(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let a=document.createRange();return a.selectNodeContents(e),a.setEnd(t,n),a.toString().length}function R(e=A(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),a=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,o=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,s=a?.closest?.(".script-line")||e,l=o?.closest?.(".script-line")||e;return{startLine:s,endLine:l,startOffset:Ze(s,n.startContainer,n.startOffset),endOffset:Ze(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function qe(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let a=R(e);if(!a||a.startLine!==a.endLine||a.startOffset!==a.endOffset)return!1;if(!e.textContent.length)return!0;let o=document.createRange();o.selectNodeContents(e);let s=[...o.getClientRects()],l=t==="first"?s[0]?.top:s.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let d=[...p.getClientRects()];return d.length?l!==void 0&&d.length>0&&d.every(f=>Math.abs(f.top-l)<1):t==="first"?a.startOffset===0:a.startOffset===e.textContent.length}function oe(e,t,n){return e.slice(0,t).reduce((a,o)=>a+o.length+1,0)+n}function B(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.dataset.line),o=W(e,n[a]||"",t),s=oe(n,a,o);c.setSelectionRange(s,s),Oe(a),M()}function it(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),a=Number(e.endLine.dataset.line),o=W(e.startLine,t[n]||"",e.startOffset,"start"),s=W(e.endLine,t[a]||"",e.endOffset,"end"),l=oe(t,n,o),p=oe(t,a,s);c.setSelectionRange(l,p,e.direction),Oe(e.direction==="backward"?n:a),M()}function ot(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=e.dataset.display??e.textContent,o=e.textContent.replace(/\n/g,""),s=0;for(;s<a.length&&s<o.length&&a[s]===o[s];)s+=1;let l=a.length,p=o.length;for(;l>s&&p>s&&a[l-1]===o[p-1];)l-=1,p-=1;let d=s===l,f=W(e,n[t],s,d?"caret":"start"),h=W(e,n[t],l,d?"caret":"end"),u=n[t].slice(0,f)+o.slice(s,p)+n[t].slice(h);n[t]=u,e.dataset.display=o,e.innerHTML=Ie(o)||"<br>",J(e,p),c.value=n.join(`
`);let g=oe(n,t,f+p-s);c.setSelectionRange(g,g),$({fromPreview:!0})}function U(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.startLine.dataset.line),o=Number(e.endLine.dataset.line),s=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),d=`${s}${p}${l}`.split(`
`),f=a===o&&e.startOffset===e.endOffset,h=W(e.startLine,n[a],e.startOffset,f?"caret":"start"),u=W(e.endLine,n[o],e.endOffset,f?"caret":"end"),g=n[o].slice(u),v=a===o?[]:n.slice(a+1,o).filter(b=>/^\s*\[\[.*\]\]\s*$/.test(b));if(a===o&&p.includes(`
`)){let b=qt(n[a],h);b.length&&(p=p.replaceAll(`
`,`${[...b].reverse().join("")}
${b.join("")}`))}let C=`${n[a].slice(0,h)}${p}${n[o].slice(u)}`.split(`
`);if(a===o&&e.startLine.classList.contains("centered")&&C.length>1){C[0]=`${C[0].trimEnd()} <`,C[C.length-1]=`> ${C.at(-1).trimStart()}`;for(let b=1;b<C.length-1;b+=1)C[b]=`> ${C[b]} <`}n.splice(a,o-a+1,...C,...v),c.value=n.join(`
`);let P=a+d.length-1,F=d.length===1?s.length+t.length:t.split(/\r\n?|\n/).at(-1).length,D=C.at(-1).length-g.length,y=oe(n,P,Math.max(0,D));c.setSelectionRange(y,y),$({fromPreview:!0}),a===o&&d.length===1?(e.startLine.innerHTML=Ie(d[0])||"<br>",e.startLine.dataset.display=d[0],m.focus({preventScroll:!0}),J(e.startLine,F),B(e.startLine,F),at(e.startLine)):se({focusLine:P,focusOffset:F})}function Xt(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return U(e,"");let a=e.startLine,o=Number(a.dataset.line),s=a.textContent;if(t==="backward"&&e.startOffset>0){let l=s.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<s.length){let l=s.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=j(".script-line[data-display]",m),p=l.indexOf(a),d=l[p+(t==="backward"?-1:1)];if(!d)return;t==="backward"?(e.startLine=d,e.startOffset=d.textContent.length):(e.endLine=d,e.endOffset=0)}U(e,"")}function G(){i("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function at(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),a=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(a)||n&&!/^[A-Z0-9 ._'-]*$/.test(a))return G();r.previewCompletionItems=r.metadata.characters.map(o=>o.name).filter((o,s,l)=>o.startsWith(a)&&o!==a&&l.indexOf(o)===s),r.previewCompletionIndex=0,r.previewCompletionLine=e,st()}function st(){let e=i("#preview-completion-menu");if(!r.previewCompletionItems.length)return G();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${w(t)}</span><small>Character</small></button>`).join(""),Jt()}function Jt(){let e=i("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=i(".preview-panel").getBoundingClientRect(),a=getSelection(),o=t.getBoundingClientRect();if(a?.rangeCount&&t.contains(a.focusNode)){let h=document.createRange();if(h.setStart(a.focusNode,a.focusOffset),h.collapse(!0),o=h.getClientRects()[0]||h.getBoundingClientRect(),!o.width&&!o.height){let u=document.createRange();u.selectNodeContents(t),u.setEnd(a.focusNode,a.focusOffset);let g=u.getBoundingClientRect(),v=t.getBoundingClientRect();o={left:g.right,right:g.right,top:v.top,bottom:v.bottom,width:0,height:v.height}}}let s=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-s-8,o.left)),p=Math.min(e.scrollHeight,245),d=o.bottom+6,f=d+p<=n.bottom-8?d:Math.max(n.top+8,o.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function rt(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,ot(n),G(),m.focus({preventScroll:!0}),J(n,n.textContent.length))}function re(){en(),ge(),Vt(),M()}function Vt(){let e=i("#line-numbers"),t=i("#source-highlight"),n=t.getBoundingClientRect(),a=c.value.split(`
`).map((s,l)=>{let d=i(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=d?d.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),o=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${a}<span class="line-number-spacer" style="height:${o}px"></span>`,e.scrollTop=c.scrollTop}function Qt(e){return w(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function en(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=me(c.value);i("#source-highlight").innerHTML=t.map((n,a)=>{let o=e[n.type],s=Qt(n.raw)||" ",l=a<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${o?` class="syntax-${o}"`:""}>${s}${l}</span>`}).join("")}function fe(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function ge(){let e=i("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=fe(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=fe(e,t)}function V(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function tn(e,t="nearest"){let n=i("#preview-scroll"),a=e.getBoundingClientRect(),o=n.getBoundingClientRect(),s=n.scrollTop,l=n.scrollLeft;t==="center"?s+=a.top-o.top-(n.clientHeight-a.height)/2:a.top<o.top?s+=a.top-o.top:a.bottom>o.bottom&&(s+=a.bottom-o.bottom),a.left<o.left?l+=a.left-o.left:a.right>o.right&&(l+=a.right-o.right),n.scrollTop=Math.max(0,s),n.scrollLeft=fe(n,l)}function Oe(e,t="nearest"){if(!c.clientHeight)return;let n=i("#source-highlight"),o=i(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!o)return;let s=getComputedStyle(c),l=parseFloat(s.paddingTop)||0,p=parseFloat(s.paddingBottom)||0,d=parseFloat(s.lineHeight)||20.15,f=o.top-n.getBoundingClientRect().top+n.scrollTop,h=f+d,u=c.scrollTop;t==="center"?u=f-(c.clientHeight-d)/2:f<c.scrollTop+l?u=f-l:h>c.scrollTop+c.clientHeight-p&&(u=h-c.clientHeight+p),c.scrollTop=Math.max(0,u),ge(),i("#line-numbers").scrollTop=c.scrollTop}function lt(e=!1,t="nearest"){let n=i(`[data-line="${V().line}"]`,m);j(".script-line.source-current",m).forEach(a=>a.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&tn(n,t)}function M({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=V();i("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let a=me(c.value)[n.line]?.type||"action",o={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};i("#editor-status").textContent=o[a]||a[0].toUpperCase()+a.slice(1);let s=getComputedStyle(c),l=parseFloat(s.lineHeight)||20.15,p=i(`[data-source-line="${n.line}"]`,i("#source-highlight")),d=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(s.paddingTop):-c.scrollTop;i("#current-line").style.height=`${l}px`,i("#current-line").style.transform=`translateY(${d}px)`,lt(e,t)}function ct(e){r.metadata=e,i("#stat-pages").textContent=e.pageCount??"\u2014",i("#stat-scenes").textContent=e.scenes.length,i("#stat-words").textContent=e.wordCount.toLocaleString(),i("#scene-count").textContent=e.scenes.length,i("#character-count").textContent=e.characters.length,i("#scene-list").innerHTML=an(e),nn(),on();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;i("#dialogue-bar").style.width=`${n}%`,i("#dialogue-percent").textContent=`${n}%`,i("#action-percent").textContent=`${100-n}%`,i("#character-analytics-dialog").open&&Pe()}function nn(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};i("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let a=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${w(n.name)}">${w(n.name)}${a?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function on(){let e=r.metadata.generalNotes||[];i("#general-note-count").textContent=e.length,i("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${w(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function Ne(e,t=e.number){return`<li><span class="scene-num">${w(t)}</span><button type="button" data-line="${e.line}">${w(e.heading)}</button></li>`}function an(e){let t=e.scenes||[],n=(e.sections||[]).filter(s=>s.level===1);if(!n.length)return t.length?t.map(s=>Ne(s)).join(""):'<li class="empty-list">No scene headings yet.</li>';let a=t.filter(s=>!s.actNumber).map(s=>Ne(s)).join(""),o=n.map((s,l)=>{let p=l+1,d=t.filter(f=>f.actNumber===p).map((f,h)=>Ne(f,String(h+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${s.line}"><span>${l+1}</span>${w(s.title)}</button><ol>${d||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return a+o}function Z(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function de(e,t,n){let a=String(t);if(e.measureText(a).width<=n)return a;let o=a;for(;o.length&&e.measureText(`${o}\u2026`).width>n;)o=o.slice(0,-1);return o?`${o}\u2026`:""}function Pe(){let e=i("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,a=Math.min(window.devicePixelRatio||1,2),o=150,s=92,l=28,p=54,d=34,f=Math.max(720,o+n.length*s+18),h=l+p+Math.max(t.length,1)*d+18;e.width=Math.ceil(f*a),e.height=Math.ceil(h*a),e.style.width=`${f}px`,e.style.height=`${h}px`;let u=e.getContext("2d");u.scale(a,a);let g=Z("--surface","#fff"),v=Z("--surface-2","#f2f2f2"),C=Z("--ink","#202124"),P=Z("--muted","#6b7280"),F=Z("--border","#d7d9dd"),D=Z("--syntax-character","#7c3aed"),y=t.flatMap(L=>(L.sceneLines||[]).map(S=>S.lines)).filter(L=>L>0),b=y.length?Math.min(...y):0,N=y.length?Math.max(...y):0,E=i("#character-analytics-legend");E.hidden=!y.length,i("#character-analytics-min").textContent=`${b} ${b===1?"line":"lines"}`,i("#character-analytics-max").textContent=`${N} ${N===1?"line":"lines"}`,u.fillStyle=g,u.fillRect(0,0,f,h),u.strokeStyle=F,u.lineWidth=1,u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.textBaseline="middle";let H=0;for(;H<n.length;){let L=n[H].act||"Screenplay",S=H+1;for(;S<n.length&&(n[S].act||"Screenplay")===L;)S+=1;let T=o+H*s,K=(S-H)*s;u.fillStyle=v,u.fillRect(T,0,K,l),u.fillStyle=C,u.textAlign="center",u.fillText(de(u,L,K-12),T+K/2,l/2),u.strokeRect(T+.5,.5,K,l),H=S}u.fillStyle=v,u.fillRect(0,0,o,l+p),u.fillStyle=P,u.textAlign="left",u.fillText("CHARACTER",12,l+p/2);let ne=new Map,Pt=n.map((L,S)=>{if(!L.actNumber)return String(S+1);let T=(ne.get(L.actNumber)||0)+1;return ne.set(L.actNumber,T),String(T)});n.forEach((L,S)=>{let T=o+S*s;u.strokeStyle=F,u.strokeRect(T+.5,l+.5,s,p),u.fillStyle=C,u.textAlign="center",u.fillText(de(u,Pt[S],s-10),T+s/2,l+16),u.fillStyle=P,u.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.fillText(de(u,L.heading,s-10),T+s/2,l+36),u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((L,S)=>{let T=l+p+S*d;S%2===1&&(u.fillStyle=v,u.fillRect(0,T,o+n.length*s,d)),u.fillStyle=C,u.textAlign="left",u.fillText(de(u,L.name,o-20),12,T+d/2);let K=new Map((L.sceneLines||[]).map(Le=>[Le.scene,Le.lines]));n.forEach((Le,je)=>{let Se=K.get(je+1)||0;if(!Se)return;let Ge=o+je*s+4,Ye=N===b?1:.25+.75*((Se-b)/(N-b));u.save(),u.globalAlpha=Ye,u.fillStyle=D,u.fillRect(Ge,T+7,s-8,d-14),u.restore(),u.fillStyle=Ye>=.6?"#fff":C,u.textAlign="center",u.fillText(String(Se),Ge+(s-8)/2,T+d/2)})}),n.length||(u.fillStyle=P,u.textAlign="center",u.fillText("Add scene headings to build the timeline.",f/2,l+p+d/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${b} to ${N} dialogue lines`)}function sn(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function rn(){Pe(),i("#character-analytics-dialog").showModal()}async function ln(){try{await navigator.clipboard.writeText(sn()),x("Line usage CSV copied")}catch{x("Clipboard access was denied")}}async function cn(){Pe();let e=await new Promise(t=>i("#character-analytics-chart").toBlob(t,"image/png"));if(!e){x("Could not create analytics image");return}await We(e,ae("character-analytics.png")),x("Character analytics PNG saved")}function un(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function ut(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=m.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],$({fromPreview:t!==null,record:!1}),t!==null?se({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function dt(){ut(r.historyIndex-1)}function Ae(){ut(r.historyIndex+1)}function $({fromPreview:e=!1,record:t=!0}={}){t&&un(),document.body.classList.toggle("dirty",c.value!==r.savedSource),re(),e||se(),ct(jt(c.value)),Fe(),I()}function Fe(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;i("#compile-status").textContent="Editing\u2026",i("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>q?ft(t):dn(t),q?Math.max(e,700):e)}function pt(e,t=q){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),a=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;i("#compile-status").textContent=a,i("#compile-status").title=a,i("#compile-status").classList.add("error")}async function ft(e){i("#compile-status").textContent="Compiling\u2026";try{let t=await Lt("pdf",i("#page-size").value),n=await ht(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,i("#stat-pages").textContent=n,i("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;pt(t,!0)}}async function dn(e){let t=new AbortController;r.compileController=t,i("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:i("#page-size").value,sceneNumbers:_.sceneNumbers,sceneNumberFormat:_.sceneNumberFormat}),signal:t.signal});if(St(n,"application/json")){q=!0,await ft(e);return}let a=await n.json();if(!n.ok)throw new Error(a.error||"Compilation failed");if(a.pageCount==null&&(a.pageCount=await ht(await he("/api/render/pdf"))),a.estimatedSeconds=a.pageCount*60,e!==r.compileRevision)return;ct(a),i("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;pt(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function ht(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function pn(){let{line:e,start:t}=V(),n=c.value.split(`
`),o=n[e].slice(0,c.selectionStart-t).trim(),s=o.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],d=(u,g,v="\u0192")=>p.push({value:u,detail:g,icon:v}),f=(s?o.slice(1):o.split(/\s+/).at(-1)).toUpperCase();(s||f&&r.metadata.characters.some(u=>u.name.startsWith(f)))&&r.metadata.characters.forEach(u=>d(u.name,`${u.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!o||/^[A-Za-z ]*$/.test(o))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(u=>!r.metadata.titleFields.some(g=>`${g}:`.toLowerCase()===u.trim().toLowerCase())).forEach(u=>d(u,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(o)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(u=>d(u,"Time of day","\u25F7")):Re(o)||/^(?:INT|EXT|EST|I\/E)/i.test(o)?r.metadata.locations.forEach(u=>d(u,"Existing location","\u2302")):l&&(s||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(u=>d(u,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(u=>d(u,"Transition","\u2192"))));let h=(s?o.slice(1):o).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((u,g)=>p.findIndex(v=>v.value===u.value)===g&&(u.icon!=="@"||u.value.toUpperCase()!==f)&&(!h||u.value.toUpperCase().startsWith(h)||u.detail==="Existing location"))}function mt({allowBlank:e=!1}={}){let{line:t,start:n}=V(),a=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!a||(r.completionItems=pn(),r.completionIndex=0,!r.completionItems.length))return z();gt()}function gt(){let e=i("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${w(t.icon)}</span><span>${w(t.value)}</span><small>${w(t.detail)}</small></button>`).join(""),fn(),i(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function z(){i("#completion-menu").hidden=!0,r.completionItems=[]}function fn(){let e=i("#completion-menu"),t=c.getBoundingClientRect(),n=i("#source-panel").getBoundingClientRect(),a=getComputedStyle(c),o=document.createElement("div"),s=document.body.classList.contains("source-wrap"),l=fe(c);Object.assign(o.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:a.boxSizing,left:`${t.left-(s?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${s?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:a.padding,border:a.border,font:a.font,letterSpacing:a.letterSpacing,lineHeight:a.lineHeight,whiteSpace:s?"pre-wrap":"pre",overflowWrap:s?"anywhere":"normal",tabSize:a.tabSize}),o.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",o.append(p),document.body.append(o);let d=p.getBoundingClientRect();o.remove();let f=Math.min(310,n.width-16),h=Math.max(n.left+8,Math.min(n.right-f-8,d.left)),u=Math.min(e.scrollHeight,245),g=d.bottom+5,v=g+u<=n.bottom-8?g:Math.max(n.top+8,d.top-u-5);e.style.left=`${h}px`,e.style.top=`${v}px`,e.style.right="auto",e.style.bottom="auto"}function yt(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=V(),o=c.value.slice(0,c.selectionStart).slice(n.start),s=n.start;if(t.icon==="@"){let p=o.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";s=c.selectionStart-p.length}else/\s-\s/.test(o)?s=n.start+o.lastIndexOf("-")+2:o.trim()&&(s=n.start+o.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,s,c.selectionStart,"end"),z(),$()}async function wt(){await He()&&(r.handle=null,Q("","Untitled.fountain",!0),c.focus())}async function He(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function bt(){if(await He()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();Q(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&x(e.message);return}i("#file-input").click()}}function Q(e,t,n=!1,a=null){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),r.githubFile=a,i("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,$()}async function De(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:ae("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await We(new Blob([c.value],{type:"text/plain;charset=utf-8"}),ae("fountain"));r.savedSource=c.value,Q(c.value,r.filename,!0),x(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&x(t.message)}}async function Y(e,t={}){let n=await fetch(`${Me}${e}`,{credentials:"include",...t}),a=await n.json().catch(()=>({}));if(!n.ok)throw new Error(a.error||`GitHub request failed (${n.status})`);return a}function vt(){i("#github-connect").textContent=r.githubConnected?"GitHub browser\u2026":"Connect GitHub\u2026",i("#github-open").disabled=!r.githubConnected,i("#github-save").disabled=!r.githubConnected}async function Be({notify:e=!1}={}){try{let t=await Y("/api/session");r.githubConnected=!0,r.githubInstallUrl=t.installUrl,i("#github-account").textContent=`Connected as ${t.login}`,e&&x(`Connected to GitHub as ${t.login}`)}catch{r.githubConnected=!1,r.githubInstallUrl="",i("#github-account").textContent="Not connected"}return vt(),r.githubConnected}function Ct(e){let t=window.open(e,"fountain-publisher-github","popup,width=600,height=760");return t||x("Allow popups to connect GitHub"),t}async function xt(){if(r.githubConnected)return be();Ct(`${Me}/auth/github/start`)}function ye(){let e=i("#github-repository").selectedOptions[0];if(!e?.value)return null;let[t,n]=e.value.split("/");return{owner:t,repo:n,fullName:e.value,defaultBranch:e.dataset.defaultBranch}}function Ue(e=r.githubPath){let t=ye(),n=i("#github-branch").value;return t?`/api/contents?${new URLSearchParams({owner:t.owner,repo:t.repo,branch:n,path:e})}`:""}function hn(){let e=r.githubPath?r.githubPath.split("/"):[],t=['<button type="button" data-github-path="">Root</button>'];e.forEach((n,a)=>{t.push("<span>/</span>",`<button type="button" data-github-path="${w(e.slice(0,a+1).join("/"))}">${w(n)}</button>`)}),i("#github-breadcrumbs").innerHTML=t.join("")}async function we(e=""){r.githubPath=e,hn();let t=i("#github-files");t.innerHTML='<div class="github-empty">Loading repository\u2026</div>';try{let n=await Y(Ue(e)),a=(Array.isArray(n)?n:[n]).filter(o=>o.type==="dir"||/\.(fountain|txt)$/i.test(o.name)).sort((o,s)=>o.type===s.type?o.name.localeCompare(s.name):o.type==="dir"?-1:1);t.innerHTML=a.length?a.map(o=>`<button type="button" role="listitem" data-github-entry="${w(o.path)}" data-github-type="${o.type}"><span>${o.type==="dir"?"\u25B8":"F"}</span><span>${w(o.name)}</span><small>${o.type==="dir"?"Folder":"Fountain"}</small></button>`).join(""):'<div class="github-empty">No Fountain files in this folder.</div>'}catch(n){t.innerHTML=`<div class="github-empty">${w(n.message)}</div>`}}async function Et(){let e=ye();if(!e)return;let t=await Y(`/api/branches?${new URLSearchParams({owner:e.owner,repo:e.repo})}`);i("#github-branch").innerHTML=t.branches.map(n=>`<option value="${w(n)}"${n===e.defaultBranch?" selected":""}>${w(n)}</option>`).join(""),await we("")}async function mn(){let e=await Y("/api/repositories");if(r.githubInstallUrl=e.installUrl,i("#github-install").hidden=!1,i("#github-repository").innerHTML=e.repositories.map(t=>`<option value="${w(t.fullName)}" data-default-branch="${w(t.defaultBranch)}">${w(t.fullName)}${t.private?" \xB7 Private":""}</option>`).join(""),!e.repositories.length){i("#github-files").innerHTML='<div class="github-empty">Install Fountain Publisher on at least one repository to browse files.</div>',i("#github-branch").innerHTML="";return}await Et()}async function be(){if(!r.githubConnected&&!await Be())return xt();ze(),i("#github-filename").value=ae("fountain"),i("#github-dialog").showModal();try{await mn()}catch(e){x(e.message)}}function gn(e){let t=atob(e.replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(t,n=>n.charCodeAt(0)))}async function yn(e){if(await He())try{let t=ye(),n=i("#github-branch").value,a=await Y(Ue(e)),o={owner:t.owner,repo:t.repo,branch:n,path:e,sha:a.sha};r.handle=null,Q(gn(a.content),a.name,!0,o),i("#github-dialog").close(),x(`Opened ${t.fullName}/${e}`)}catch(t){x(t.message)}}async function wn(){let e=ye(),t=i("#github-branch").value,n=i("#github-filename").value.trim(),a=i("#github-commit-message").value.trim();if(!e||!t||!/^[^/]+\.(fountain|txt)$/i.test(n))return x("Enter a .fountain file name");let o=[r.githubPath,n].filter(Boolean).join("/"),s=r.githubFile,l=s&&s.owner===e.owner&&s.repo===e.repo&&s.branch===t&&s.path===o?s.sha:void 0;try{let p=await Y(Ue(o),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({content:c.value,message:a||`Update ${n}`,sha:l})});r.githubFile={owner:e.owner,repo:e.repo,branch:t,path:o,sha:p.sha},r.filename=n,r.savedSource=c.value,i("#filename").textContent=n,document.title=`${n} \u2014 Fountain Publisher`,document.body.classList.remove("dirty"),i("#github-dialog").close(),x(`Committed ${e.fullName}/${o}`)}catch(p){x(p.message)}}function ae(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function We(e,t){let n=URL.createObjectURL(e),a=document.createElement("a");a.href=n,a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function bn(e,t){let a={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(a)){await navigator.share(a);return}await We(e,t)}var pe;async function vn(){return pe||(pe=(async()=>{i("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let a=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(a.map(async o=>{let s=await fetch(new URL(`fonts/${o}`,import.meta.url));if(!s.ok)throw new Error(`Unable to load PDF font ${o}`);n.FS.writeFile(`/fonts/${o}`,new Uint8Array(await s.arrayBuffer()))})),await n.runPythonAsync(`
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
`),i("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw pe=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),pe}async function Lt(e,t){let n=await vn();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",_.sceneNumbers),n.globals.set("_fp_scene_number_format",_.sceneNumberFormat);let a=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),o=a instanceof Uint8Array?a:a.toJs();a.destroy?.();let s={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([o],{type:s[e]})}function St(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function Xe(e,t){return Lt(e==="/api/render/pdf"?"pdf":"fdx",t)}async function he(e,t=i("#page-size").value){if(q)return Xe(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:_.sceneNumbers,sceneNumberFormat:_.sceneNumberFormat})});if(St(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return q=!0,Xe(e,t);if(!n.ok){let o=await n.json().catch(()=>({}));throw new Error(o.error||"Export failed")}return n.blob()}async function Cn(e){i("#confirm-export").disabled=!0;try{let t=e==="pdf"?await he("/api/render/pdf",i("#export-page-size").value):await he("/api/export/fdx");await bn(t,ae(e)),i("#export-dialog").close(),x(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&x(t.message)}finally{i("#confirm-export").disabled=!1}}function Tt(e){i("#export-format").value=e,i("#export-page-size").value=i("#page-size").value,i("#dialog-page-size").hidden=e!=="pdf",i("#export-dialog").showModal()}function le(){return matchMedia("(max-width: 640px)").matches}async function ve(e){le()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),j("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=i(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),i("#preview-page-stage").hidden=e!=="live",m.hidden=e!=="live",i("#empty-state").hidden=e!=="live"||!!c.value.trim(),i("#pdf-view").hidden=e!=="pdf",i("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),I(),e==="pdf"&&await Ce()}async function Ce(){i("#pdf-placeholder").hidden=!1,i("#pdf-frame").hidden=!0;try{let e=await he("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),i("#pdf-frame").src=r.pdfUrl,i("#pdf-frame").hidden=!1,i("#pdf-placeholder").hidden=!0}catch(e){i("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${w(e.message)}</span>`}}function _t(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,i("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),i("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function xn(){let e=document.documentElement.dataset.effectiveTheme||"light";_t(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),i(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),i(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(O)}function Je(e,t,n,a,o){let s=0,l=0,p=d=>{let f=Math.max(a,Math.min(o,d));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&re(),r.previewZoom==="fit"&&requestAnimationFrame(O)};e.addEventListener("pointerdown",d=>{s=d.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(d.pointerId)}),e.addEventListener("pointermove",d=>{e.hasPointerCapture(d.pointerId)&&p(l+(d.clientX-s)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",d=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(d.key))return;d.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));d.key==="Home"?p(a):d.key==="End"?p(o):p(f+(d.key==="ArrowRight"?1:-1)*n*(d.shiftKey?30:10))})}function O(){let e=r.previewZoom;if(i("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),le()){let o=e==="fit"?1:Number(e)/100;m.style.transform="none",m.style.marginBottom="0",m.style.marginRight="0",i("#preview-page-stage").style.removeProperty("width"),i("#preview-page-stage").style.removeProperty("min-height"),m.style.setProperty("--mobile-preview-zoom",o),I();return}m.style.removeProperty("--mobile-preview-zoom");let t=Number(e)/100;if(e==="fit"){let o=i("#preview-scroll"),s=getComputedStyle(o),l=o.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);t=Math.max(.25,l/816)}let n=i("#preview-page-stage");n.style.width=`${816*t}px`,n.style.minHeight=`${1056*t}px`,m.style.transform=`scale(${t})`,m.style.marginBottom="0",m.style.marginRight="0";let a=i("#preview-scroll");requestAnimationFrame(()=>{a.scrollLeft=Math.max(0,(a.scrollWidth-a.clientWidth)/2)}),I()}function Nt(e){let t=["70","85","100","115","130"],n=i("#zoom");if(r.previewZoom==="fit"){n.value="100",r.previewZoom="100",O();return}let a=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,a+e))],r.previewZoom=n.value,O()}function At(e,t=!0){let n=c.value.split(`
`),a=0;for(let d=0;d<Math.max(0,e-1);d+=1)a+=n[d].length+1;t&&c.focus(),c.setSelectionRange(a,a+(n[e-1]?.length||0)),M({scrollPreview:!0,scrollBlock:"center"});let o=i("#source-highlight"),l=i(`[data-source-line="${Math.max(0,e-1)}"]`,o)?.getClientRects()[0],p=l?l.top-o.getBoundingClientRect().top+o.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),i("#line-numbers").scrollTop=c.scrollTop,i("#source-highlight").scrollTop=c.scrollTop,M({scrollPreview:!0,scrollBlock:"center"})}function En(e){r.insightLine=e,At(e,!1)}var Ve;function x(e){let t=i("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(Ve),Ve=setTimeout(()=>t.classList.remove("show"),2200)}function ee(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function ce(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),$()}function $t(e){let t=ee();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),ce(t)}function Ln(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function Sn(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function kt(e=null,t=null){let n=e===null?"":nt(ee()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},i("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",i("#annotation-text").value=n,i("#delete-annotation").hidden=e===null,i("#annotation-dialog").showModal(),setTimeout(()=>i("#annotation-text").focus(),0)}function te(){let e=i("#preview-context-menu");e.hidden=!0,r.previewContextLine=null,r.previewContextEdit=null,r.previewContextText=""}function A(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function ie(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return m.contains(t.commonAncestorContainer)?e:null}function Tn(e,t,n){let a=(l,p)=>{let d=document.createRange();return d.selectNodeContents(e),d.setEnd(l,p),d.toString().length},o=document.caretPositionFromPoint?.(t,n);if(o&&e.contains(o.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(o.offsetNode,o.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),m.focus({preventScroll:!0}),B(e,a(o.offsetNode,o.offset));return}let s=document.caretRangeFromPoint?.(t,n);if(s&&e.contains(s.startContainer)){let l=getSelection();s.collapse(!0),l?.removeAllRanges(),l?.addRange(s),m.focus({preventScroll:!0}),B(e,a(s.startContainer,s.startOffset));return}m.focus({preventScroll:!0}),J(e,e.textContent.length),B(e)}function _n(e,t,n){let a=i("#preview-context-menu"),o=ie();r.previewContextLine=Number(e.dataset.line),r.previewContextEdit=R(A(o?.focusNode)||e),r.previewContextText=o?.toString()||"",a.hidden=!1,a.style.left="0px",a.style.top="0px";let{width:s,height:l}=a.getBoundingClientRect();a.style.left=`${Math.max(8,Math.min(window.innerWidth-s-8,t))}px`;let p=n;if(le()&&r.previewContextText&&o.rangeCount){let d=o.getRangeAt(0).getBoundingClientRect(),f=d.bottom+12,h=d.top-l-12;p=f+l<=window.innerHeight-8?f:h}a.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,p))}px`}async function Nn(e,t,n={}){let a=Number.isInteger(t)?i(`[data-line="${t}"]`,m):null;if(e==="copy"){let o=ie(),s=n.text||o?.toString()||"";if(!s)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(s),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let o=ie(),s=n.text||o?.toString()||"";if(!s)return"Select text to cut";let l=n.edit||R(A(o?.focusNode)||a);if(!l)return"Select text to cut";try{return await navigator.clipboard.writeText(s),U(l,""),""}catch{try{return document.execCommand("copy")?(U(l,""),""):"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}if(e==="paste"){let o=n.edit||R(a||A(ie()?.focusNode));if(!o)return"Click where you want to paste";try{return U(o,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function An(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},i("#character-note-heading").textContent=`${e} notes`,i("#character-note-text").value=t?.text||"",i("#delete-character-note").hidden=!t,i("#character-note-dialog").showModal(),setTimeout(()=>i("#character-note-text").focus(),0)}function Mt(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},i("#general-note-heading").textContent=t?"Edit general note":"Add general note",i("#general-note-text").value=t?.text||"",i("#delete-general-note").hidden=!t,i("#general-note-dialog").showModal(),setTimeout(()=>i("#general-note-text").focus(),0)}function xe(e){if(e==null)return;let t=ee();t.splice(e,1),ce(t)}var Ee=j(".toolbar-menu");function ze(e=null){Ee.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{$(),e.inputType==="insertText"?mt():z()});c.addEventListener("scroll",()=>{i("#line-numbers").scrollTop=c.scrollTop,ge(),M(),I()});c.addEventListener("click",()=>{M({scrollPreview:!0}),z(),I()});c.addEventListener("select",()=>{M({scrollPreview:!0}),I()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||M({scrollPreview:!0}),I()});c.addEventListener("keydown",e=>{if(!i("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,gt();return}if(e.key==="Tab"){e.preventDefault(),yt();return}if(e.key==="Escape"){e.preventDefault(),z();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),mt({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),$()):e.key==="Enter"&&z()});m.addEventListener("beforeinput",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);if(!n)return;let a=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),o=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!a.has(e.inputType)&&!o.has(e.inputType)))if(e.preventDefault(),G(),o.has(e.inputType)){let s=e.inputType.includes("Forward");Xt(n,s?"forward":"backward",e.inputType.includes("Word"))}else{let s=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";U(n,s)}});m.addEventListener("input",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(ot(t),at(t))});m.addEventListener("paste",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);n&&(e.preventDefault(),U(n,e.clipboardData?.getData("text/plain")||""))});m.addEventListener("keydown",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!i("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,st();return}if(e.key==="Tab"){e.preventDefault(),rt();return}if(e.key==="Escape"){e.preventDefault(),G();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,a=n===-1?qe(t,"first"):n===1&&qe(t,"last");if(n&&a){let o=R(t),s=i(`[data-line="${Number(t.dataset.line)+n}"]`,m);if(o&&o.startLine===o.endLine&&o.startOffset===o.endOffset&&s){e.preventDefault();let l=Math.min(o.startOffset,s.textContent.length);m.focus({preventScroll:!0}),J(s,l),B(s,l)}}});m.addEventListener("focusin",()=>{let e=A(getSelection()?.focusNode);e&&B(e)});m.addEventListener("pointerup",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&it(n)});m.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&it(n)});m.addEventListener("focusout",()=>setTimeout(()=>{i("#preview-completion-menu").matches(":hover")||G()},0));m.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),G();let n=ie();(!n||n.isCollapsed)&&Tn(t,e.clientX,e.clientY),_n(t,e.clientX,e.clientY)});m.addEventListener("click",e=>{te();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),kt(Number(t.dataset.annotationLine)))});i("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n,previewContextEdit:a,previewContextText:o}=r,s=t.dataset.previewMenuAction;if(te(),s==="annotation")return kt(null,n);let l=await Nn(s,n,{edit:a,text:o});l&&x(l)});i("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),rt(Number(t.dataset.index)))});i("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),yt(Number(t.dataset.index)))});i("[data-character-analytics]").addEventListener("click",rn);i("#close-character-analytics").addEventListener("click",()=>i("#character-analytics-dialog").close());i("#copy-character-lines").addEventListener("click",ln);i("#save-character-analytics").addEventListener("click",cn);i("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&En(Number(t.dataset.line))});i("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&An(t.dataset.characterNote)});i("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&Mt(Number(t.dataset.generalNoteLine))});i("#add-general-note").addEventListener("click",()=>Mt());i("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=ee();r.noteEditor.line===null?n.splice(r.noteEditor.insertAfter+1,0,`[[${t}]]`):n[r.noteEditor.line]=`[[${t}]]`,ce(n),i("#annotation-dialog").close()});i("#delete-annotation").addEventListener("click",()=>{xe(r.noteEditor?.line),i("#annotation-dialog").close()});i("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#character-note-text").value.trim();if(!t){xe(r.noteEditor.line),i("#character-note-dialog").close();return}let n=Sn(r.noteEditor.name,t);if(r.noteEditor.line===null)$t(n);else{let a=ee();a[r.noteEditor.line]=n,ce(a)}i("#character-note-dialog").close()});i("#delete-character-note").addEventListener("click",()=>{xe(r.noteEditor?.line),i("#character-note-dialog").close()});i("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=i("#general-note-text").value.trim();if(!t)return;let n=Ln(t);if(r.noteEditor.line===null)$t(n);else{let a=ee();a[r.noteEditor.line]=n,ce(a)}i("#general-note-dialog").close()});i("#delete-general-note").addEventListener("click",()=>{xe(r.noteEditor?.line),i("#general-note-dialog").close()});i("#new-file").addEventListener("click",wt);i("#open-file").addEventListener("click",bt);i("#save-file").addEventListener("click",()=>De(!1));i("#save-file-as").addEventListener("click",()=>De(!0));i("#github-connect").addEventListener("click",xt);i("#github-open").addEventListener("click",be);i("#github-save").addEventListener("click",be);i("#close-github-dialog").addEventListener("click",()=>i("#github-dialog").close());i("#github-install").addEventListener("click",()=>{r.githubInstallUrl&&Ct(r.githubInstallUrl)});i("#github-disconnect").addEventListener("click",async()=>{try{await Y("/auth/logout",{method:"POST"})}catch{}r.githubConnected=!1,r.githubFile=null,vt(),i("#github-dialog").close(),x("Disconnected from GitHub")});i("#github-repository").addEventListener("change",()=>Et().catch(e=>x(e.message)));i("#github-branch").addEventListener("change",()=>we("").catch(e=>x(e.message)));i("#github-breadcrumbs").addEventListener("click",e=>{let t=e.target.closest("[data-github-path]");t&&we(t.dataset.githubPath)});i("#github-files").addEventListener("click",e=>{let t=e.target.closest("[data-github-entry]");t&&(t.dataset.githubType==="dir"?we(t.dataset.githubEntry):yn(t.dataset.githubEntry))});i("#github-save-here").addEventListener("click",wn);window.addEventListener("message",async e=>{if(!(e.origin!==Me||!["github-connected","github-installed","github-error"].includes(e.data?.type))){if(e.data.type==="github-error")return x(e.data.message||"GitHub connection failed");await Be({notify:!0})&&await be()}});i("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,Q(await t.text(),t.name,!0)),e.target.value=""});i("#export-pdf").addEventListener("click",()=>Tt("pdf"));i("#export-fdx").addEventListener("click",()=>Tt("fdx"));i("#export-format").addEventListener("change",e=>{i("#dialog-page-size").hidden=e.target.value!=="pdf"});i("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),Cn(i("#export-format").value))});i("#theme").addEventListener("click",xn);i("#spellcheck").addEventListener("change",()=>{let e=i("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),i("#spellcheck-help").hidden=!e,se(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});i("#word-wrap").addEventListener("change",()=>{let e=i("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),re()});i("#page-size").addEventListener("change",()=>{Fe(0),r.previewMode==="pdf"&&Ce()});j("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ve(e.dataset.previewMode)));i("#toggle-source").addEventListener("click",()=>X("source"));i("#menu-toggle-source").addEventListener("click",()=>X("source"));i("#toggle-stats").addEventListener("click",()=>X("stats"));i("#menu-toggle-stats").addEventListener("click",()=>X("stats"));i("#undo").addEventListener("click",dt);i("#redo").addEventListener("click",Ae);i("#zoom").addEventListener("change",()=>{r.previewZoom=i("#zoom").value,O()});i("#zoom-out").addEventListener("click",()=>Nt(-1));i("#zoom-in").addEventListener("click",()=>Nt(1));i("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",O()});i("#open-docs").addEventListener("click",()=>i("#docs-dialog").showModal());i("#close-docs").addEventListener("click",()=>i("#docs-dialog").close());function $n(e){let t=c.value;c.value=e+(t?`
`+t:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function k(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,$(),c.focus()}function kn(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),a=!1,o=null;for(let s of n){let l=s.trim();if(!l){if(a)break;continue}let p=s.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&ke.has(p[1].trim().toLowerCase()))o=p[1].trim().toLowerCase(),t[o]=p[2].trim(),a=!0;else if(a&&o&&/^\s+/.test(s))t[o]=(t[o]?t[o]+" ":"")+l;else break}return t}function Mn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,a=0;for(let o of t){if(!o.trim()){if(n){a+=1;break}a+=1;continue}let l=o.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&ke.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(o))n=!0,a+=1;else break}return a}i("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(a,o)=>{let s=i(`#${a}`).value.trim();s&&t.push(`${o}: ${s}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let a=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let o=c.value,s=Mn(o),l=o.replace(/\r\n?/g,`
`).split(`
`).slice(s).join(`
`);c.value=a+(l?`
`+l:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else $n(a)}i("#title-page-dialog").close()});function It(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(i("#tp-heading").textContent=t,i("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=kn(c.value),a=o=>n[o]??"";i("#tp-title").value=a("title"),i("#tp-credit").value=a("credit"),i("#tp-author").value=a("author")||a("authors"),i("#tp-date").value=a("draft date")||a("date"),i("#tp-contact").value=a("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});i("#tp-title").value="",i("#tp-credit").value="Written by",i("#tp-author").value="",i("#tp-date").value=n,i("#tp-contact").value=""}i("#title-page-dialog").showModal(),setTimeout(()=>i("#tp-title").focus(),0)}i("#insert-title-page").addEventListener("click",It);i("#insert-scene").addEventListener("click",()=>{k(`INT. LOCATION - DAY

`)});i("#insert-dialogue").addEventListener("click",()=>{k(`CHARACTER
Dialogue here.

`)});i("#insert-direction").addEventListener("click",()=>{k(`Action description.

`)});i("#insert-pagebreak").addEventListener("click",()=>{k(`===

`)});i("#menu-insert-title-page").addEventListener("click",It);i("#menu-insert-scene").addEventListener("click",()=>{k(`INT. LOCATION - DAY

`)});i("#menu-insert-dialogue").addEventListener("click",()=>{k(`CHARACTER
Dialogue here.

`)});i("#menu-insert-direction").addEventListener("click",()=>{k(`Action description.

`)});i("#menu-insert-transition").addEventListener("click",()=>{k(`CUT TO:

`)});i("#menu-insert-section").addEventListener("click",()=>{k(`# Act 1

`)});i("#menu-insert-pagebreak").addEventListener("click",()=>{k(`===

`)});i("#menu-insert-centered").addEventListener("click",()=>{k(`> Centered text <

`)});function In(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${_.sceneNumbers}`),se(),Fe(0),r.previewMode==="pdf"&&Ce()}i("#menu-scene-numbers").addEventListener("click",()=>{i("#scene-num-placement").value=_.sceneNumbers,i("#scene-num-format").value=_.sceneNumberFormat,i("#scene-num-dialog").showModal()});i("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),Ke("sceneNumbers",i("#scene-num-placement").value),Ke("sceneNumberFormat",i("#scene-num-format").value),In(),i("#scene-num-dialog").close())});function Rt(e){document.body.dataset.mobileTab=e,j(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&le()&&r.previewMode!=="live"?ve("live"):e==="preview"&&r.previewMode==="pdf"&&Ce(),e==="source"&&(re(),Oe(V().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>At(r.insightLine,!1))}j(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Rt(e.dataset.mobilePanel)));i("#preview-scroll").addEventListener("scroll",()=>{te(),I()});Ee.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&ze(e)}));document.addEventListener("pointerdown",e=>Ee.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=i("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&te()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!i("#preview-context-menu").hidden?te():e.key==="Escape"&&Ee.some(t=>t.open)?ze():(c===document.activeElement||m.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Ae():dt()):(c===document.activeElement||m.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Ae()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),De(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),bt()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),wt())});window.addEventListener("beforeunload",et);var $e=0;function Ot(){$e=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function ue(){$e||($e=requestAnimationFrame(Ot))}window.visualViewport?.addEventListener("resize",ue);window.visualViewport?.addEventListener("scroll",ue);window.addEventListener("scroll",ue);document.addEventListener("focusin",ue);window.addEventListener("resize",()=>{ue(),te(),re(),le()&&r.previewMode==="pdf"&&ve("live"),O()});async function Rn(){Ot(),_t(r.theme);let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";i("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),document.body.classList.add(`scene-nums-${_.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),a=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),a&&document.documentElement.style.setProperty("--stats-w",`${a}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),Je(i("#source-resizer"),"--source-w",1,250,650),Je(i("#stats-resizer"),"--stats-w",-1,240,520);let o=new URLSearchParams(location.search),s=o.get("demo")==="1"?null:Bt(),l=o.get("demo")==="1"?Ft:"",p=o.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(o.has("project"))try{let u=await(await fetch("/api/project")).json();l=u.source,p=u.filename}catch{}let d=s&&(!o.has("project")||s.filename===p);d&&(l=s.source,p=s.filename||p,r.savedSource=typeof s.savedSource=="string"?s.savedSource:l),r.cacheEnabled=o.get("demo")!=="1",Q(l,p,!d,d&&s.githubFile||null),Be(),Rt(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),d&&["fit","70","85","100","115","130"].includes(String(s.zoom))&&(r.previewZoom=String(s.zoom),s.zoom!=="fit"&&(i("#zoom").value=String(s.zoom))),O();let f=["live","pdf"].includes(s?.previewMode)?s.previewMode:"live";await ve(d?f:localStorage.getItem("fountain-publisher.preview")||"live"),d&&requestAnimationFrame(()=>{let h=Math.min(Number(s.selectionStart)||0,c.value.length),u=Math.min(Number(s.selectionEnd)||h,c.value.length);c.setSelectionRange(h,u),c.scrollTop=Math.max(0,Number(s.sourceScrollTop)||0),i("#preview-scroll").scrollTop=Math.max(0,Number(s.previewScrollTop)||0),i("#line-numbers").scrollTop=c.scrollTop,ge(),M(),x("Workspace restored")})}Rn();
