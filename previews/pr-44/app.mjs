var zt=`Title: The Last Light
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
`;var o=(e,t=document)=>t.querySelector(e),j=(e,t=document)=>[...t.querySelectorAll(e)],Me=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),jt=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=o("#source"),g=o("#screenplay-page"),Ie="fountain-publisher.workspace.v1",Re="https://api.fountain-publisher.com",Z=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",N={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function et(e,t){N[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:Gt(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null,previewContextEdit:null,previewContextText:"",githubConnected:!1,githubInstallUrl:"",githubRepositories:[],githubRepositoryTimer:0,githubPath:"",githubFile:null};function Gt(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function Yt(){try{let e=JSON.parse(localStorage.getItem(Ie)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function rt(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(Ie,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:o("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,githubFile:r.githubFile,updatedAt:Date.now()}))}catch{}}}function k(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(rt,120))}function Oe(){return localStorage.getItem("fountain-publisher.clear-workspace-on-exit")==="true"}function Pe(){clearTimeout(r.cacheTimer),localStorage.removeItem(Ie)}function Fe(){let e=localStorage.getItem("fountain-publisher.preview-background")||"dots",t=["blank","dots"].includes(e)?e:"dots",n=Number(localStorage.getItem("fountain-publisher.preview-dot-radius")),a=n>=.6&&n<=1.8?n:1,i=o("#preview-scroll");i.dataset.background=t,i.style.setProperty("--preview-dot-radius",`${a}px`),o("#preview-background").value=t,o("#preview-dot-radius").value=String(a),o("#preview-dot-radius-value").textContent=`${a.toFixed(1)}px`,o("#preview-dot-radius-row").hidden=t!=="dots"}function w(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function He(e){return w(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Te(e){try{return decodeURIComponent(e)}catch{return e}}function Be(e){let t=e.trim().match(jt);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Te(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Te(t[2].slice(0,n)),text:Te(t[2].slice(n+1))}}function lt(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function Kt(e){let t=[],n={},a=!1;return e.forEach((i,s)=>{if(i.includes("/*")&&(a=!0),a){i.includes("*/")&&(a=!1);return}let l=Be(i);l?.kind==="general"?t.push({line:s,text:l.text}):l?.kind==="character"&&(n[l.name]={line:s,text:l.text})}),{generalNotes:t,characterNotes:n}}function De(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function qt(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function Zt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||De(n))return!1;let i=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),s=t===0||!e[t-1].trim();return i&&s}function re(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],a=!0,i=!1,s=!1,l=!1,p=!1;for(let d=0;d<t.length;d+=1){let f=t[d],h=f.trim(),u="action",m=f,b="";if(h.includes("/*")&&(p=!0),p)u="boneyard";else if(!h)u="empty",l=!1,i&&(a=!1),s=!1;else if(a&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&Me.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let C=f.indexOf(":");b=f.slice(0,C+1),m=f.slice(C+1).trim(),u=b.toLowerCase()==="title:"?"title-value title":"title-value",i=!0,s=!0,l=!1}else a&&s&&/^\s+/.test(f)?(m=h,u="title-value",l=!1):(a=!1,/^#{1,6}\s/.test(h)?u="section":/^=/.test(h)&&!/^={3,}$/.test(h)?u="synopsis":/^\[\[.*\]\]$/.test(h)?u="note":/^~/.test(h)?(u="lyric",m=f.replace(/^\s*~/,"")):/^={3,}$/.test(h)?u="page-break":De(h)?(u="scene",l=!1):Zt(t,d)?(u="character",m=h.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(h)?u="parenthetical":l?u="dialogue":/^>.*<$/.test(h)?(u="centered",m=h.slice(1,-1).trim()):/^>/.test(h)||/^[A-Z0-9 .'-]+TO:$/.test(h)?u="transition":h.startsWith("!")&&(u="action",m=f.replace(/^\s*!/,"")));n.push({raw:f,display:m,prefix:b,type:u,index:d}),h.includes("*/")&&(p=!1)}return n}function Xt(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=re(e),a=Kt(t),i=new Map,s=[],l=[],p=new Set,d=[],f="",h=0,u="",m=0,b=0,C=0;n.forEach((y,v)=>{let _=(y.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(y.prefix&&d.push(y.prefix.slice(0,-1)),y.type==="section"){let E=y.raw.trim().match(/^(#{1,6})\s+(.+)$/);E&&(l.push({level:E[1].length,title:E[2],line:v+1}),E[1].length===1&&(u=E[2],m+=1))}else if(y.type==="scene"){let E=y.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),H=y.display.match(/#([^#]+)#/)?.[1]||String(s.length+1);s.push({number:H,heading:E,line:v+1,words:0,act:u||"Screenplay",actNumber:m}),h=s.length;let ne=E.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ne&&p.add(ne),f=""}else if(y.type==="character"){f=qt(y.display);let E=i.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};E.cues+=1,E.lastLine=v+1,h&&E.sceneSet.add(h),i.set(f,E)}else if(y.type==="dialogue"){let E=i.get(f);E&&(E.lines+=1,E.words+=_,b+=_,h&&E.sceneLineMap.set(h,(E.sceneLineMap.get(h)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(y.type)||(f="",C+=_,s.length&&(s.at(-1).words+=_))});let P=[...i.values()].map(y=>({...y,seconds:Math.round(y.words/130*60),scenes:y.sceneSet.size,sceneLines:[...y.sceneLineMap].map(([v,_])=>({scene:v,lines:_})),sceneSet:void 0,sceneLineMap:void 0})).sort((y,v)=>v.words-y.words||y.name.localeCompare(v.name)),F=b+C,B=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:F,dialogueWords:b,actionWords:C,estimatedSeconds:B==null?0:B*60,characters:P,scenes:s,sections:l,locations:[...p].sort(),titleFields:d,pageCount:B,...a}}function Ne(e,t=null,n=null){let a=e.raw.trim().match(/^>\s*(.*?)\s*<$/),i=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,s=a?"centered":e.type,l=`script-line ${s}${i?" act":""}`,p=i?.[1]||e.display,d=i?"#":e.prefix;if(a?p=a[1]:s==="transition"&&e.raw.trim().startsWith(">")&&(p=e.raw.trim().slice(1).trimStart()),t!==null){let b=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");p=N.sceneNumbers==="inline"?`${t}. ${b}`:b}let f=s==="note"?Be(e.raw):null,h=p?He(p):"<br>",u=t!==null?w(t):"";if(s==="note"&&!f)return"";if(s==="note"&&f)return`<div class="script-line note managed-note" data-line="${e.index}"></div>`;let m=n?`<button class="annotation-orb" type="button" data-annotation-line="${n.index}" title="${w(n.text)}" aria-label="Edit annotation: ${w(n.text)}"></button>`:"";return`<div class="${l}" data-line="${e.index}" data-prefix="${w(d)}" data-scene-number="${u}" data-display="${w(p)}">${h}${m}</div>`}function _e(e,t){let n=e[t+1];return n?.type==="note"&&!Be(n.raw)?{index:n.index,text:lt(n.raw)}:null}function Jt(e){let t=new Map;if(N.sceneNumbers==="off")return t;let n=0,a=0,i=0,s=N.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(a++,i=0):l.type==="scene"&&(n++,i++,t.set(l.index,s==="act"?`A${Math.max(a,1)}S${i}`:String(n)));return t}function Vt(e){let t=Jt(e),n=[];for(let a=0;a<e.length;a+=1){if(e[a].type==="character"){let s=a+1;for(;s<e.length&&["dialogue","parenthetical","note"].includes(e[s].type);)s+=1;for(;s<e.length&&e[s].type==="empty";)s+=1;if(e[s]?.type==="character"&&e[s].raw.trim().endsWith("^")){let l=s+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(a,s).filter(u=>u.type!=="empty"),d=e.slice(s,l),f=p.map((u,m)=>Ne(u,null,_e(p,m))).join(""),h=d.map((u,m)=>Ne(u,null,_e(d,m))).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${f}</div><div class="dual-right">${h}</div></div>`),a=l-1;continue}}let i=t.get(e[a].index)??null;n.push(Ne(e[a],i,_e(e,a)))}return n.join("")}function le({focusLine:e=null,focusOffset:t=null}={}){let n=re(c.value),a=o("#preview-scroll"),i=o("#preview-page-stage"),s=a.scrollTop,l=a.scrollLeft;g.innerHTML=Vt(n),g.spellcheck=o("#spellcheck").checked;let p=n.some(d=>d.raw.trim());if(o("#empty-state").hidden=p,i.hidden=r.previewMode!=="live",g.hidden=r.previewMode!=="live",e!==null){let d=o(`[data-line="${e}"]`,g);if(g.focus({preventScroll:!0}),d){let f=t??d.textContent.length;J(d,f),D(d,f)}}a.scrollTop=s,a.scrollLeft=l,requestAnimationFrame(()=>{a.scrollTop=s,a.scrollLeft=l}),ht(),O()}function J(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),a=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),i=a.nextNode();for(;i&&n>i.textContent.length;)n-=i.textContent.length,i=a.nextNode();let s=document.createRange();i?s.setStart(i,n):(s.selectNodeContents(e),s.collapse(!1)),s.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(s)}function Qt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let d of e.matchAll(a)){let f=d[1].length;for(let h=d.index;h<d.index+f;h+=1)t[h]=!0;for(let h=d.index+d[0].length-f;h<d.index+d[0].length;h+=1)t[h]=!0,n[h]=!0}let i=t.flatMap((d,f)=>d?[]:[f]),s=Array.from({length:i.length+1},(d,f)=>f<i.length?i[f]:(i.at(-1)??-1)+1),l=Array.from({length:i.length+1},(d,f)=>f?i[f-1]+1:i[0]??0),p=Array.from({length:i.length+1},(d,f)=>{let h=f?i[f-1]+1:0,u=f<i.length?i[f]:e.length;for(;h<u&&n[h];)h+=1;return h});return{startMap:s,endMap:l,caretMap:p}}function en(e,t){let n=0,a=t.length,i=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",i)+1,t[n]===" "&&(n+=1);let s=t.lastIndexOf("<");a=s<n?a:s,t[a-1]===" "&&(a-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",i)+1;else if(e.classList.contains("character")&&t.slice(i).startsWith("@"))n=i+1;else if(e.classList.contains("transition")&&t.slice(i).startsWith(">"))for(n=i+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let s=t.indexOf(e.dataset.prefix,i);for(n=s<0?0:s+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let s=t.slice(n,a).match(/\s+#[^#]+#\s*$/);s&&(a=n+s.index)}return{start:n,end:a,map:Qt(t.slice(n,a))}}function W(e,t,n,a="caret"){let i=en(e,t),s=e.dataset.sceneNumber&&N.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-s,i.map.startMap.length-1)),p=a==="start"?i.map.startMap:a==="end"?i.map.endMap:i.map.caretMap;return i.start+(p[l]??i.end-i.start)}function tn(e,t){let n=[],a=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let i of e.matchAll(a)){let s=i.index+i[1].length,l=i.index+i[0].length-i[1].length;t>=s&&t<=l&&n.push(i[1])}return n}function tt(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let a=document.createRange();return a.selectNodeContents(e),a.setEnd(t,n),a.toString().length}function R(e=A(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),a=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,i=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,s=a?.closest?.(".script-line")||e,l=i?.closest?.(".script-line")||e;return{startLine:s,endLine:l,startOffset:tt(s,n.startContainer,n.startOffset),endOffset:tt(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function nt(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let a=R(e);if(!a||a.startLine!==a.endLine||a.startOffset!==a.endOffset)return!1;if(!e.textContent.length)return!0;let i=document.createRange();i.selectNodeContents(e);let s=[...i.getClientRects()],l=t==="first"?s[0]?.top:s.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let d=[...p.getClientRects()];return d.length?l!==void 0&&d.length>0&&d.every(f=>Math.abs(f.top-l)<1):t==="first"?a.startOffset===0:a.startOffset===e.textContent.length}function ie(e,t,n){return e.slice(0,t).reduce((a,i)=>a+i.length+1,0)+n}function D(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.dataset.line),i=W(e,n[a]||"",t),s=ie(n,a,i);c.setSelectionRange(s,s),Ue(a),I()}function ct(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),a=Number(e.endLine.dataset.line),i=W(e.startLine,t[n]||"",e.startOffset,"start"),s=W(e.endLine,t[a]||"",e.endOffset,"end"),l=ie(t,n,i),p=ie(t,a,s);c.setSelectionRange(l,p,e.direction),Ue(e.direction==="backward"?n:a),I()}function ut(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=e.dataset.display??e.textContent,i=e.textContent.replace(/\n/g,""),s=0;for(;s<a.length&&s<i.length&&a[s]===i[s];)s+=1;let l=a.length,p=i.length;for(;l>s&&p>s&&a[l-1]===i[p-1];)l-=1,p-=1;let d=s===l,f=W(e,n[t],s,d?"caret":"start"),h=W(e,n[t],l,d?"caret":"end"),u=n[t].slice(0,f)+i.slice(s,p)+n[t].slice(h);n[t]=u,e.dataset.display=i,e.innerHTML=He(i)||"<br>",J(e,p),c.value=n.join(`
`);let m=ie(n,t,f+p-s);c.setSelectionRange(m,m),$({fromPreview:!0})}function U(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),a=Number(e.startLine.dataset.line),i=Number(e.endLine.dataset.line),s=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),d=`${s}${p}${l}`.split(`
`),f=a===i&&e.startOffset===e.endOffset,h=W(e.startLine,n[a],e.startOffset,f?"caret":"start"),u=W(e.endLine,n[i],e.endOffset,f?"caret":"end"),m=n[i].slice(u),b=a===i?[]:n.slice(a+1,i).filter(v=>/^\s*\[\[.*\]\]\s*$/.test(v));if(a===i&&p.includes(`
`)){let v=tn(n[a],h);v.length&&(p=p.replaceAll(`
`,`${[...v].reverse().join("")}
${v.join("")}`))}let C=`${n[a].slice(0,h)}${p}${n[i].slice(u)}`.split(`
`);if(a===i&&e.startLine.classList.contains("centered")&&C.length>1){C[0]=`${C[0].trimEnd()} <`,C[C.length-1]=`> ${C.at(-1).trimStart()}`;for(let v=1;v<C.length-1;v+=1)C[v]=`> ${C[v]} <`}n.splice(a,i-a+1,...C,...b),c.value=n.join(`
`);let P=a+d.length-1,F=d.length===1?s.length+t.length:t.split(/\r\n?|\n/).at(-1).length,B=C.at(-1).length-m.length,y=ie(n,P,Math.max(0,B));c.setSelectionRange(y,y),$({fromPreview:!0}),a===i&&d.length===1?(e.startLine.innerHTML=He(d[0])||"<br>",e.startLine.dataset.display=d[0],g.focus({preventScroll:!0}),J(e.startLine,F),D(e.startLine,F),dt(e.startLine)):le({focusLine:P,focusOffset:F})}function nn(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return U(e,"");let a=e.startLine,i=Number(a.dataset.line),s=a.textContent;if(t==="backward"&&e.startOffset>0){let l=s.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<s.length){let l=s.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=j(".script-line[data-display]",g),p=l.indexOf(a),d=l[p+(t==="backward"?-1:1)];if(!d)return;t==="backward"?(e.startLine=d,e.startOffset=d.textContent.length):(e.endLine=d,e.endOffset=0)}U(e,"")}function G(){o("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function dt(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),a=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(a)||n&&!/^[A-Z0-9 ._'-]*$/.test(a))return G();r.previewCompletionItems=r.metadata.characters.map(i=>i.name).filter((i,s,l)=>i.startsWith(a)&&i!==a&&l.indexOf(i)===s),r.previewCompletionIndex=0,r.previewCompletionLine=e,pt()}function pt(){let e=o("#preview-completion-menu");if(!r.previewCompletionItems.length)return G();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${w(t)}</span><small>Character</small></button>`).join(""),on()}function on(){let e=o("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=o(".preview-panel").getBoundingClientRect(),a=getSelection(),i=t.getBoundingClientRect();if(a?.rangeCount&&t.contains(a.focusNode)){let h=document.createRange();if(h.setStart(a.focusNode,a.focusOffset),h.collapse(!0),i=h.getClientRects()[0]||h.getBoundingClientRect(),!i.width&&!i.height){let u=document.createRange();u.selectNodeContents(t),u.setEnd(a.focusNode,a.focusOffset);let m=u.getBoundingClientRect(),b=t.getBoundingClientRect();i={left:m.right,right:m.right,top:b.top,bottom:b.bottom,width:0,height:b.height}}}let s=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-s-8,i.left)),p=Math.min(e.scrollHeight,245),d=i.bottom+6,f=d+p<=n.bottom-8?d:Math.max(n.top+8,i.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function ft(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,ut(n),G(),g.focus({preventScroll:!0}),J(n,n.textContent.length))}function ce(){rn(),ye(),an(),I()}function an(){let e=o("#line-numbers"),t=o("#source-highlight"),n=t.getBoundingClientRect(),a=c.value.split(`
`).map((s,l)=>{let d=o(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=d?d.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),i=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${a}<span class="line-number-spacer" style="height:${i}px"></span>`,e.scrollTop=c.scrollTop}function sn(e){return w(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function rn(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=re(c.value);o("#source-highlight").innerHTML=t.map((n,a)=>{let i=e[n.type],s=sn(n.raw)||" ",l=a<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${i?` class="syntax-${i}"`:""}>${s}${l}</span>`}).join("")}function me(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function ye(){let e=o("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=me(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=me(e,t)}function V(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function ln(e,t="nearest"){let n=o("#preview-scroll"),a=e.getBoundingClientRect(),i=n.getBoundingClientRect(),s=n.scrollTop,l=n.scrollLeft;t==="center"?s+=a.top-i.top-(n.clientHeight-a.height)/2:a.top<i.top?s+=a.top-i.top:a.bottom>i.bottom&&(s+=a.bottom-i.bottom),a.left<i.left?l+=a.left-i.left:a.right>i.right&&(l+=a.right-i.right),n.scrollTop=Math.max(0,s),n.scrollLeft=me(n,l)}function Ue(e,t="nearest"){if(!c.clientHeight)return;let n=o("#source-highlight"),i=o(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!i)return;let s=getComputedStyle(c),l=parseFloat(s.paddingTop)||0,p=parseFloat(s.paddingBottom)||0,d=parseFloat(s.lineHeight)||20.15,f=i.top-n.getBoundingClientRect().top+n.scrollTop,h=f+d,u=c.scrollTop;t==="center"?u=f-(c.clientHeight-d)/2:f<c.scrollTop+l?u=f-l:h>c.scrollTop+c.clientHeight-p&&(u=h-c.clientHeight+p),c.scrollTop=Math.max(0,u),ye(),o("#line-numbers").scrollTop=c.scrollTop}function ht(e=!1,t="nearest"){let n=o(`[data-line="${V().line}"]`,g);j(".script-line.source-current",g).forEach(a=>a.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&ln(n,t)}function I({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=V();o("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let a=re(c.value)[n.line]?.type||"action",i={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};o("#editor-status").textContent=i[a]||a[0].toUpperCase()+a.slice(1);let s=getComputedStyle(c),l=parseFloat(s.lineHeight)||20.15,p=o(`[data-source-line="${n.line}"]`,o("#source-highlight")),d=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(s.paddingTop):-c.scrollTop;o("#current-line").style.height=`${l}px`,o("#current-line").style.transform=`translateY(${d}px)`,ht(e,t)}function mt(e){r.metadata=e,o("#stat-pages").textContent=e.pageCount??"\u2014",o("#stat-scenes").textContent=e.scenes.length,o("#stat-words").textContent=e.wordCount.toLocaleString(),o("#scene-count").textContent=e.scenes.length,o("#character-count").textContent=e.characters.length,o("#scene-list").innerHTML=dn(e),cn(),un();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;o("#dialogue-bar").style.width=`${n}%`,o("#dialogue-percent").textContent=`${n}%`,o("#action-percent").textContent=`${100-n}%`,o("#character-analytics-dialog").open&&We()}function cn(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};o("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let a=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${w(n.name)}">${w(n.name)}${a?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function un(){let e=r.metadata.generalNotes||[];o("#general-note-count").textContent=e.length,o("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${w(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function ke(e,t=e.number){return`<li><span class="scene-num">${w(t)}</span><button type="button" data-line="${e.line}">${w(e.heading)}</button></li>`}function dn(e){let t=e.scenes||[],n=(e.sections||[]).filter(s=>s.level===1);if(!n.length)return t.length?t.map(s=>ke(s)).join(""):'<li class="empty-list">No scene headings yet.</li>';let a=t.filter(s=>!s.actNumber).map(s=>ke(s)).join(""),i=n.map((s,l)=>{let p=l+1,d=t.filter(f=>f.actNumber===p).map((f,h)=>ke(f,String(h+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${s.line}"><span>${l+1}</span>${w(s.title)}</button><ol>${d||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return a+i}function q(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function fe(e,t,n){let a=String(t);if(e.measureText(a).width<=n)return a;let i=a;for(;i.length&&e.measureText(`${i}\u2026`).width>n;)i=i.slice(0,-1);return i?`${i}\u2026`:""}function We(){let e=o("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,a=Math.min(window.devicePixelRatio||1,2),i=150,s=92,l=28,p=54,d=34,f=n.length?i+n.length*s:480,h=l+p+Math.max(t.length,1)*d;e.width=Math.ceil(f*a),e.height=Math.ceil(h*a),e.style.width=`${f}px`,e.style.height=`${h}px`;let u=e.getContext("2d");u.scale(a,a);let m=q("--surface","#fff"),b=q("--surface-2","#f2f2f2"),C=q("--ink","#202124"),P=q("--muted","#6b7280"),F=q("--border","#d7d9dd"),B=q("--syntax-character","#7c3aed"),y=t.flatMap(L=>(L.sceneLines||[]).map(S=>S.lines)).filter(L=>L>0),v=y.length?Math.min(...y):0,_=y.length?Math.max(...y):0,E=o("#character-analytics-legend");E.hidden=!y.length,o("#character-analytics-min").textContent=`${v} ${v===1?"line":"lines"}`,o("#character-analytics-max").textContent=`${_} ${_===1?"line":"lines"}`,u.fillStyle=m,u.fillRect(0,0,f,h),u.strokeStyle=F,u.lineWidth=1,u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.textBaseline="middle";let H=0;for(;H<n.length;){let L=n[H].act||"Screenplay",S=H+1;for(;S<n.length&&(n[S].act||"Screenplay")===L;)S+=1;let T=i+H*s,K=(S-H)*s;u.fillStyle=b,u.fillRect(T,0,K,l),u.fillStyle=C,u.textAlign="center",u.fillText(fe(u,L,K-12),T+K/2,l/2),u.strokeRect(T+.5,.5,K,l),H=S}u.fillStyle=b,u.fillRect(0,0,i,l+p),u.fillStyle=P,u.textAlign="left",u.fillText("CHARACTER",12,l+p/2);let ne=new Map,Wt=n.map((L,S)=>{if(!L.actNumber)return String(S+1);let T=(ne.get(L.actNumber)||0)+1;return ne.set(L.actNumber,T),String(T)});n.forEach((L,S)=>{let T=i+S*s;u.strokeStyle=F,u.strokeRect(T+.5,l+.5,s,p),u.fillStyle=C,u.textAlign="center",u.fillText(fe(u,Wt[S],s-10),T+s/2,l+16),u.fillStyle=P,u.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.fillText(fe(u,L.heading,s-10),T+s/2,l+36),u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((L,S)=>{let T=l+p+S*d;S%2===1&&(u.fillStyle=b,u.fillRect(0,T,i+n.length*s,d)),u.fillStyle=C,u.textAlign="left",u.fillText(fe(u,L.name,i-20),12,T+d/2);let K=new Map((L.sceneLines||[]).map(Le=>[Le.scene,Le.lines]));n.forEach((Le,Je)=>{let Se=K.get(Je+1)||0;if(!Se)return;let Ve=i+Je*s+4,Qe=_===v?1:.25+.75*((Se-v)/(_-v));u.save(),u.globalAlpha=Qe,u.fillStyle=B,u.fillRect(Ve,T+7,s-8,d-14),u.restore(),u.fillStyle=Qe>=.6?"#fff":C,u.textAlign="center",u.fillText(String(Se),Ve+(s-8)/2,T+d/2)})}),n.length||(u.fillStyle=P,u.textAlign="center",u.fillText("Add scene headings to build the timeline.",f/2,l+p+d/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${v} to ${_} dialogue lines`)}function pn(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function fn(){We(),o("#character-analytics-dialog").showModal()}async function hn(){try{await navigator.clipboard.writeText(pn()),x("Line usage CSV copied")}catch{x("Clipboard access was denied")}}async function mn(){We();let e=await new Promise(t=>o("#character-analytics-chart").toBlob(t,"image/png"));if(!e){x("Could not create analytics image");return}await Ze(e,se("character-analytics.png")),x("Character analytics PNG saved")}function gn(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function gt(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=g.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],$({fromPreview:t!==null,record:!1}),t!==null?le({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function yt(){gt(r.historyIndex-1)}function Ae(){gt(r.historyIndex+1)}function $({fromPreview:e=!1,record:t=!0}={}){t&&gn(),document.body.classList.toggle("dirty",c.value!==r.savedSource),ce(),e||le(),mt(Xt(c.value)),ze(),k()}function ze(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;o("#compile-status").textContent="Editing\u2026",o("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>Z?bt(t):yn(t),Z?Math.max(e,700):e)}function wt(e,t=Z){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),a=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;o("#compile-status").textContent=a,o("#compile-status").title=a,o("#compile-status").classList.add("error")}async function bt(e){o("#compile-status").textContent="Compiling\u2026";try{let t=await At("pdf",o("#page-size").value),n=await vt(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,o("#stat-pages").textContent=n,o("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;wt(t,!0)}}async function yn(e){let t=new AbortController;r.compileController=t,o("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:o("#page-size").value,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat}),signal:t.signal});if($t(n,"application/json")){Z=!0,await bt(e);return}let a=await n.json();if(!n.ok)throw new Error(a.error||"Compilation failed");if(a.pageCount==null&&(a.pageCount=await vt(await ge("/api/render/pdf"))),a.estimatedSeconds=a.pageCount*60,e!==r.compileRevision)return;mt(a),o("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;wt(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function vt(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function wn(){let{line:e,start:t}=V(),n=c.value.split(`
`),i=n[e].slice(0,c.selectionStart-t).trim(),s=i.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],d=(u,m,b="\u0192")=>p.push({value:u,detail:m,icon:b}),f=(s?i.slice(1):i.split(/\s+/).at(-1)).toUpperCase();(s||f&&r.metadata.characters.some(u=>u.name.startsWith(f)))&&r.metadata.characters.forEach(u=>d(u.name,`${u.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!i||/^[A-Za-z ]*$/.test(i))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(u=>!r.metadata.titleFields.some(m=>`${m}:`.toLowerCase()===u.trim().toLowerCase())).forEach(u=>d(u,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(i)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(u=>d(u,"Time of day","\u25F7")):De(i)||/^(?:INT|EXT|EST|I\/E)/i.test(i)?r.metadata.locations.forEach(u=>d(u,"Existing location","\u2302")):l&&(s||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(u=>d(u,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(u=>d(u,"Transition","\u2192"))));let h=(s?i.slice(1):i).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((u,m)=>p.findIndex(b=>b.value===u.value)===m&&(u.icon!=="@"||u.value.toUpperCase()!==f)&&(!h||u.value.toUpperCase().startsWith(h)||u.detail==="Existing location"))}function xt({allowBlank:e=!1}={}){let{line:t,start:n}=V(),a=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!a||(r.completionItems=wn(),r.completionIndex=0,!r.completionItems.length))return z();Ct()}function Ct(){let e=o("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${w(t.icon)}</span><span>${w(t.value)}</span><small>${w(t.detail)}</small></button>`).join(""),bn(),o(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function z(){o("#completion-menu").hidden=!0,r.completionItems=[]}function bn(){let e=o("#completion-menu"),t=c.getBoundingClientRect(),n=o("#source-panel").getBoundingClientRect(),a=getComputedStyle(c),i=document.createElement("div"),s=document.body.classList.contains("source-wrap"),l=me(c);Object.assign(i.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:a.boxSizing,left:`${t.left-(s?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${s?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:a.padding,border:a.border,font:a.font,letterSpacing:a.letterSpacing,lineHeight:a.lineHeight,whiteSpace:s?"pre-wrap":"pre",overflowWrap:s?"anywhere":"normal",tabSize:a.tabSize}),i.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",i.append(p),document.body.append(i);let d=p.getBoundingClientRect();i.remove();let f=Math.min(310,n.width-16),h=Math.max(n.left+8,Math.min(n.right-f-8,d.left)),u=Math.min(e.scrollHeight,245),m=d.bottom+5,b=m+u<=n.bottom-8?m:Math.max(n.top+8,d.top-u-5);e.style.left=`${h}px`,e.style.top=`${b}px`,e.style.right="auto",e.style.bottom="auto"}function Et(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=V(),i=c.value.slice(0,c.selectionStart).slice(n.start),s=n.start;if(t.icon==="@"){let p=i.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";s=c.selectionStart-p.length}else/\s-\s/.test(i)?s=n.start+i.lastIndexOf("-")+2:i.trim()&&(s=n.start+i.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,s,c.selectionStart,"end"),z(),$()}async function Lt(){await je()&&(r.handle=null,Q("","Untitled.fountain",!0),c.focus())}async function je(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function St(){if(await je()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();Q(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&x(e.message);return}o("#file-input").click()}}function Q(e,t,n=!1,a=null){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),r.githubFile=a,o("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,$()}async function Ge(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:se("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await Ze(new Blob([c.value],{type:"text/plain;charset=utf-8"}),se("fountain"));r.savedSource=c.value,Q(c.value,r.filename,!0),x(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&x(t.message)}}async function Y(e,t={}){let n=await fetch(`${Re}${e}`,{credentials:"include",...t}),a=await n.json().catch(()=>({}));if(!n.ok)throw new Error(a.error||`GitHub request failed (${n.status})`);return a}function Tt(){o("#github-connect").textContent=r.githubConnected?"GitHub browser\u2026":"Connect GitHub\u2026",o("#github-open").disabled=!r.githubConnected,o("#github-save").disabled=!r.githubConnected}async function Ye({notify:e=!1}={}){try{let t=await Y("/api/session");r.githubConnected=!0,r.githubInstallUrl=t.installUrl,o("#github-account").textContent=`Connected as ${t.login}`,e&&x(`Connected to GitHub as ${t.login}`)}catch{r.githubConnected=!1,r.githubInstallUrl="",o("#github-account").textContent="Not connected"}return Tt(),r.githubConnected}function Nt(e){let t=Math.min(480,screen.availWidth-24),n=Math.min(640,screen.availHeight-24),a=window.open(e,"fountain-publisher-github",`popup,width=${t},height=${n}`);return a||x("Allow popups to connect GitHub"),a}async function _t(){if(r.githubConnected)return be();Nt(`${Re}/auth/github/start`)}function ae(){let e=o("#github-repository").selectedOptions[0];if(!e?.value)return null;let[t,n]=e.value.split("/");return{owner:t,repo:n,fullName:e.value,defaultBranch:e.dataset.defaultBranch}}function kt(e=""){let t=o("#github-repository"),n=t.value,a=e.trim().toLocaleLowerCase(),i=r.githubRepositories.filter(s=>s.fullName.toLocaleLowerCase().includes(a));return t.innerHTML=i.map(s=>`<option value="${w(s.fullName)}" data-default-branch="${w(s.defaultBranch)}">${w(s.fullName)}${s.private?" \xB7 Private":""}</option>`).join(""),i.some(s=>s.fullName===n)&&(t.value=n),t.disabled=!i.length,i.length}function Ke(e=r.githubPath){let t=ae(),n=o("#github-branch").value;return t?`/api/contents?${new URLSearchParams({owner:t.owner,repo:t.repo,branch:n,path:e})}`:""}function vn(){let e=r.githubPath?r.githubPath.split("/"):[],t=['<button type="button" data-github-path="">Root</button>'];e.forEach((n,a)=>{t.push("<span>/</span>",`<button type="button" data-github-path="${w(e.slice(0,a+1).join("/"))}">${w(n)}</button>`)}),o("#github-breadcrumbs").innerHTML=t.join("")}async function we(e=""){r.githubPath=e,vn();let t=o("#github-files");t.innerHTML='<div class="github-empty">Loading repository\u2026</div>';try{let n=await Y(Ke(e)),a=(Array.isArray(n)?n:[n]).filter(i=>i.type==="dir"||/\.(fountain|txt)$/i.test(i.name)).sort((i,s)=>i.type===s.type?i.name.localeCompare(s.name):i.type==="dir"?-1:1);t.innerHTML=a.length?a.map(i=>`<button type="button" role="listitem" data-github-entry="${w(i.path)}" data-github-type="${i.type}"><span aria-hidden="true">${i.type==="dir"?"\u25B8":"F"}</span><span>${w(i.name)}</span><small>${i.type==="dir"?"Folder":"Open"}</small></button>`).join(""):'<div class="github-empty">No Fountain files in this folder.</div>'}catch(n){t.innerHTML=`<div class="github-empty">${w(n.message)}</div>`}}async function qe(){let e=ae();if(!e)return;let t=await Y(`/api/branches?${new URLSearchParams({owner:e.owner,repo:e.repo})}`);ae()?.fullName===e.fullName&&(o("#github-branch").innerHTML=t.branches.map(n=>`<option value="${w(n)}"${n===e.defaultBranch?" selected":""}>${w(n)}</option>`).join(""),await we(""))}async function xn(){let e=await Y("/api/repositories");if(r.githubInstallUrl=e.installUrl,r.githubRepositories=e.repositories,o("#github-install").hidden=!1,o("#github-repository-search").value="",kt(),!e.repositories.length){o("#github-files").innerHTML='<div class="github-empty">Install Fountain Publisher on at least one repository to browse files.</div>',o("#github-branch").innerHTML="";return}await qe()}async function be(){if(!r.githubConnected&&!await Ye())return _t();Xe(),o("#github-filename").value=se("fountain"),o("#github-dialog").showModal();try{await xn()}catch(e){x(e.message)}}function Cn(e){let t=atob(e.replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(t,n=>n.charCodeAt(0)))}async function En(e,t){if(await je()){t&&(t.disabled=!0,t.setAttribute("aria-busy","true"),t.querySelector("small").textContent="Opening\u2026");try{let n=ae(),a=o("#github-branch").value,i=await Y(Ke(e)),s={owner:n.owner,repo:n.repo,branch:a,path:e,sha:i.sha};r.handle=null,Q(Cn(i.content),i.name,!0,s),o("#github-dialog").close(),x(`Opened ${n.fullName}/${e}`)}catch(n){x(n.message),t?.isConnected&&(t.disabled=!1,t.removeAttribute("aria-busy"),t.querySelector("small").textContent="Open")}}}async function Ln(){let e=ae(),t=o("#github-branch").value,n=o("#github-filename").value.trim(),a=o("#github-commit-message").value.trim();if(!e||!t||!/^[^/]+\.(fountain|txt)$/i.test(n))return x("Enter a .fountain file name");let i=[r.githubPath,n].filter(Boolean).join("/"),s=r.githubFile,l=s&&s.owner===e.owner&&s.repo===e.repo&&s.branch===t&&s.path===i?s.sha:void 0;try{let p=await Y(Ke(i),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({content:c.value,message:a||`Update ${n}`,sha:l})});r.githubFile={owner:e.owner,repo:e.repo,branch:t,path:i,sha:p.sha},r.filename=n,r.savedSource=c.value,o("#filename").textContent=n,document.title=`${n} \u2014 Fountain Publisher`,document.body.classList.remove("dirty"),o("#github-dialog").close(),x(`Committed ${e.fullName}/${i}`)}catch(p){x(p.message)}}function se(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function Ze(e,t){let n=URL.createObjectURL(e),a=document.createElement("a");a.href=n,a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function Sn(e,t){let a={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(a)){await navigator.share(a);return}await Ze(e,t)}var he;async function Tn(){return he||(he=(async()=>{o("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let a=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(a.map(async i=>{let s=await fetch(new URL(`fonts/${i}`,import.meta.url));if(!s.ok)throw new Error(`Unable to load PDF font ${i}`);n.FS.writeFile(`/fonts/${i}`,new Uint8Array(await s.arrayBuffer()))})),await n.runPythonAsync(`
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
`),o("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw he=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),he}async function At(e,t){let n=await Tn();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",N.sceneNumbers),n.globals.set("_fp_scene_number_format",N.sceneNumberFormat);let a=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),i=a instanceof Uint8Array?a:a.toJs();a.destroy?.();let s={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([i],{type:s[e]})}function $t(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function ot(e,t){return At(e==="/api/render/pdf"?"pdf":"fdx",t)}async function ge(e,t=o("#page-size").value){if(Z)return ot(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat})});if($t(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return Z=!0,ot(e,t);if(!n.ok){let i=await n.json().catch(()=>({}));throw new Error(i.error||"Export failed")}return n.blob()}async function Nn(e){o("#confirm-export").disabled=!0;try{let t=e==="pdf"?await ge("/api/render/pdf",o("#export-page-size").value):await ge("/api/export/fdx");await Sn(t,se(e)),o("#export-dialog").close(),x(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&x(t.message)}finally{o("#confirm-export").disabled=!1}}function Mt(e){o("#export-format").value=e,o("#export-page-size").value=o("#page-size").value,o("#dialog-page-size").hidden=e!=="pdf",o("#export-dialog").showModal()}function ue(){return matchMedia("(max-width: 640px)").matches}async function ve(e){ue()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),j("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=o(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),o("#preview-page-stage").hidden=e!=="live",g.hidden=e!=="live",o("#empty-state").hidden=e!=="live"||!!c.value.trim(),o("#pdf-view").hidden=e!=="pdf",o("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),k(),e==="pdf"&&await xe()}async function xe(){o("#pdf-placeholder").hidden=!1,o("#pdf-frame").hidden=!0;try{let e=await ge("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),o("#pdf-frame").src=r.pdfUrl,o("#pdf-frame").hidden=!1,o("#pdf-placeholder").hidden=!0}catch(e){o("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${w(e.message)}</span>`}}function It(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,o("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),o("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function _n(){let e=document.documentElement.dataset.effectiveTheme||"light";It(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),o(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),o(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(O)}function it(e,t,n,a,i){let s=0,l=0,p=d=>{let f=Math.max(a,Math.min(i,d));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&ce(),r.previewZoom==="fit"&&requestAnimationFrame(O)};e.addEventListener("pointerdown",d=>{s=d.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(d.pointerId)}),e.addEventListener("pointermove",d=>{e.hasPointerCapture(d.pointerId)&&p(l+(d.clientX-s)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",d=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(d.key))return;d.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));d.key==="Home"?p(a):d.key==="End"?p(i):p(f+(d.key==="ArrowRight"?1:-1)*n*(d.shiftKey?30:10))})}function at(e=o("#preview-scroll")){let t=Math.max(0,e.scrollHeight-e.clientHeight),n=Math.max(0,e.scrollWidth-e.clientWidth);e.scrollTop=Math.max(0,Math.min(e.scrollTop,t)),e.scrollLeft=Math.max(0,Math.min(e.scrollLeft,n))}function O(){let e=r.previewZoom,t=o("#zoom"),n=o("#zoom-fit-value");if(o("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),ue()){let l=e==="fit"?1:Number(e)/100;n.hidden=e!=="fit",e==="fit"?(n.textContent="100%",t.value="fit"):t.value=e,g.style.transform="none",g.style.marginBottom="0",g.style.marginRight="0",o("#preview-page-stage").style.removeProperty("width"),o("#preview-page-stage").style.removeProperty("min-height"),g.style.setProperty("--mobile-preview-zoom",l),requestAnimationFrame(()=>at()),k();return}g.style.removeProperty("--mobile-preview-zoom");let a=Number(e)/100;if(e==="fit"){let l=o("#preview-scroll"),p=getComputedStyle(l),d=l.clientWidth-parseFloat(p.paddingLeft)-parseFloat(p.paddingRight);a=Math.max(.25,Math.min(2,d/816))}n.hidden=e!=="fit",e==="fit"?(n.textContent=`${Math.round(a*100)}%`,t.value="fit"):t.value=e;let i=o("#preview-page-stage");i.style.width=`${816*a}px`,i.style.minHeight=`${Math.max(1056,g.scrollHeight)*a}px`,g.style.transform=`scale(${a})`,g.style.marginBottom="0",g.style.marginRight="0";let s=o("#preview-scroll");requestAnimationFrame(()=>{s.scrollLeft=Math.max(0,(s.scrollWidth-s.clientWidth)/2),at(s)}),k()}function Rt(e){let t=["70","85","100","115","130","150","175","200"],n=o("#zoom");if(r.previewZoom==="fit"){let i=Number.parseInt(o("#zoom-fit-value").textContent,10)||100,s=t.map(Number),l=e>0?s.find(p=>p>i)??s.at(-1):[...s].reverse().find(p=>p<i)??s[0];n.value=String(l),r.previewZoom=n.value,O();return}let a=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,a+e))],r.previewZoom=n.value,O()}function Ot(e,t=!0){let n=c.value.split(`
`),a=0;for(let d=0;d<Math.max(0,e-1);d+=1)a+=n[d].length+1;t&&c.focus(),c.setSelectionRange(a,a+(n[e-1]?.length||0)),I({scrollPreview:!0,scrollBlock:"center"});let i=o("#source-highlight"),l=o(`[data-source-line="${Math.max(0,e-1)}"]`,i)?.getClientRects()[0],p=l?l.top-i.getBoundingClientRect().top+i.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),o("#line-numbers").scrollTop=c.scrollTop,o("#source-highlight").scrollTop=c.scrollTop,I({scrollPreview:!0,scrollBlock:"center"})}function kn(e){r.insightLine=e,Ot(e,!1)}var st;function x(e){let t=o("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(st),st=setTimeout(()=>t.classList.remove("show"),2200)}function ee(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function de(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),$()}function Pt(e){let t=ee();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),de(t)}function An(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function $n(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function Ft(e=null,t=null){let n=e===null?"":lt(ee()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},o("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",o("#annotation-text").value=n,o("#delete-annotation").hidden=e===null,o("#annotation-dialog").showModal(),setTimeout(()=>o("#annotation-text").focus(),0)}function te(){let e=o("#preview-context-menu");e.hidden=!0,r.previewContextLine=null,r.previewContextEdit=null,r.previewContextText=""}function A(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function oe(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return g.contains(t.commonAncestorContainer)?e:null}function Mn(e,t,n){let a=(l,p)=>{let d=document.createRange();return d.selectNodeContents(e),d.setEnd(l,p),d.toString().length},i=document.caretPositionFromPoint?.(t,n);if(i&&e.contains(i.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(i.offsetNode,i.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),g.focus({preventScroll:!0}),D(e,a(i.offsetNode,i.offset));return}let s=document.caretRangeFromPoint?.(t,n);if(s&&e.contains(s.startContainer)){let l=getSelection();s.collapse(!0),l?.removeAllRanges(),l?.addRange(s),g.focus({preventScroll:!0}),D(e,a(s.startContainer,s.startOffset));return}g.focus({preventScroll:!0}),J(e,e.textContent.length),D(e)}function In(e,t,n){let a=o("#preview-context-menu"),i=oe();r.previewContextLine=Number(e.dataset.line),r.previewContextEdit=R(A(i?.focusNode)||e),r.previewContextText=i?.toString()||"",a.hidden=!1,a.style.left="0px",a.style.top="0px";let{width:s,height:l}=a.getBoundingClientRect();a.style.left=`${Math.max(8,Math.min(window.innerWidth-s-8,t))}px`;let p=n;if(ue()&&r.previewContextText&&i.rangeCount){let d=i.getRangeAt(0).getBoundingClientRect(),f=d.bottom+12,h=d.top-l-12;p=f+l<=window.innerHeight-8?f:h}a.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,p))}px`}async function Rn(e,t,n={}){let a=Number.isInteger(t)?o(`[data-line="${t}"]`,g):null;if(e==="copy"){let i=oe(),s=n.text||i?.toString()||"";if(!s)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(s),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let i=oe(),s=n.text||i?.toString()||"";if(!s)return"Select text to cut";let l=n.edit||R(A(i?.focusNode)||a);if(!l)return"Select text to cut";try{return await navigator.clipboard.writeText(s),U(l,""),""}catch{try{return document.execCommand("copy")?(U(l,""),""):"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}if(e==="paste"){let i=n.edit||R(a||A(oe()?.focusNode));if(!i)return"Click where you want to paste";try{return U(i,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function On(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},o("#character-note-heading").textContent=`${e} notes`,o("#character-note-text").value=t?.text||"",o("#delete-character-note").hidden=!t,o("#character-note-dialog").showModal(),setTimeout(()=>o("#character-note-text").focus(),0)}function Ht(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},o("#general-note-heading").textContent=t?"Edit general note":"Add general note",o("#general-note-text").value=t?.text||"",o("#delete-general-note").hidden=!t,o("#general-note-dialog").showModal(),setTimeout(()=>o("#general-note-text").focus(),0)}function Ce(e){if(e==null)return;let t=ee();t.splice(e,1),de(t)}var Ee=j(".toolbar-menu");function Xe(e=null){Ee.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{$(),e.inputType==="insertText"?xt():z()});c.addEventListener("scroll",()=>{o("#line-numbers").scrollTop=c.scrollTop,ye(),I(),k()});c.addEventListener("click",()=>{I({scrollPreview:!0}),z(),k()});c.addEventListener("select",()=>{I({scrollPreview:!0}),k()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||I({scrollPreview:!0}),k()});c.addEventListener("keydown",e=>{if(!o("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,Ct();return}if(e.key==="Tab"){e.preventDefault(),Et();return}if(e.key==="Escape"){e.preventDefault(),z();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),xt({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),$()):e.key==="Enter"&&z()});g.addEventListener("beforeinput",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);if(!n)return;let a=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),i=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!a.has(e.inputType)&&!i.has(e.inputType)))if(e.preventDefault(),G(),i.has(e.inputType)){let s=e.inputType.includes("Forward");nn(n,s?"forward":"backward",e.inputType.includes("Word"))}else{let s=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";U(n,s)}});g.addEventListener("input",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(ut(t),dt(t))});g.addEventListener("paste",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);n&&(e.preventDefault(),U(n,e.clipboardData?.getData("text/plain")||""))});g.addEventListener("keydown",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!o("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,pt();return}if(e.key==="Tab"){e.preventDefault(),ft();return}if(e.key==="Escape"){e.preventDefault(),G();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,a=n===-1?nt(t,"first"):n===1&&nt(t,"last");if(n&&a){let i=R(t),s=o(`[data-line="${Number(t.dataset.line)+n}"]`,g);if(i&&i.startLine===i.endLine&&i.startOffset===i.endOffset&&s){e.preventDefault();let l=Math.min(i.startOffset,s.textContent.length);g.focus({preventScroll:!0}),J(s,l),D(s,l)}}});g.addEventListener("focusin",()=>{let e=A(getSelection()?.focusNode);e&&D(e)});g.addEventListener("pointerup",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&ct(n)});g.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&ct(n)});g.addEventListener("focusout",()=>setTimeout(()=>{o("#preview-completion-menu").matches(":hover")||G()},0));g.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),G();let n=oe();(!n||n.isCollapsed)&&Mn(t,e.clientX,e.clientY),In(t,e.clientX,e.clientY)});g.addEventListener("click",e=>{te();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),Ft(Number(t.dataset.annotationLine)))});o("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n,previewContextEdit:a,previewContextText:i}=r,s=t.dataset.previewMenuAction;if(te(),s==="annotation")return Ft(null,n);let l=await Rn(s,n,{edit:a,text:i});l&&x(l)});o("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),ft(Number(t.dataset.index)))});o("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),Et(Number(t.dataset.index)))});o("[data-character-analytics]").addEventListener("click",fn);o("#close-character-analytics").addEventListener("click",()=>o("#character-analytics-dialog").close());o("#copy-character-lines").addEventListener("click",hn);o("#save-character-analytics").addEventListener("click",mn);o("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&kn(Number(t.dataset.line))});o("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&On(t.dataset.characterNote)});o("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&Ht(Number(t.dataset.generalNoteLine))});o("#add-general-note").addEventListener("click",()=>Ht());o("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=ee();if(r.noteEditor.line===null){let a=r.noteEditor.insertAfter+1,i=re(c.value)[a]?.type;n.splice(a,0,`[[${t}]]`),i==="character"&&n[a+1]?.trim()&&n.splice(a+1,0,"")}else n[r.noteEditor.line]=`[[${t}]]`;de(n),o("#annotation-dialog").close()});o("#delete-annotation").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#annotation-dialog").close()});o("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#character-note-text").value.trim();if(!t){Ce(r.noteEditor.line),o("#character-note-dialog").close();return}let n=$n(r.noteEditor.name,t);if(r.noteEditor.line===null)Pt(n);else{let a=ee();a[r.noteEditor.line]=n,de(a)}o("#character-note-dialog").close()});o("#delete-character-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#character-note-dialog").close()});o("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#general-note-text").value.trim();if(!t)return;let n=An(t);if(r.noteEditor.line===null)Pt(n);else{let a=ee();a[r.noteEditor.line]=n,de(a)}o("#general-note-dialog").close()});o("#delete-general-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#general-note-dialog").close()});o("#new-file").addEventListener("click",Lt);o("#open-file").addEventListener("click",St);o("#save-file").addEventListener("click",()=>Ge(!1));o("#save-file-as").addEventListener("click",()=>Ge(!0));o("#github-connect").addEventListener("click",_t);o("#github-open").addEventListener("click",be);o("#github-save").addEventListener("click",be);o("#close-github-dialog").addEventListener("click",()=>o("#github-dialog").close());o("#github-install").addEventListener("click",()=>{r.githubInstallUrl&&Nt(r.githubInstallUrl)});o("#github-disconnect").addEventListener("click",async()=>{try{await Y("/auth/logout",{method:"POST"})}catch{}r.githubConnected=!1,r.githubFile=null,Oe()&&Pe(),Tt(),o("#github-dialog").close(),x("Disconnected from GitHub")});o("#github-repository-search").addEventListener("input",e=>{if(clearTimeout(r.githubRepositoryTimer),!kt(e.target.value)){o("#github-branch").innerHTML="",o("#github-files").innerHTML='<div class="github-empty">No repositories match that search.</div>';return}o("#github-files").innerHTML='<div class="github-empty">Loading repository\u2026</div>',r.githubRepositoryTimer=setTimeout(()=>qe().catch(n=>x(n.message)),250)});o("#github-repository").addEventListener("change",()=>qe().catch(e=>x(e.message)));o("#github-branch").addEventListener("change",()=>we("").catch(e=>x(e.message)));o("#github-breadcrumbs").addEventListener("click",e=>{let t=e.target.closest("[data-github-path]");t&&we(t.dataset.githubPath)});o("#github-files").addEventListener("click",e=>{let t=e.target.closest("[data-github-entry]");t&&(t.dataset.githubType==="dir"?we(t.dataset.githubEntry):En(t.dataset.githubEntry,t))});o("#github-save-here").addEventListener("click",Ln);window.addEventListener("message",async e=>{if(!(e.origin!==Re||!["github-connected","github-installed","github-error"].includes(e.data?.type))){if(e.data.type==="github-error")return x(e.data.message||"GitHub connection failed");await Ye({notify:!0})&&await be()}});o("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,Q(await t.text(),t.name,!0)),e.target.value=""});o("#export-pdf").addEventListener("click",()=>Mt("pdf"));o("#export-fdx").addEventListener("click",()=>Mt("fdx"));o("#export-format").addEventListener("change",e=>{o("#dialog-page-size").hidden=e.target.value!=="pdf"});o("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),Nn(o("#export-format").value))});o("#theme").addEventListener("click",_n);o("#spellcheck").addEventListener("change",()=>{let e=o("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),o("#spellcheck-help").hidden=!e,le(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});o("#word-wrap").addEventListener("change",()=>{let e=o("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),ce()});o("#clear-workspace-on-exit").addEventListener("change",e=>{localStorage.setItem("fountain-publisher.clear-workspace-on-exit",String(e.target.checked)),e.target.checked?Pe():k()});o("#open-background-dialog").addEventListener("click",()=>o("#background-dialog").showModal());o("#preview-background").addEventListener("change",e=>{localStorage.setItem("fountain-publisher.preview-background",e.target.value),Fe()});o("#preview-dot-radius").addEventListener("input",e=>{localStorage.setItem("fountain-publisher.preview-dot-radius",e.target.value),Fe()});o("#page-size").addEventListener("change",()=>{ze(0),r.previewMode==="pdf"&&xe()});j("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ve(e.dataset.previewMode)));o("#toggle-source").addEventListener("click",()=>X("source"));o("#menu-toggle-source").addEventListener("click",()=>X("source"));o("#toggle-stats").addEventListener("click",()=>X("stats"));o("#menu-toggle-stats").addEventListener("click",()=>X("stats"));o("#undo").addEventListener("click",yt);o("#redo").addEventListener("click",Ae);o("#zoom").addEventListener("change",()=>{r.previewZoom=o("#zoom").value,O()});o("#zoom-out").addEventListener("click",()=>Rt(-1));o("#zoom-in").addEventListener("click",()=>Rt(1));o("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",O()});o("#open-docs").addEventListener("click",()=>o("#docs-dialog").showModal());o("#close-docs").addEventListener("click",()=>o("#docs-dialog").close());function Pn(e){let t=c.value;c.value=e+(t?`
`+t:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function M(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,$(),c.focus()}function Fn(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),a=!1,i=null;for(let s of n){let l=s.trim();if(!l){if(a)break;continue}let p=s.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&Me.has(p[1].trim().toLowerCase()))i=p[1].trim().toLowerCase(),t[i]=p[2].trim(),a=!0;else if(a&&i&&/^\s+/.test(s))t[i]=(t[i]?t[i]+" ":"")+l;else break}return t}function Hn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,a=0;for(let i of t){if(!i.trim()){if(n){a+=1;break}a+=1;continue}let l=i.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&Me.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(i))n=!0,a+=1;else break}return a}o("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(a,i)=>{let s=o(`#${a}`).value.trim();s&&t.push(`${i}: ${s}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let a=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let i=c.value,s=Hn(i),l=i.replace(/\r\n?/g,`
`).split(`
`).slice(s).join(`
`);c.value=a+(l?`
`+l:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else Pn(a)}o("#title-page-dialog").close()});function Bt(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(o("#tp-heading").textContent=t,o("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=Fn(c.value),a=i=>n[i]??"";o("#tp-title").value=a("title"),o("#tp-credit").value=a("credit"),o("#tp-author").value=a("author")||a("authors"),o("#tp-date").value=a("draft date")||a("date"),o("#tp-contact").value=a("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});o("#tp-title").value="",o("#tp-credit").value="Written by",o("#tp-author").value="",o("#tp-date").value=n,o("#tp-contact").value=""}o("#title-page-dialog").showModal(),setTimeout(()=>o("#tp-title").focus(),0)}o("#insert-title-page").addEventListener("click",Bt);o("#insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-title-page").addEventListener("click",Bt);o("#menu-insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#menu-insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#menu-insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#menu-insert-transition").addEventListener("click",()=>{M(`CUT TO:

`)});o("#menu-insert-section").addEventListener("click",()=>{M(`# Act 1

`)});o("#menu-insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-centered").addEventListener("click",()=>{M(`> Centered text <

`)});function Bn(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${N.sceneNumbers}`),le(),ze(0),r.previewMode==="pdf"&&xe()}o("#menu-scene-numbers").addEventListener("click",()=>{o("#scene-num-placement").value=N.sceneNumbers,o("#scene-num-format").value=N.sceneNumberFormat,o("#scene-num-dialog").showModal()});o("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),et("sceneNumbers",o("#scene-num-placement").value),et("sceneNumberFormat",o("#scene-num-format").value),Bn(),o("#scene-num-dialog").close())});function Dt(e){document.body.dataset.mobileTab=e,j(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&ue()&&r.previewMode!=="live"?ve("live"):e==="preview"&&r.previewMode==="pdf"&&xe(),e==="source"&&(ce(),Ue(V().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>Ot(r.insightLine,!1))}j(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Dt(e.dataset.mobilePanel)));o("#preview-scroll").addEventListener("scroll",()=>{te(),k()});Ee.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&Xe(e)}));document.addEventListener("pointerdown",e=>Ee.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=o("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&te()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!o("#preview-context-menu").hidden?te():e.key==="Escape"&&Ee.some(t=>t.open)?Xe():(c===document.activeElement||g.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Ae():yt()):(c===document.activeElement||g.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Ae()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),Ge(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),St()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),Lt())});window.addEventListener("beforeunload",()=>{Oe()?Pe():rt()});var $e=0;function Ut(){$e=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function pe(){$e||($e=requestAnimationFrame(Ut))}window.visualViewport?.addEventListener("resize",pe);window.visualViewport?.addEventListener("scroll",pe);window.addEventListener("scroll",pe);document.addEventListener("focusin",pe);window.addEventListener("resize",()=>{pe(),te(),ce(),ue()&&r.previewMode==="pdf"&&ve("live"),O()});async function Dn(){Ut(),It(r.theme),Fe();let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";o("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),o("#clear-workspace-on-exit").checked=Oe(),document.body.classList.add(`scene-nums-${N.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),a=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),a&&document.documentElement.style.setProperty("--stats-w",`${a}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),it(o("#source-resizer"),"--source-w",1,250,650),it(o("#stats-resizer"),"--stats-w",-1,240,520);let i=new URLSearchParams(location.search),s=i.get("demo")==="1"?null:Yt(),l=i.get("demo")==="1"?zt:"",p=i.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(i.has("project"))try{let m=await(await fetch("/api/project")).json();l=m.source,p=m.filename}catch{}let d=s&&(!i.has("project")||s.filename===p);d&&(l=s.source,p=s.filename||p,r.savedSource=typeof s.savedSource=="string"?s.savedSource:l);let f=i.get("demo")!=="1";Q(l,p,!d,d&&s.githubFile||null),Ye(),Dt(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),d&&["fit","70","85","100","115","130","150","175","200"].includes(String(s.zoom))&&(r.previewZoom=String(s.zoom),s.zoom!=="fit"&&(o("#zoom").value=String(s.zoom))),O();let h=["live","pdf"].includes(s?.previewMode)?s.previewMode:"live";await ve(d?h:localStorage.getItem("fountain-publisher.preview")||"live"),d?requestAnimationFrame(()=>{let u=Math.min(Number(s.selectionStart)||0,c.value.length),m=Math.min(Number(s.selectionEnd)||u,c.value.length);c.setSelectionRange(u,m),c.scrollTop=Math.max(0,Number(s.sourceScrollTop)||0),o("#preview-scroll").scrollTop=Math.max(0,Number(s.previewScrollTop)||0),o("#line-numbers").scrollTop=c.scrollTop,ye(),I(),r.cacheEnabled=f,k(),x("Workspace restored")}):(r.cacheEnabled=f,k())}Dn();
