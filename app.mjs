var Wt=`Title: The Last Light
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
`;var o=(e,t=document)=>t.querySelector(e),j=(e,t=document)=>[...t.querySelectorAll(e)],Me=new Set(["title","credit","author","authors","source","draft date","date","contact","copyright","notes"]),zt=/^\[\[FP-(GENERAL|CHARACTER):(.+)\]\]$/,c=o("#source"),g=o("#screenplay-page"),Ie="fountain-publisher.workspace.v1",Re="https://api.fountain-publisher.com",Z=location.hostname.endsWith(".github.io")||new URLSearchParams(location.search).get("static")==="1",N={sceneNumbers:localStorage.getItem("fountain-publisher.scene-numbers")??"margin",sceneNumberFormat:localStorage.getItem("fountain-publisher.scene-number-format")??"sequential"};function Qe(e,t){N[e]=t,localStorage.setItem(`fountain-publisher.${e}`,t)}var r={filename:"Untitled.fountain",handle:null,savedSource:"",metadata:jt(),compileTimer:0,compileRevision:0,compileController:null,completionItems:[],completionIndex:0,previewCompletionItems:[],previewCompletionIndex:0,previewCompletionLine:null,previewMode:"live",pdfUrl:null,insightLine:null,previewZoom:"100",history:[],historyIndex:-1,theme:localStorage.getItem("fountain-publisher.theme")||"system",cacheEnabled:!1,cacheTimer:0,noteEditor:null,previewContextLine:null,previewContextEdit:null,previewContextText:"",githubConnected:!1,githubInstallUrl:"",githubPath:"",githubFile:null};function jt(){return{lineCount:1,wordCount:0,dialogueWords:0,actionWords:0,estimatedSeconds:0,characters:[],scenes:[],sections:[],locations:[],titleFields:[],generalNotes:[],characterNotes:{}}}function Gt(){try{let e=JSON.parse(localStorage.getItem(Ie)||"null");return e?.version===1&&typeof e.source=="string"?e:null}catch{return null}}function st(){if(r.cacheEnabled){clearTimeout(r.cacheTimer);try{localStorage.setItem(Ie,JSON.stringify({version:1,source:c.value,filename:r.filename,savedSource:r.savedSource,selectionStart:c.selectionStart,selectionEnd:c.selectionEnd,sourceScrollTop:c.scrollTop,previewScrollTop:o("#preview-scroll").scrollTop,previewMode:r.previewMode,zoom:r.previewZoom,githubFile:r.githubFile,updatedAt:Date.now()}))}catch{}}}function k(){r.cacheEnabled&&(clearTimeout(r.cacheTimer),r.cacheTimer=setTimeout(st,120))}function Oe(){return localStorage.getItem("fountain-publisher.clear-workspace-on-exit")==="true"}function Pe(){clearTimeout(r.cacheTimer),localStorage.removeItem(Ie)}function Fe(){let e=localStorage.getItem("fountain-publisher.preview-background")||"dots",t=["blank","dots"].includes(e)?e:"dots",n=Number(localStorage.getItem("fountain-publisher.preview-dot-radius")),i=n>=.6&&n<=1.8?n:1,a=o("#preview-scroll");a.dataset.background=t,a.style.setProperty("--preview-dot-radius",`${i}px`),o("#preview-background").value=t,o("#preview-dot-radius").value=String(i),o("#preview-dot-radius-value").textContent=`${i.toFixed(1)}px`,o("#preview-dot-radius-row").hidden=t!=="dots"}function y(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}function He(e){return y(e).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/_(.+?)_/g,"<u>$1</u>")}function Te(e){try{return decodeURIComponent(e)}catch{return e}}function Be(e){let t=e.trim().match(zt);if(!t)return null;if(t[1]==="GENERAL")return{kind:"general",text:Te(t[2])};let n=t[2].indexOf(":");return n<0?null:{kind:"character",name:Te(t[2].slice(0,n)),text:Te(t[2].slice(n+1))}}function rt(e){return e.trim().replace(/^\[\[/,"").replace(/\]\]$/,"")}function Yt(e){let t=[],n={},i=!1;return e.forEach((a,s)=>{if(a.includes("/*")&&(i=!0),i){a.includes("*/")&&(i=!1);return}let l=Be(a);l?.kind==="general"?t.push({line:s,text:l.text}):l?.kind==="character"&&(n[l.name]={line:s,text:l.text})}),{generalNotes:t,characterNotes:n}}function De(e){return/^(?:\.|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .])/i.test(e)}function Kt(e){return e.replace(/^@/,"").replace(/\^$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim()}function qt(e,t){let n=e[t].trim();if(!n||n.length>45||n.endsWith("TO:")||De(n))return!1;let a=n.startsWith("@")||/^[A-Z][A-Z0-9 ._'\-]*(?:\s*\([^)]*\))?\^?$/.test(n),s=t===0||!e[t-1].trim();return a&&s}function se(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=[],i=!0,a=!1,s=!1,l=!1,p=!1;for(let d=0;d<t.length;d+=1){let f=t[d],h=f.trim(),u="action",m=f,b="";if(h.includes("/*")&&(p=!0),p)u="boneyard";else if(!h)u="empty",l=!1,a&&(i=!1),s=!1;else if(i&&/^[A-Za-z][A-Za-z ]+:/.test(f)&&Me.has(f.slice(0,f.indexOf(":")).trim().toLowerCase())){let x=f.indexOf(":");b=f.slice(0,x+1),m=f.slice(x+1).trim(),u=b.toLowerCase()==="title:"?"title-value title":"title-value",a=!0,s=!0,l=!1}else i&&s&&/^\s+/.test(f)?(m=h,u="title-value",l=!1):(i=!1,/^#{1,6}\s/.test(h)?u="section":/^=/.test(h)&&!/^={3,}$/.test(h)?u="synopsis":/^\[\[.*\]\]$/.test(h)?u="note":/^~/.test(h)?(u="lyric",m=f.replace(/^\s*~/,"")):/^={3,}$/.test(h)?u="page-break":De(h)?(u="scene",l=!1):qt(t,d)?(u="character",m=h.replace(/^@/,"").replace(/\^$/,""),l=!0):l&&/^\(.*\)$/.test(h)?u="parenthetical":l?u="dialogue":/^>.*<$/.test(h)?(u="centered",m=h.slice(1,-1).trim()):/^>/.test(h)||/^[A-Z0-9 .'-]+TO:$/.test(h)?u="transition":h.startsWith("!")&&(u="action",m=f.replace(/^\s*!/,"")));n.push({raw:f,display:m,prefix:b,type:u,index:d}),h.includes("*/")&&(p=!1)}return n}function Zt(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=se(e),i=Yt(t),a=new Map,s=[],l=[],p=new Set,d=[],f="",h=0,u="",m=0,b=0,x=0;n.forEach((w,v)=>{let _=(w.display.match(/[\p{L}\p{N}'’-]+/gu)||[]).length;if(w.prefix&&d.push(w.prefix.slice(0,-1)),w.type==="section"){let E=w.raw.trim().match(/^(#{1,6})\s+(.+)$/);E&&(l.push({level:E[1].length,title:E[2],line:v+1}),E[1].length===1&&(u=E[2],m+=1))}else if(w.type==="scene"){let E=w.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"").toUpperCase(),H=w.display.match(/#([^#]+)#/)?.[1]||String(s.length+1);s.push({number:H,heading:E,line:v+1,words:0,act:u||"Screenplay",actNumber:m}),h=s.length;let ne=E.replace(/^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[ .]+/i,"").split(/\s+-\s+/)[0].trim();ne&&p.add(ne),f=""}else if(w.type==="character"){f=Kt(w.display);let E=a.get(f)||{name:f,cues:0,lines:0,words:0,seconds:0,sceneSet:new Set,sceneLineMap:new Map,lastLine:0};E.cues+=1,E.lastLine=v+1,h&&E.sceneSet.add(h),a.set(f,E)}else if(w.type==="dialogue"){let E=a.get(f);E&&(E.lines+=1,E.words+=_,b+=_,h&&E.sceneLineMap.set(h,(E.sceneLineMap.get(h)||0)+1))}else["empty","parenthetical","section","synopsis","note","boneyard","title-value","title-value title"].includes(w.type)||(f="",x+=_,s.length&&(s.at(-1).words+=_))});let P=[...a.values()].map(w=>({...w,seconds:Math.round(w.words/130*60),scenes:w.sceneSet.size,sceneLines:[...w.sceneLineMap].map(([v,_])=>({scene:v,lines:_})),sceneSet:void 0,sceneLineMap:void 0})).sort((w,v)=>v.words-w.words||w.name.localeCompare(v.name)),F=b+x,B=r.metadata?.pageCount??null;return{lineCount:t.length,wordCount:F,dialogueWords:b,actionWords:x,estimatedSeconds:B==null?0:B*60,characters:P,scenes:s,sections:l,locations:[...p].sort(),titleFields:d,pageCount:B,...i}}function Ne(e,t=null,n=null){let i=e.raw.trim().match(/^>\s*(.*?)\s*<$/),a=e.type==="section"?e.raw.trim().match(/^#\s+(Act\b.*)$/i):null,s=i?"centered":e.type,l=`script-line ${s}${a?" act":""}`,p=a?.[1]||e.display,d=a?"#":e.prefix;if(i?p=i[1]:s==="transition"&&e.raw.trim().startsWith(">")&&(p=e.raw.trim().slice(1).trimStart()),t!==null){let b=e.display.replace(/^\./,"").replace(/\s+#[^#]+#\s*$/,"");p=N.sceneNumbers==="inline"?`${t}. ${b}`:b}let f=s==="note"?Be(e.raw):null,h=p?He(p):"<br>",u=t!==null?y(t):"";if(s==="note"&&!f)return"";if(s==="note"&&f)return`<div class="script-line note managed-note" data-line="${e.index}"></div>`;let m=n?`<button class="annotation-orb" type="button" data-annotation-line="${n.index}" title="${y(n.text)}" aria-label="Edit annotation: ${y(n.text)}"></button>`:"";return`<div class="${l}" data-line="${e.index}" data-prefix="${y(d)}" data-scene-number="${u}" data-display="${y(p)}">${h}${m}</div>`}function _e(e,t){let n=e[t+1];return n?.type==="note"&&!Be(n.raw)?{index:n.index,text:rt(n.raw)}:null}function Xt(e){let t=new Map;if(N.sceneNumbers==="off")return t;let n=0,i=0,a=0,s=N.sceneNumberFormat;for(let l of e)l.type==="section"&&/^#\s/.test(l.raw.trimStart())?(i++,a=0):l.type==="scene"&&(n++,a++,t.set(l.index,s==="act"?`A${Math.max(i,1)}S${a}`:String(n)));return t}function Jt(e){let t=Xt(e),n=[];for(let i=0;i<e.length;i+=1){if(e[i].type==="character"){let s=i+1;for(;s<e.length&&["dialogue","parenthetical","note"].includes(e[s].type);)s+=1;for(;s<e.length&&e[s].type==="empty";)s+=1;if(e[s]?.type==="character"&&e[s].raw.trim().endsWith("^")){let l=s+1;for(;l<e.length&&["dialogue","parenthetical","note"].includes(e[l].type);)l+=1;let p=e.slice(i,s).filter(u=>u.type!=="empty"),d=e.slice(s,l),f=p.map((u,m)=>Ne(u,null,_e(p,m))).join(""),h=d.map((u,m)=>Ne(u,null,_e(d,m))).join("");n.push(`<div class="dual-dialog"><div class="dual-left">${f}</div><div class="dual-right">${h}</div></div>`),i=l-1;continue}}let a=t.get(e[i].index)??null;n.push(Ne(e[i],a,_e(e,i)))}return n.join("")}function re({focusLine:e=null,focusOffset:t=null}={}){let n=se(c.value),i=o("#preview-scroll"),a=o("#preview-page-stage"),s=i.scrollTop,l=i.scrollLeft;g.innerHTML=Jt(n),g.spellcheck=o("#spellcheck").checked;let p=n.some(d=>d.raw.trim());if(o("#empty-state").hidden=p,a.hidden=r.previewMode!=="live",g.hidden=r.previewMode!=="live",e!==null){let d=o(`[data-line="${e}"]`,g);if(g.focus({preventScroll:!0}),d){let f=t??d.textContent.length;J(d,f),D(d,f)}}i.scrollTop=s,i.scrollLeft=l,requestAnimationFrame(()=>{i.scrollTop=s,i.scrollLeft=l}),ft(),O()}function J(e,t){let n=Math.max(0,Math.min(t,e.textContent.length)),i=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),a=i.nextNode();for(;a&&n>a.textContent.length;)n-=a.textContent.length,a=i.nextNode();let s=document.createRange();a?s.setStart(a,n):(s.selectNodeContents(e),s.collapse(!1)),s.collapse(!0);let l=getSelection();l.removeAllRanges(),l.addRange(s)}function Vt(e){let t=Array(e.length).fill(!1),n=Array(e.length).fill(!1),i=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let d of e.matchAll(i)){let f=d[1].length;for(let h=d.index;h<d.index+f;h+=1)t[h]=!0;for(let h=d.index+d[0].length-f;h<d.index+d[0].length;h+=1)t[h]=!0,n[h]=!0}let a=t.flatMap((d,f)=>d?[]:[f]),s=Array.from({length:a.length+1},(d,f)=>f<a.length?a[f]:(a.at(-1)??-1)+1),l=Array.from({length:a.length+1},(d,f)=>f?a[f-1]+1:a[0]??0),p=Array.from({length:a.length+1},(d,f)=>{let h=f?a[f-1]+1:0,u=f<a.length?a[f]:e.length;for(;h<u&&n[h];)h+=1;return h});return{startMap:s,endMap:l,caretMap:p}}function Qt(e,t){let n=0,i=t.length,a=t.search(/\S|$/);if(e.classList.contains("centered")){n=t.indexOf(">",a)+1,t[n]===" "&&(n+=1);let s=t.lastIndexOf("<");i=s<n?i:s,t[i-1]===" "&&(i-=1)}else if(e.classList.contains("lyric"))n=t.indexOf("~",a)+1;else if(e.classList.contains("character")&&t.slice(a).startsWith("@"))n=a+1;else if(e.classList.contains("transition")&&t.slice(a).startsWith(">"))for(n=a+1;t[n]===" ";)n+=1;else if(e.dataset.prefix){let s=t.indexOf(e.dataset.prefix,a);for(n=s<0?0:s+e.dataset.prefix.length;t[n]===" ";)n+=1}if(e.classList.contains("scene")){t[n]==="."&&(n+=1);let s=t.slice(n,i).match(/\s+#[^#]+#\s*$/);s&&(i=n+s.index)}return{start:n,end:i,map:Vt(t.slice(n,i))}}function W(e,t,n,i="caret"){let a=Qt(e,t),s=e.dataset.sceneNumber&&N.sceneNumbers==="inline"?`${e.dataset.sceneNumber}. `.length:0,l=Math.max(0,Math.min(n-s,a.map.startMap.length-1)),p=i==="start"?a.map.startMap:i==="end"?a.map.endMap:a.map.caretMap;return a.start+(p[l]??a.end-a.start)}function en(e,t){let n=[],i=/(\*{3}|\*{2}|\*|_)(?=\S)(.+?\S)\1/g;for(let a of e.matchAll(i)){let s=a.index+a[1].length,l=a.index+a[0].length-a[1].length;t>=s&&t<=l&&n.push(a[1])}return n}function et(e,t,n){if(!e.contains(t)&&e!==t)return e.textContent.length;let i=document.createRange();return i.selectNodeContents(e),i.setEnd(t,n),i.toString().length}function R(e=A(getSelection()?.focusNode)){let t=getSelection();if(!e||!t?.rangeCount)return null;let n=t.getRangeAt(0),i=n.startContainer.nodeType===Node.ELEMENT_NODE?n.startContainer:n.startContainer.parentElement,a=n.endContainer.nodeType===Node.ELEMENT_NODE?n.endContainer:n.endContainer.parentElement,s=i?.closest?.(".script-line")||e,l=a?.closest?.(".script-line")||e;return{startLine:s,endLine:l,startOffset:et(s,n.startContainer,n.startOffset),endOffset:et(l,n.endContainer,n.endOffset),direction:!n.collapsed&&t.focusNode===n.startContainer&&t.focusOffset===n.startOffset?"backward":"forward"}}function tt(e,t){let n=getSelection();if(!n?.rangeCount||!e.contains(n.focusNode))return!1;let i=R(e);if(!i||i.startLine!==i.endLine||i.startOffset!==i.endOffset)return!1;if(!e.textContent.length)return!0;let a=document.createRange();a.selectNodeContents(e);let s=[...a.getClientRects()],l=t==="first"?s[0]?.top:s.at(-1)?.top,p=n.getRangeAt(0).cloneRange();p.collapse(!1);let d=[...p.getClientRects()];return d.length?l!==void 0&&d.length>0&&d.every(f=>Math.abs(f.top-l)<1):t==="first"?i.startOffset===0:i.startOffset===e.textContent.length}function ie(e,t,n){return e.slice(0,t).reduce((i,a)=>i+a.length+1,0)+n}function D(e,t=e.textContent.length){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=Number(e.dataset.line),a=W(e,n[i]||"",t),s=ie(n,i,a);c.setSelectionRange(s,s),Ue(i),I()}function lt(e){let t=c.value.replace(/\r\n?/g,`
`).split(`
`),n=Number(e.startLine.dataset.line),i=Number(e.endLine.dataset.line),a=W(e.startLine,t[n]||"",e.startOffset,"start"),s=W(e.endLine,t[i]||"",e.endOffset,"end"),l=ie(t,n,a),p=ie(t,i,s);c.setSelectionRange(l,p,e.direction),Ue(e.direction==="backward"?n:i),I()}function ct(e){let t=Number(e.dataset.line),n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=e.dataset.display??e.textContent,a=e.textContent.replace(/\n/g,""),s=0;for(;s<i.length&&s<a.length&&i[s]===a[s];)s+=1;let l=i.length,p=a.length;for(;l>s&&p>s&&i[l-1]===a[p-1];)l-=1,p-=1;let d=s===l,f=W(e,n[t],s,d?"caret":"start"),h=W(e,n[t],l,d?"caret":"end"),u=n[t].slice(0,f)+a.slice(s,p)+n[t].slice(h);n[t]=u,e.dataset.display=a,e.innerHTML=He(a)||"<br>",J(e,p),c.value=n.join(`
`);let m=ie(n,t,f+p-s);c.setSelectionRange(m,m),$({fromPreview:!0})}function U(e,t){let n=c.value.replace(/\r\n?/g,`
`).split(`
`),i=Number(e.startLine.dataset.line),a=Number(e.endLine.dataset.line),s=e.startLine.textContent.slice(0,e.startOffset),l=e.endLine.textContent.slice(e.endOffset),p=t.replace(/\r\n?/g,`
`),d=`${s}${p}${l}`.split(`
`),f=i===a&&e.startOffset===e.endOffset,h=W(e.startLine,n[i],e.startOffset,f?"caret":"start"),u=W(e.endLine,n[a],e.endOffset,f?"caret":"end"),m=n[a].slice(u),b=i===a?[]:n.slice(i+1,a).filter(v=>/^\s*\[\[.*\]\]\s*$/.test(v));if(i===a&&p.includes(`
`)){let v=en(n[i],h);v.length&&(p=p.replaceAll(`
`,`${[...v].reverse().join("")}
${v.join("")}`))}let x=`${n[i].slice(0,h)}${p}${n[a].slice(u)}`.split(`
`);if(i===a&&e.startLine.classList.contains("centered")&&x.length>1){x[0]=`${x[0].trimEnd()} <`,x[x.length-1]=`> ${x.at(-1).trimStart()}`;for(let v=1;v<x.length-1;v+=1)x[v]=`> ${x[v]} <`}n.splice(i,a-i+1,...x,...b),c.value=n.join(`
`);let P=i+d.length-1,F=d.length===1?s.length+t.length:t.split(/\r\n?|\n/).at(-1).length,B=x.at(-1).length-m.length,w=ie(n,P,Math.max(0,B));c.setSelectionRange(w,w),$({fromPreview:!0}),i===a&&d.length===1?(e.startLine.innerHTML=He(d[0])||"<br>",e.startLine.dataset.display=d[0],g.focus({preventScroll:!0}),J(e.startLine,F),D(e.startLine,F),ut(e.startLine)):re({focusLine:P,focusOffset:F})}function tn(e,t,n=!1){if(e.startLine!==e.endLine||e.startOffset!==e.endOffset)return U(e,"");let i=e.startLine,a=Number(i.dataset.line),s=i.textContent;if(t==="backward"&&e.startOffset>0){let l=s.slice(0,e.startOffset);e.startOffset=n?l.search(/\S+\s*$/):e.startOffset-1}else if(t==="forward"&&e.endOffset<s.length){let l=s.slice(e.endOffset),p=n&&l.match(/^\s*\S+/)?.[0].length||1;e.endOffset+=p}else{let l=j(".script-line[data-display]",g),p=l.indexOf(i),d=l[p+(t==="backward"?-1:1)];if(!d)return;t==="backward"?(e.startLine=d,e.startOffset=d.textContent.length):(e.endLine=d,e.endOffset=0)}U(e,"")}function G(){o("#preview-completion-menu").hidden=!0,r.previewCompletionItems=[],r.previewCompletionLine=null}function ut(e){let t=e.textContent.trim().toUpperCase(),n=t.startsWith("@"),i=n?t.slice(1):t;if(!n&&!/^[A-Z][A-Z0-9 ._'-]*$/.test(i)||n&&!/^[A-Z0-9 ._'-]*$/.test(i))return G();r.previewCompletionItems=r.metadata.characters.map(a=>a.name).filter((a,s,l)=>a.startsWith(i)&&a!==i&&l.indexOf(a)===s),r.previewCompletionIndex=0,r.previewCompletionLine=e,dt()}function dt(){let e=o("#preview-completion-menu");if(!r.previewCompletionItems.length)return G();e.hidden=!1,e.innerHTML=r.previewCompletionItems.map((t,n)=>`<button class="completion-item ${n===r.previewCompletionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.previewCompletionIndex}" data-index="${n}"><span class="completion-icon">@</span><span>${y(t)}</span><small>Character</small></button>`).join(""),nn()}function nn(){let e=o("#preview-completion-menu"),t=r.previewCompletionLine;if(!t)return;let n=o(".preview-panel").getBoundingClientRect(),i=getSelection(),a=t.getBoundingClientRect();if(i?.rangeCount&&t.contains(i.focusNode)){let h=document.createRange();if(h.setStart(i.focusNode,i.focusOffset),h.collapse(!0),a=h.getClientRects()[0]||h.getBoundingClientRect(),!a.width&&!a.height){let u=document.createRange();u.selectNodeContents(t),u.setEnd(i.focusNode,i.focusOffset);let m=u.getBoundingClientRect(),b=t.getBoundingClientRect();a={left:m.right,right:m.right,top:b.top,bottom:b.bottom,width:0,height:b.height}}}let s=Math.min(310,n.width-16),l=Math.max(n.left+8,Math.min(n.right-s-8,a.left)),p=Math.min(e.scrollHeight,245),d=a.bottom+6,f=d+p<=n.bottom-8?d:Math.max(n.top+8,a.top-p-6);e.style.left=`${l}px`,e.style.top=`${f}px`,e.style.right="auto",e.style.bottom="auto"}function pt(e=r.previewCompletionIndex){let t=r.previewCompletionItems[e],n=r.previewCompletionLine;!t||!n||(n.textContent=t,ct(n),G(),g.focus({preventScroll:!0}),J(n,n.textContent.length))}function le(){sn(),ge(),on(),I()}function on(){let e=o("#line-numbers"),t=o("#source-highlight"),n=t.getBoundingClientRect(),i=c.value.split(`
`).map((s,l)=>{let d=o(`[data-source-line="${l}"]`,t)?.getClientRects()[0],f=d?d.top-n.top+t.scrollTop:0;return`<span class="line-number" style="top:${Math.max(0,f)}px">${l+1}</span>`}).join(""),a=Math.max(c.scrollHeight,t.scrollHeight);e.innerHTML=`${i}<span class="line-number-spacer" style="height:${a}px"></span>`,e.scrollTop=c.scrollTop}function an(e){return y(e).replace(/(\[\[|\]\]|\/\*|\*\/|\*{1,3}|_(?=\S)|(?<=\S)_|^~)/g,'<span class="fountain-markup">$1</span>')}function sn(){let e={scene:"scene",character:"character",dialogue:"dialogue",parenthetical:"parenthetical",transition:"transition",section:"section",synopsis:"synopsis",note:"note",boneyard:"boneyard",lyric:"lyric","title-value":"title","title-value title":"title"},t=se(c.value);o("#source-highlight").innerHTML=t.map((n,i)=>{let a=e[n.type],s=an(n.raw)||" ",l=i<t.length-1?`
`:"";return`<span data-source-line="${n.index}"${a?` class="syntax-${a}"`:""}>${s}${l}</span>`}).join("")}function he(e,t=e.scrollLeft){let n=Math.max(0,e.scrollWidth-e.clientWidth);return Math.min(n,Math.max(0,t))}function ge(){let e=o("#source-highlight");e.style.width=c.clientWidth?`${c.clientWidth}px`:"";let t=he(c);t!==c.scrollLeft&&(c.scrollLeft=t),e.scrollTop=c.scrollTop,e.scrollLeft=he(e,t)}function V(){let e=c.selectionStart!==c.selectionEnd&&c.selectionDirection!=="backward"?c.selectionEnd:c.selectionStart,t=c.value.slice(0,e),n=t.split(`
`);return{line:n.length-1,column:n.at(-1).length,start:t.lastIndexOf(`
`)+1}}function rn(e,t="nearest"){let n=o("#preview-scroll"),i=e.getBoundingClientRect(),a=n.getBoundingClientRect(),s=n.scrollTop,l=n.scrollLeft;t==="center"?s+=i.top-a.top-(n.clientHeight-i.height)/2:i.top<a.top?s+=i.top-a.top:i.bottom>a.bottom&&(s+=i.bottom-a.bottom),i.left<a.left?l+=i.left-a.left:i.right>a.right&&(l+=i.right-a.right),n.scrollTop=Math.max(0,s),n.scrollLeft=he(n,l)}function Ue(e,t="nearest"){if(!c.clientHeight)return;let n=o("#source-highlight"),a=o(`[data-source-line="${e}"]`,n)?.getClientRects()[0];if(!a)return;let s=getComputedStyle(c),l=parseFloat(s.paddingTop)||0,p=parseFloat(s.paddingBottom)||0,d=parseFloat(s.lineHeight)||20.15,f=a.top-n.getBoundingClientRect().top+n.scrollTop,h=f+d,u=c.scrollTop;t==="center"?u=f-(c.clientHeight-d)/2:f<c.scrollTop+l?u=f-l:h>c.scrollTop+c.clientHeight-p&&(u=h-c.clientHeight+p),c.scrollTop=Math.max(0,u),ge(),o("#line-numbers").scrollTop=c.scrollTop}function ft(e=!1,t="nearest"){let n=o(`[data-line="${V().line}"]`,g);j(".script-line.source-current",g).forEach(i=>i.classList.remove("source-current")),n?.classList.add("source-current"),e&&r.previewMode==="live"&&n&&rn(n,t)}function I({scrollPreview:e=!1,scrollBlock:t="nearest"}={}){let n=V();o("#cursor-position").textContent=`Ln ${n.line+1}, Col ${n.column+1}`;let i=se(c.value)[n.line]?.type||"action",a={scene:"Scene heading",character:"Character",dialogue:"Dialogue",parenthetical:"Parenthetical",transition:"Transition","title-value":"Title page","title-value title":"Title"};o("#editor-status").textContent=a[i]||i[0].toUpperCase()+i.slice(1);let s=getComputedStyle(c),l=parseFloat(s.lineHeight)||20.15,p=o(`[data-source-line="${n.line}"]`,o("#source-highlight")),d=p?p.getBoundingClientRect().top-c.getBoundingClientRect().top-parseFloat(s.paddingTop):-c.scrollTop;o("#current-line").style.height=`${l}px`,o("#current-line").style.transform=`translateY(${d}px)`,ft(e,t)}function ht(e){r.metadata=e,o("#stat-pages").textContent=e.pageCount??"\u2014",o("#stat-scenes").textContent=e.scenes.length,o("#stat-words").textContent=e.wordCount.toLocaleString(),o("#scene-count").textContent=e.scenes.length,o("#character-count").textContent=e.characters.length,o("#scene-list").innerHTML=un(e),ln(),cn();let t=e.dialogueWords+e.actionWords,n=t?Math.round(e.dialogueWords/t*100):0;o("#dialogue-bar").style.width=`${n}%`,o("#dialogue-percent").textContent=`${n}%`,o("#action-percent").textContent=`${100-n}%`,o("#character-analytics-dialog").open&&We()}function ln(){let e=r.metadata.characters||[],t=r.metadata.characterNotes||{};o("#character-line-table").innerHTML=e.length?`<table><thead><tr><th>Character</th><th>Lines</th></tr></thead><tbody>${e.map(n=>{let i=!!t[n.name]?.text;return`<tr><td><button type="button" data-character-note="${y(n.name)}">${y(n.name)}${i?'<span class="note-indicator" aria-label="Has notes">\u25CF</span>':""}</button></td><td>${n.lines}</td></tr>`}).join("")}</tbody></table>`:'<div class="empty-list">Characters appear as dialogue is written.</div>'}function cn(){let e=r.metadata.generalNotes||[];o("#general-note-count").textContent=e.length,o("#general-notes").innerHTML=e.length?e.map(t=>`<button type="button" data-general-note-line="${t.line}"><span>${y(t.text)}</span><small>Edit</small></button>`).join(""):'<div class="empty-list">No general notes yet.</div>'}function ke(e,t=e.number){return`<li><span class="scene-num">${y(t)}</span><button type="button" data-line="${e.line}">${y(e.heading)}</button></li>`}function un(e){let t=e.scenes||[],n=(e.sections||[]).filter(s=>s.level===1);if(!n.length)return t.length?t.map(s=>ke(s)).join(""):'<li class="empty-list">No scene headings yet.</li>';let i=t.filter(s=>!s.actNumber).map(s=>ke(s)).join(""),a=n.map((s,l)=>{let p=l+1,d=t.filter(f=>f.actNumber===p).map((f,h)=>ke(f,String(h+1))).join("");return`<li class="outline-act"><button class="outline-act-heading" type="button" data-line="${s.line}"><span>${l+1}</span>${y(s.title)}</button><ol>${d||'<li class="empty-list">No scenes in this act.</li>'}</ol></li>`}).join("");return i+a}function q(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function pe(e,t,n){let i=String(t);if(e.measureText(i).width<=n)return i;let a=i;for(;a.length&&e.measureText(`${a}\u2026`).width>n;)a=a.slice(0,-1);return a?`${a}\u2026`:""}function We(){let e=o("#character-analytics-chart"),t=r.metadata.characters,n=r.metadata.scenes,i=Math.min(window.devicePixelRatio||1,2),a=150,s=92,l=28,p=54,d=34,f=n.length?a+n.length*s:480,h=l+p+Math.max(t.length,1)*d;e.width=Math.ceil(f*i),e.height=Math.ceil(h*i),e.style.width=`${f}px`,e.style.height=`${h}px`;let u=e.getContext("2d");u.scale(i,i);let m=q("--surface","#fff"),b=q("--surface-2","#f2f2f2"),x=q("--ink","#202124"),P=q("--muted","#6b7280"),F=q("--border","#d7d9dd"),B=q("--syntax-character","#7c3aed"),w=t.flatMap(S=>(S.sceneLines||[]).map(L=>L.lines)).filter(S=>S>0),v=w.length?Math.min(...w):0,_=w.length?Math.max(...w):0,E=o("#character-analytics-legend");E.hidden=!w.length,o("#character-analytics-min").textContent=`${v} ${v===1?"line":"lines"}`,o("#character-analytics-max").textContent=`${_} ${_===1?"line":"lines"}`,u.fillStyle=m,u.fillRect(0,0,f,h),u.strokeStyle=F,u.lineWidth=1,u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.textBaseline="middle";let H=0;for(;H<n.length;){let S=n[H].act||"Screenplay",L=H+1;for(;L<n.length&&(n[L].act||"Screenplay")===S;)L+=1;let T=a+H*s,K=(L-H)*s;u.fillStyle=b,u.fillRect(T,0,K,l),u.fillStyle=x,u.textAlign="center",u.fillText(pe(u,S,K-12),T+K/2,l/2),u.strokeRect(T+.5,.5,K,l),H=L}u.fillStyle=b,u.fillRect(0,0,a,l+p),u.fillStyle=P,u.textAlign="left",u.fillText("CHARACTER",12,l+p/2);let ne=new Map,Ut=n.map((S,L)=>{if(!S.actNumber)return String(L+1);let T=(ne.get(S.actNumber)||0)+1;return ne.set(S.actNumber,T),String(T)});n.forEach((S,L)=>{let T=a+L*s;u.strokeStyle=F,u.strokeRect(T+.5,l+.5,s,p),u.fillStyle=x,u.textAlign="center",u.fillText(pe(u,Ut[L],s-10),T+s/2,l+16),u.fillStyle=P,u.font="9px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",u.fillText(pe(u,S.heading,s-10),T+s/2,l+36),u.font="600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}),t.forEach((S,L)=>{let T=l+p+L*d;L%2===1&&(u.fillStyle=b,u.fillRect(0,T,a+n.length*s,d)),u.fillStyle=x,u.textAlign="left",u.fillText(pe(u,S.name,a-20),12,T+d/2);let K=new Map((S.sceneLines||[]).map(Se=>[Se.scene,Se.lines]));n.forEach((Se,Xe)=>{let Le=K.get(Xe+1)||0;if(!Le)return;let Je=a+Xe*s+4,Ve=_===v?1:.25+.75*((Le-v)/(_-v));u.save(),u.globalAlpha=Ve,u.fillStyle=B,u.fillRect(Je,T+7,s-8,d-14),u.restore(),u.fillStyle=Ve>=.6?"#fff":x,u.textAlign="center",u.fillText(String(Le),Je+(s-8)/2,T+d/2)})}),n.length||(u.fillStyle=P,u.textAlign="center",u.fillText("Add scene headings to build the timeline.",f/2,l+p+d/2)),e.setAttribute("aria-label",`Character dialogue timeline with ${t.length} characters across ${n.length} scenes; usage ranges from ${v} to ${_} dialogue lines`)}function dn(){return r.metadata.characters.map(e=>`${e.name}, ${e.lines}`).join(`\r
`)}function pn(){We(),o("#character-analytics-dialog").showModal()}async function fn(){try{await navigator.clipboard.writeText(dn()),C("Line usage CSV copied")}catch{C("Clipboard access was denied")}}async function hn(){We();let e=await new Promise(t=>o("#character-analytics-chart").toBlob(t,"image/png"));if(!e){C("Could not create analytics image");return}await qe(e,ae("character-analytics.png")),C("Character analytics PNG saved")}function mn(){r.history[r.historyIndex]!==c.value&&(r.history.splice(r.historyIndex+1),r.history.push(c.value),r.historyIndex=r.history.length-1,r.history.length>250&&(r.history.shift(),r.historyIndex-=1))}function mt(e){if(e<0||e>=r.history.length||e===r.historyIndex)return;let t=g.contains(document.activeElement)?Number(document.activeElement.dataset.line):null,n=c.selectionStart;r.historyIndex=e,c.value=r.history[e],$({fromPreview:t!==null,record:!1}),t!==null?re({focusLine:Math.min(t,c.value.split(`
`).length-1)}):(c.focus(),c.setSelectionRange(Math.min(n,c.value.length),Math.min(n,c.value.length)))}function gt(){mt(r.historyIndex-1)}function Ae(){mt(r.historyIndex+1)}function $({fromPreview:e=!1,record:t=!0}={}){t&&mn(),document.body.classList.toggle("dirty",c.value!==r.savedSource),le(),e||re(),ht(Zt(c.value)),ze(),k()}function ze(e=350){clearTimeout(r.compileTimer),r.compileController?.abort();let t=++r.compileRevision;o("#compile-status").textContent="Editing\u2026",o("#compile-status").classList.remove("error"),r.compileTimer=setTimeout(()=>Z?yt(t):gn(t),Z?Math.max(e,700):e)}function wt(e,t=Z){let n=e instanceof Error?e.message:String(e||"Unknown compiler error"),i=t?`Browser PDF compiler failed: ${n}. Reload the page and try again.`:n.toLowerCase().includes("fetch")?`Desktop compiler unavailable: ${n}. Restart Fountain Publisher and reload the page.`:`Compilation failed: ${n}`;o("#compile-status").textContent=i,o("#compile-status").title=i,o("#compile-status").classList.add("error")}async function yt(e){o("#compile-status").textContent="Compiling\u2026";try{let t=await kt("pdf",o("#page-size").value),n=await bt(t);if(e!==r.compileRevision)return;r.metadata.pageCount=n,r.metadata.estimatedSeconds=n*60,o("#stat-pages").textContent=n,o("#compile-status").textContent="Compiled"}catch(t){if(e!==r.compileRevision)return;wt(t,!0)}}async function gn(e){let t=new AbortController;r.compileController=t,o("#compile-status").textContent="Compiling\u2026";try{let n=await fetch("/api/compile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:o("#page-size").value,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat}),signal:t.signal});if(At(n,"application/json")){Z=!0,await yt(e);return}let i=await n.json();if(!n.ok)throw new Error(i.error||"Compilation failed");if(i.pageCount==null&&(i.pageCount=await bt(await me("/api/render/pdf"))),i.estimatedSeconds=i.pageCount*60,e!==r.compileRevision)return;ht(i),o("#compile-status").textContent="Compiled"}catch(n){if(n.name==="AbortError"||e!==r.compileRevision)return;wt(n,!1)}finally{r.compileController===t&&(r.compileController=null)}}async function bt(e){let t=new Uint8Array(await e.arrayBuffer());return(new TextDecoder("latin1").decode(t).match(/\/Type\s*\/Page\b/g)||[]).length}function wn(){let{line:e,start:t}=V(),n=c.value.split(`
`),a=n[e].slice(0,c.selectionStart-t).trim(),s=a.startsWith("@"),l=e===0||!n[e-1].trim(),p=[],d=(u,m,b="\u0192")=>p.push({value:u,detail:m,icon:b}),f=(s?a.slice(1):a.split(/\s+/).at(-1)).toUpperCase();(s||f&&r.metadata.characters.some(u=>u.name.startsWith(f)))&&r.metadata.characters.forEach(u=>d(u.name,`${u.lines} dialogue lines`,"@")),e<12&&!c.value.slice(0,t).includes(`

`)&&(!a||/^[A-Za-z ]*$/.test(a))&&["Title: ","Credit: ","Author: ","Source: ","Draft date: ","Contact: ","Copyright: ","Notes: "].filter(u=>!r.metadata.titleFields.some(m=>`${m}:`.toLowerCase()===u.trim().toLowerCase())).forEach(u=>d(u,"Title page","T")),/^(?:\.|INT|EXT|EST|I\/E|INT\.?\/EXT\.?).*\s-\s[^-]*$/i.test(a)?["DAY","NIGHT","MORNING","EVENING","LATER","CONTINUOUS","SAME","MOMENTS LATER","DAWN","DUSK"].forEach(u=>d(u,"Time of day","\u25F7")):De(a)||/^(?:INT|EXT|EST|I\/E)/i.test(a)?r.metadata.locations.forEach(u=>d(u,"Existing location","\u2302")):l&&(s||(["INT. ","EXT. ","INT./EXT. ","I/E. "].forEach(u=>d(u,"Scene heading","#")),["FADE IN:",">CUT TO:",">FADE OUT."].forEach(u=>d(u,"Transition","\u2192"))));let h=(s?a.slice(1):a).split(/(?:\s-\s|\s+)/).at(-1).toUpperCase();return p.filter((u,m)=>p.findIndex(b=>b.value===u.value)===m&&(u.icon!=="@"||u.value.toUpperCase()!==f)&&(!h||u.value.toUpperCase().startsWith(h)||u.detail==="Existing location"))}function vt({allowBlank:e=!1}={}){let{line:t,start:n}=V(),i=c.value.split(`
`)[t].slice(0,c.selectionStart-n).trim();if(!e&&!i||(r.completionItems=wn(),r.completionIndex=0,!r.completionItems.length))return z();xt()}function xt(){let e=o("#completion-menu");e.hidden=!1,e.innerHTML=r.completionItems.map((t,n)=>`<button class="completion-item ${n===r.completionIndex?"selected":""}" type="button" role="option" aria-selected="${n===r.completionIndex}" data-index="${n}"><span class="completion-icon">${y(t.icon)}</span><span>${y(t.value)}</span><small>${y(t.detail)}</small></button>`).join(""),yn(),o(".completion-item.selected",e)?.scrollIntoView({block:"nearest"})}function z(){o("#completion-menu").hidden=!0,r.completionItems=[]}function yn(){let e=o("#completion-menu"),t=c.getBoundingClientRect(),n=o("#source-panel").getBoundingClientRect(),i=getComputedStyle(c),a=document.createElement("div"),s=document.body.classList.contains("source-wrap"),l=he(c);Object.assign(a.style,{position:"fixed",visibility:"hidden",pointerEvents:"none",boxSizing:i.boxSizing,left:`${t.left-(s?0:l)}px`,top:`${t.top-c.scrollTop}px`,width:`${s?t.width:Math.max(c.scrollWidth,t.width)}px`,padding:i.padding,border:i.border,font:i.font,letterSpacing:i.letterSpacing,lineHeight:i.lineHeight,whiteSpace:s?"pre-wrap":"pre",overflowWrap:s?"anywhere":"normal",tabSize:i.tabSize}),a.append(document.createTextNode(c.value.slice(0,c.selectionStart)));let p=document.createElement("span");p.textContent="\u200B",a.append(p),document.body.append(a);let d=p.getBoundingClientRect();a.remove();let f=Math.min(310,n.width-16),h=Math.max(n.left+8,Math.min(n.right-f-8,d.left)),u=Math.min(e.scrollHeight,245),m=d.bottom+5,b=m+u<=n.bottom-8?m:Math.max(n.top+8,d.top-u-5);e.style.left=`${h}px`,e.style.top=`${b}px`,e.style.right="auto",e.style.bottom="auto"}function Ct(e=r.completionIndex){let t=r.completionItems[e];if(!t)return;let n=V(),a=c.value.slice(0,c.selectionStart).slice(n.start),s=n.start;if(t.icon==="@"){let p=a.match(/@?[A-Za-z0-9._'-]*$/)?.[0]||"";s=c.selectionStart-p.length}else/\s-\s/.test(a)?s=n.start+a.lastIndexOf("-")+2:a.trim()&&(s=n.start+a.search(/\S/));let l=t.icon==="@"?`
`:"";c.setRangeText(t.value+l,s,c.selectionStart,"end"),z(),$()}async function Et(){await je()&&(r.handle=null,Q("","Untitled.fountain",!0),c.focus())}async function je(){return!document.body.classList.contains("dirty")||window.confirm("Discard unsaved screenplay changes?")}async function St(){if(await je()){if(window.showOpenFilePicker)try{[r.handle]=await window.showOpenFilePicker({types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain",".txt"]}}],multiple:!1});let e=await r.handle.getFile();Q(await e.text(),e.name,!0);return}catch(e){e.name!=="AbortError"&&C(e.message);return}o("#file-input").click()}}function Q(e,t,n=!1,i=null){c.value=e,r.history=[e],r.historyIndex=0,r.filename=t||"Untitled.fountain",n&&(r.savedSource=e),r.githubFile=i,o("#filename").textContent=r.filename,document.title=`${r.filename} \u2014 Fountain Publisher`,$()}async function Ge(e=!1){try{if(window.showSaveFilePicker&&(e||!r.handle)&&(r.handle=await window.showSaveFilePicker({suggestedName:ae("fountain"),types:[{description:"Fountain screenplay",accept:{"text/plain":[".fountain"]}}]})),r.handle){let t=await r.handle.createWritable();await t.write(c.value),await t.close();let n=await r.handle.getFile();r.filename=n.name}else await qe(new Blob([c.value],{type:"text/plain;charset=utf-8"}),ae("fountain"));r.savedSource=c.value,Q(c.value,r.filename,!0),C(`Saved ${r.filename}`)}catch(t){t.name!=="AbortError"&&C(t.message)}}async function Y(e,t={}){let n=await fetch(`${Re}${e}`,{credentials:"include",...t}),i=await n.json().catch(()=>({}));if(!n.ok)throw new Error(i.error||`GitHub request failed (${n.status})`);return i}function Lt(){o("#github-connect").textContent=r.githubConnected?"GitHub browser\u2026":"Connect GitHub\u2026",o("#github-open").disabled=!r.githubConnected,o("#github-save").disabled=!r.githubConnected}async function Ye({notify:e=!1}={}){try{let t=await Y("/api/session");r.githubConnected=!0,r.githubInstallUrl=t.installUrl,o("#github-account").textContent=`Connected as ${t.login}`,e&&C(`Connected to GitHub as ${t.login}`)}catch{r.githubConnected=!1,r.githubInstallUrl="",o("#github-account").textContent="Not connected"}return Lt(),r.githubConnected}function Tt(e){let t=window.open(e,"fountain-publisher-github","popup,width=600,height=760");return t||C("Allow popups to connect GitHub"),t}async function Nt(){if(r.githubConnected)return be();Tt(`${Re}/auth/github/start`)}function we(){let e=o("#github-repository").selectedOptions[0];if(!e?.value)return null;let[t,n]=e.value.split("/");return{owner:t,repo:n,fullName:e.value,defaultBranch:e.dataset.defaultBranch}}function Ke(e=r.githubPath){let t=we(),n=o("#github-branch").value;return t?`/api/contents?${new URLSearchParams({owner:t.owner,repo:t.repo,branch:n,path:e})}`:""}function bn(){let e=r.githubPath?r.githubPath.split("/"):[],t=['<button type="button" data-github-path="">Root</button>'];e.forEach((n,i)=>{t.push("<span>/</span>",`<button type="button" data-github-path="${y(e.slice(0,i+1).join("/"))}">${y(n)}</button>`)}),o("#github-breadcrumbs").innerHTML=t.join("")}async function ye(e=""){r.githubPath=e,bn();let t=o("#github-files");t.innerHTML='<div class="github-empty">Loading repository\u2026</div>';try{let n=await Y(Ke(e)),i=(Array.isArray(n)?n:[n]).filter(a=>a.type==="dir"||/\.(fountain|txt)$/i.test(a.name)).sort((a,s)=>a.type===s.type?a.name.localeCompare(s.name):a.type==="dir"?-1:1);t.innerHTML=i.length?i.map(a=>`<button type="button" role="listitem" data-github-entry="${y(a.path)}" data-github-type="${a.type}"><span>${a.type==="dir"?"\u25B8":"F"}</span><span>${y(a.name)}</span><small>${a.type==="dir"?"Folder":"Fountain"}</small></button>`).join(""):'<div class="github-empty">No Fountain files in this folder.</div>'}catch(n){t.innerHTML=`<div class="github-empty">${y(n.message)}</div>`}}async function _t(){let e=we();if(!e)return;let t=await Y(`/api/branches?${new URLSearchParams({owner:e.owner,repo:e.repo})}`);o("#github-branch").innerHTML=t.branches.map(n=>`<option value="${y(n)}"${n===e.defaultBranch?" selected":""}>${y(n)}</option>`).join(""),await ye("")}async function vn(){let e=await Y("/api/repositories");if(r.githubInstallUrl=e.installUrl,o("#github-install").hidden=!1,o("#github-repository").innerHTML=e.repositories.map(t=>`<option value="${y(t.fullName)}" data-default-branch="${y(t.defaultBranch)}">${y(t.fullName)}${t.private?" \xB7 Private":""}</option>`).join(""),!e.repositories.length){o("#github-files").innerHTML='<div class="github-empty">Install Fountain Publisher on at least one repository to browse files.</div>',o("#github-branch").innerHTML="";return}await _t()}async function be(){if(!r.githubConnected&&!await Ye())return Nt();Ze(),o("#github-filename").value=ae("fountain"),o("#github-dialog").showModal();try{await vn()}catch(e){C(e.message)}}function xn(e){let t=atob(e.replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(t,n=>n.charCodeAt(0)))}async function Cn(e){if(await je())try{let t=we(),n=o("#github-branch").value,i=await Y(Ke(e)),a={owner:t.owner,repo:t.repo,branch:n,path:e,sha:i.sha};r.handle=null,Q(xn(i.content),i.name,!0,a),o("#github-dialog").close(),C(`Opened ${t.fullName}/${e}`)}catch(t){C(t.message)}}async function En(){let e=we(),t=o("#github-branch").value,n=o("#github-filename").value.trim(),i=o("#github-commit-message").value.trim();if(!e||!t||!/^[^/]+\.(fountain|txt)$/i.test(n))return C("Enter a .fountain file name");let a=[r.githubPath,n].filter(Boolean).join("/"),s=r.githubFile,l=s&&s.owner===e.owner&&s.repo===e.repo&&s.branch===t&&s.path===a?s.sha:void 0;try{let p=await Y(Ke(a),{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({content:c.value,message:i||`Update ${n}`,sha:l})});r.githubFile={owner:e.owner,repo:e.repo,branch:t,path:a,sha:p.sha},r.filename=n,r.savedSource=c.value,o("#filename").textContent=n,document.title=`${n} \u2014 Fountain Publisher`,document.body.classList.remove("dirty"),o("#github-dialog").close(),C(`Committed ${e.fullName}/${a}`)}catch(p){C(p.message)}}function ae(e){return`${r.filename.replace(/\.(fountain|txt|pdf|html|fdx)$/i,"")||"screenplay"}.${e}`}async function qe(e,t){let n=URL.createObjectURL(e),i=document.createElement("a");i.href=n,i.download=t,document.body.appendChild(i),i.click(),document.body.removeChild(i),setTimeout(()=>URL.revokeObjectURL(n),1e3)}async function Sn(e,t){let i={files:[new File([e],t,{type:e.type})],title:t};if(matchMedia("(max-width: 640px)").matches&&navigator.share&&navigator.canShare?.(i)){await navigator.share(i);return}await qe(e,t)}var fe;async function Ln(){return fe||(fe=(async()=>{o("#compile-status").textContent="Loading Screenplain\u2026";let e=new URL("pyodide/",import.meta.url),{loadPyodide:t}=await import(new URL("pyodide.mjs",e).href),n=await t({indexURL:e.href});await n.loadPackage("micropip"),n.globals.set("_fp_charset_wheel",new URL("vendor/charset_normalizer-3.4.7-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_reportlab_wheel",new URL("vendor/reportlab-5.0.1-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_pillow_wheel",new URL("vendor/pillow-12.2.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl",import.meta.url).href),n.globals.set("_fp_screenplain_wheel",new URL("vendor/screenplain-0.12.0-py3-none-any.whl",import.meta.url).href),n.globals.set("_fp_six_wheel",new URL("vendor/six-1.17.0-py2.py3-none-any.whl",import.meta.url).href);let i=["CourierPrime-Regular.ttf","CourierPrime-Bold.ttf","CourierPrime-Italic.ttf","CourierPrime-BoldItalic.ttf"];return n.FS.mkdirTree("/fonts"),await Promise.all(i.map(async a=>{let s=await fetch(new URL(`fonts/${a}`,import.meta.url));if(!s.ok)throw new Error(`Unable to load PDF font ${a}`);n.FS.writeFile(`/fonts/${a}`,new Uint8Array(await s.arrayBuffer()))})),await n.runPythonAsync(`
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
`),o("#compile-status").textContent="Screenplain ready",n})().catch(e=>{throw fe=null,new Error(`Unable to initialize the bundled Screenplain PDF compiler: ${e.message}`,{cause:e})})),fe}async function kt(e,t){let n=await Ln();n.globals.set("_fp_source",c.value),n.globals.set("_fp_kind",e),n.globals.set("_fp_page_size",t),n.globals.set("_fp_scene_numbers",N.sceneNumbers),n.globals.set("_fp_scene_number_format",N.sceneNumberFormat);let i=n.runPython("_fp_compile(_fp_source, _fp_kind, _fp_page_size, _fp_scene_numbers, _fp_scene_number_format)"),a=i instanceof Uint8Array?i:i.toJs();i.destroy?.();let s={pdf:"application/pdf",fdx:"application/xml;charset=utf-8"};return new Blob([a],{type:s[e]})}function At(e,t){return[404,405].includes(e.status)||!e.headers.get("Content-Type")?.includes(t)}function nt(e,t){return kt(e==="/api/render/pdf"?"pdf":"fdx",t)}async function me(e,t=o("#page-size").value){if(Z)return nt(e,t);let n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:c.value,pageSize:t,sceneNumbers:N.sceneNumbers,sceneNumberFormat:N.sceneNumberFormat})});if(At(n,e==="/api/render/pdf"?"application/pdf":"application/xml"))return Z=!0,nt(e,t);if(!n.ok){let a=await n.json().catch(()=>({}));throw new Error(a.error||"Export failed")}return n.blob()}async function Tn(e){o("#confirm-export").disabled=!0;try{let t=e==="pdf"?await me("/api/render/pdf",o("#export-page-size").value):await me("/api/export/fdx");await Sn(t,ae(e)),o("#export-dialog").close(),C(`Exported ${e.toUpperCase()}`)}catch(t){t.name!=="AbortError"&&C(t.message)}finally{o("#confirm-export").disabled=!1}}function $t(e){o("#export-format").value=e,o("#export-page-size").value=o("#page-size").value,o("#dialog-page-size").hidden=e!=="pdf",o("#export-dialog").showModal()}function ce(){return matchMedia("(max-width: 640px)").matches}async function ve(e){ce()&&(e="live"),r.previewMode=e,localStorage.setItem("fountain-publisher.preview",e),j("[data-preview-mode]").forEach(t=>{t.classList.toggle("active",t.dataset.previewMode===e);let n=o(".menu-check",t);n&&(n.textContent=t.dataset.previewMode===e?"\u2713":"")}),o("#preview-page-stage").hidden=e!=="live",g.hidden=e!=="live",o("#empty-state").hidden=e!=="live"||!!c.value.trim(),o("#pdf-view").hidden=e!=="pdf",o("#preview-scroll").classList.toggle("pdf-mode",e==="pdf"),k(),e==="pdf"&&await xe()}async function xe(){o("#pdf-placeholder").hidden=!1,o("#pdf-frame").hidden=!0;try{let e=await me("/api/render/pdf");r.pdfUrl&&URL.revokeObjectURL(r.pdfUrl),r.pdfUrl=URL.createObjectURL(e),o("#pdf-frame").src=r.pdfUrl,o("#pdf-frame").hidden=!1,o("#pdf-placeholder").hidden=!0}catch(e){o("#pdf-placeholder").innerHTML=`<strong>PDF preview unavailable</strong><span>${y(e.message)}</span>`}}function Mt(e){r.theme=e,localStorage.setItem("fountain-publisher.theme",e),e==="system"?document.documentElement.removeAttribute("data-theme"):document.documentElement.dataset.theme=e;let t=e==="system"?matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":e;document.documentElement.dataset.effectiveTheme=t,o("#theme-value").textContent=t[0].toUpperCase()+t.slice(1),o("#theme").title=`Switch to ${t==="dark"?"light":"dark"} mode`}function Nn(){let e=document.documentElement.dataset.effectiveTheme||"light";Mt(e==="dark"?"light":"dark")}function X(e,t){let n=t??!document.body.classList.contains(`${e}-collapsed`);document.body.classList.toggle(`${e}-collapsed`,n),localStorage.setItem(`fountain-publisher.${e}-collapsed`,String(n)),o(`#toggle-${e}`).setAttribute("aria-expanded",String(!n)),o(`#menu-toggle-${e}`).textContent=`${n?"Show":"Hide"} ${e==="stats"?"Insights":"Source"}`,r.previewZoom==="fit"&&requestAnimationFrame(O)}function ot(e,t,n,i,a){let s=0,l=0,p=d=>{let f=Math.max(i,Math.min(a,d));document.documentElement.style.setProperty(t,`${f}px`),localStorage.setItem(`fountain-publisher.${t}`,String(f)),e.setAttribute("aria-valuenow",String(Math.round(f))),t==="--source-w"&&le(),r.previewZoom==="fit"&&requestAnimationFrame(O)};e.addEventListener("pointerdown",d=>{s=d.clientX,l=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)),e.setPointerCapture(d.pointerId)}),e.addEventListener("pointermove",d=>{e.hasPointerCapture(d.pointerId)&&p(l+(d.clientX-s)*n)}),e.addEventListener("dblclick",()=>p(t==="--source-w"?370:310)),e.addEventListener("keydown",d=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(d.key))return;d.preventDefault();let f=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t));d.key==="Home"?p(i):d.key==="End"?p(a):p(f+(d.key==="ArrowRight"?1:-1)*n*(d.shiftKey?30:10))})}function it(e=o("#preview-scroll")){let t=Math.max(0,e.scrollHeight-e.clientHeight),n=Math.max(0,e.scrollWidth-e.clientWidth);e.scrollTop=Math.max(0,Math.min(e.scrollTop,t)),e.scrollLeft=Math.max(0,Math.min(e.scrollLeft,n))}function O(){let e=r.previewZoom,t=o("#zoom"),n=o("#zoom-fit-value");if(o("#zoom-fit").setAttribute("aria-pressed",String(e==="fit")),ce()){let l=e==="fit"?1:Number(e)/100;n.hidden=e!=="fit",e==="fit"?(n.textContent="100%",t.value="fit"):t.value=e,g.style.transform="none",g.style.marginBottom="0",g.style.marginRight="0",o("#preview-page-stage").style.removeProperty("width"),o("#preview-page-stage").style.removeProperty("min-height"),g.style.setProperty("--mobile-preview-zoom",l),requestAnimationFrame(()=>it()),k();return}g.style.removeProperty("--mobile-preview-zoom");let i=Number(e)/100;if(e==="fit"){let l=o("#preview-scroll"),p=getComputedStyle(l),d=l.clientWidth-parseFloat(p.paddingLeft)-parseFloat(p.paddingRight);i=Math.max(.25,Math.min(2,d/816))}n.hidden=e!=="fit",e==="fit"?(n.textContent=`${Math.round(i*100)}%`,t.value="fit"):t.value=e;let a=o("#preview-page-stage");a.style.width=`${816*i}px`,a.style.minHeight=`${Math.max(1056,g.scrollHeight)*i}px`,g.style.transform=`scale(${i})`,g.style.marginBottom="0",g.style.marginRight="0";let s=o("#preview-scroll");requestAnimationFrame(()=>{s.scrollLeft=Math.max(0,(s.scrollWidth-s.clientWidth)/2),it(s)}),k()}function It(e){let t=["70","85","100","115","130","150","175","200"],n=o("#zoom");if(r.previewZoom==="fit"){let a=Number.parseInt(o("#zoom-fit-value").textContent,10)||100,s=t.map(Number),l=e>0?s.find(p=>p>a)??s.at(-1):[...s].reverse().find(p=>p<a)??s[0];n.value=String(l),r.previewZoom=n.value,O();return}let i=t.indexOf(n.value);n.value=t[Math.max(0,Math.min(t.length-1,i+e))],r.previewZoom=n.value,O()}function Rt(e,t=!0){let n=c.value.split(`
`),i=0;for(let d=0;d<Math.max(0,e-1);d+=1)i+=n[d].length+1;t&&c.focus(),c.setSelectionRange(i,i+(n[e-1]?.length||0)),I({scrollPreview:!0,scrollBlock:"center"});let a=o("#source-highlight"),l=o(`[data-source-line="${Math.max(0,e-1)}"]`,a)?.getClientRects()[0],p=l?l.top-a.getBoundingClientRect().top+a.scrollTop:0;c.scrollTop=Math.max(0,p-c.clientHeight/2),o("#line-numbers").scrollTop=c.scrollTop,o("#source-highlight").scrollTop=c.scrollTop,I({scrollPreview:!0,scrollBlock:"center"})}function _n(e){r.insightLine=e,Rt(e,!1)}var at;function C(e){let t=o("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(at),at=setTimeout(()=>t.classList.remove("show"),2200)}function ee(){return c.value.replace(/\r\n?/g,`
`).split(`
`)}function ue(e){c.value=e.join(`
`).replace(/\n{3,}$/g,`

`),$()}function Ot(e){let t=ee();for(;t.length&&!t.at(-1).trim();)t.pop();t.length&&t.push(""),t.push(e),ue(t)}function kn(e){return`[[FP-GENERAL:${encodeURIComponent(e)}]]`}function An(e,t){return`[[FP-CHARACTER:${encodeURIComponent(e)}:${encodeURIComponent(t)}]]`}function Pt(e=null,t=null){let n=e===null?"":rt(ee()[e]||"");r.noteEditor={kind:"annotation",line:e,insertAfter:t},o("#annotation-heading").textContent=e===null?"Add annotation":"Edit annotation",o("#annotation-text").value=n,o("#delete-annotation").hidden=e===null,o("#annotation-dialog").showModal(),setTimeout(()=>o("#annotation-text").focus(),0)}function te(){let e=o("#preview-context-menu");e.hidden=!0,r.previewContextLine=null,r.previewContextEdit=null,r.previewContextText=""}function A(e){return e?.nodeType===Node.ELEMENT_NODE?e.closest?.(".script-line"):e?.parentElement?.closest(".script-line")}function oe(){let e=getSelection();if(!e?.rangeCount)return null;let t=e.getRangeAt(0);return g.contains(t.commonAncestorContainer)?e:null}function $n(e,t,n){let i=(l,p)=>{let d=document.createRange();return d.selectNodeContents(e),d.setEnd(l,p),d.toString().length},a=document.caretPositionFromPoint?.(t,n);if(a&&e.contains(a.offsetNode)){let l=getSelection(),p=document.createRange();p.setStart(a.offsetNode,a.offset),p.collapse(!0),l?.removeAllRanges(),l?.addRange(p),g.focus({preventScroll:!0}),D(e,i(a.offsetNode,a.offset));return}let s=document.caretRangeFromPoint?.(t,n);if(s&&e.contains(s.startContainer)){let l=getSelection();s.collapse(!0),l?.removeAllRanges(),l?.addRange(s),g.focus({preventScroll:!0}),D(e,i(s.startContainer,s.startOffset));return}g.focus({preventScroll:!0}),J(e,e.textContent.length),D(e)}function Mn(e,t,n){let i=o("#preview-context-menu"),a=oe();r.previewContextLine=Number(e.dataset.line),r.previewContextEdit=R(A(a?.focusNode)||e),r.previewContextText=a?.toString()||"",i.hidden=!1,i.style.left="0px",i.style.top="0px";let{width:s,height:l}=i.getBoundingClientRect();i.style.left=`${Math.max(8,Math.min(window.innerWidth-s-8,t))}px`;let p=n;if(ce()&&r.previewContextText&&a.rangeCount){let d=a.getRangeAt(0).getBoundingClientRect(),f=d.bottom+12,h=d.top-l-12;p=f+l<=window.innerHeight-8?f:h}i.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,p))}px`}async function In(e,t,n={}){let i=Number.isInteger(t)?o(`[data-line="${t}"]`,g):null;if(e==="copy"){let a=oe(),s=n.text||a?.toString()||"";if(!s)return"Select text to copy";try{if(document.execCommand("copy"))return""}catch{}try{return await navigator.clipboard.writeText(s),""}catch{return"Clipboard access was denied"}}if(e==="cut"){let a=oe(),s=n.text||a?.toString()||"";if(!s)return"Select text to cut";let l=n.edit||R(A(a?.focusNode)||i);if(!l)return"Select text to cut";try{return await navigator.clipboard.writeText(s),U(l,""),""}catch{try{return document.execCommand("copy")?(U(l,""),""):"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}if(e==="paste"){let a=n.edit||R(i||A(oe()?.focusNode));if(!a)return"Click where you want to paste";try{return U(a,await navigator.clipboard.readText()),""}catch{try{return document.execCommand("paste")?"":"Clipboard access was denied"}catch{return"Clipboard access was denied"}}}return"Clipboard access was denied"}function Rn(e){let t=r.metadata.characterNotes?.[e];r.noteEditor={kind:"character",name:e,line:t?.line??null},o("#character-note-heading").textContent=`${e} notes`,o("#character-note-text").value=t?.text||"",o("#delete-character-note").hidden=!t,o("#character-note-dialog").showModal(),setTimeout(()=>o("#character-note-text").focus(),0)}function Ft(e=null){let t=(r.metadata.generalNotes||[]).find(n=>n.line===e);r.noteEditor={kind:"general",line:t?.line??null},o("#general-note-heading").textContent=t?"Edit general note":"Add general note",o("#general-note-text").value=t?.text||"",o("#delete-general-note").hidden=!t,o("#general-note-dialog").showModal(),setTimeout(()=>o("#general-note-text").focus(),0)}function Ce(e){if(e==null)return;let t=ee();t.splice(e,1),ue(t)}var Ee=j(".toolbar-menu");function Ze(e=null){Ee.forEach(t=>{t!==e&&(t.open=!1)})}c.addEventListener("input",e=>{$(),e.inputType==="insertText"?vt():z()});c.addEventListener("scroll",()=>{o("#line-numbers").scrollTop=c.scrollTop,ge(),I(),k()});c.addEventListener("click",()=>{I({scrollPreview:!0}),z(),k()});c.addEventListener("select",()=>{I({scrollPreview:!0}),k()});c.addEventListener("keyup",e=>{["Enter","Tab","Escape"].includes(e.key)||I({scrollPreview:!0}),k()});c.addEventListener("keydown",e=>{if(!o("#completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.completionIndex=(r.completionIndex+(e.key==="ArrowDown"?1:-1)+r.completionItems.length)%r.completionItems.length,xt();return}if(e.key==="Tab"){e.preventDefault(),Ct();return}if(e.key==="Escape"){e.preventDefault(),z();return}}(e.ctrlKey||e.metaKey)&&e.code==="Space"?(e.preventDefault(),vt({allowBlank:!0})):e.key==="Tab"?(e.preventDefault(),c.setRangeText("    ",c.selectionStart,c.selectionEnd,"end"),$()):e.key==="Enter"&&z()});g.addEventListener("beforeinput",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);if(!n)return;let i=new Set(["insertText","insertReplacementText","insertFromPaste","insertFromDrop","insertParagraph","insertLineBreak"]),a=new Set(["deleteContentBackward","deleteContentForward","deleteWordBackward","deleteWordForward","deleteSoftLineBackward","deleteSoftLineForward","deleteByCut","deleteByDrag"]);if(!(!i.has(e.inputType)&&!a.has(e.inputType)))if(e.preventDefault(),G(),a.has(e.inputType)){let s=e.inputType.includes("Forward");tn(n,s?"forward":"backward",e.inputType.includes("Word"))}else{let s=e.inputType==="insertParagraph"||e.inputType==="insertLineBreak"?`
`:e.dataTransfer?.getData("text/plain")||e.data||"";U(n,s)}});g.addEventListener("input",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");t&&(ct(t),ut(t))});g.addEventListener("paste",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;let n=R(t);n&&(e.preventDefault(),U(n,e.clipboardData?.getData("text/plain")||""))});g.addEventListener("keydown",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line");if(!t)return;if(!o("#preview-completion-menu").hidden){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault(),r.previewCompletionIndex=(r.previewCompletionIndex+(e.key==="ArrowDown"?1:-1)+r.previewCompletionItems.length)%r.previewCompletionItems.length,dt();return}if(e.key==="Tab"){e.preventDefault(),pt();return}if(e.key==="Escape"){e.preventDefault(),G();return}}let n=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0,i=n===-1?tt(t,"first"):n===1&&tt(t,"last");if(n&&i){let a=R(t),s=o(`[data-line="${Number(t.dataset.line)+n}"]`,g);if(a&&a.startLine===a.endLine&&a.startOffset===a.endOffset&&s){e.preventDefault();let l=Math.min(a.startOffset,s.textContent.length);g.focus({preventScroll:!0}),J(s,l),D(s,l)}}});g.addEventListener("focusin",()=>{let e=A(getSelection()?.focusNode);e&&D(e)});g.addEventListener("pointerup",e=>{let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&lt(n)});g.addEventListener("keyup",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;let t=A(getSelection()?.focusNode)||e.target.closest(".script-line"),n=R(t);n&&lt(n)});g.addEventListener("focusout",()=>setTimeout(()=>{o("#preview-completion-menu").matches(":hover")||G()},0));g.addEventListener("contextmenu",e=>{let t=e.target.closest(".script-line");if(!t||e.target.closest(".annotation-orb"))return;e.preventDefault(),G();let n=oe();(!n||n.isCollapsed)&&$n(t,e.clientX,e.clientY),Mn(t,e.clientX,e.clientY)});g.addEventListener("click",e=>{te();let t=e.target.closest(".annotation-orb");t&&(e.preventDefault(),Pt(Number(t.dataset.annotationLine)))});o("#preview-context-menu").addEventListener("click",async e=>{let t=e.target.closest("[data-preview-menu-action]");if(!t)return;let{previewContextLine:n,previewContextEdit:i,previewContextText:a}=r,s=t.dataset.previewMenuAction;if(te(),s==="annotation")return Pt(null,n);let l=await In(s,n,{edit:i,text:a});l&&C(l)});o("#preview-completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),pt(Number(t.dataset.index)))});o("#completion-menu").addEventListener("mousedown",e=>{let t=e.target.closest(".completion-item");t&&(e.preventDefault(),Ct(Number(t.dataset.index)))});o("[data-character-analytics]").addEventListener("click",pn);o("#close-character-analytics").addEventListener("click",()=>o("#character-analytics-dialog").close());o("#copy-character-lines").addEventListener("click",fn);o("#save-character-analytics").addEventListener("click",hn);o("#scene-list").addEventListener("click",e=>{let t=e.target.closest("button[data-line]");t&&_n(Number(t.dataset.line))});o("#character-line-table").addEventListener("click",e=>{let t=e.target.closest("[data-character-note]");t&&Rn(t.dataset.characterNote)});o("#general-notes").addEventListener("click",e=>{let t=e.target.closest("[data-general-note-line]");t&&Ft(Number(t.dataset.generalNoteLine))});o("#add-general-note").addEventListener("click",()=>Ft());o("#annotation-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#annotation-text").value.trim().replace(/\s*\n+\s*/g," ").replaceAll("]]","] ]");if(!t)return;let n=ee();if(r.noteEditor.line===null){let i=r.noteEditor.insertAfter+1,a=se(c.value)[i]?.type;n.splice(i,0,`[[${t}]]`),a==="character"&&n[i+1]?.trim()&&n.splice(i+1,0,"")}else n[r.noteEditor.line]=`[[${t}]]`;ue(n),o("#annotation-dialog").close()});o("#delete-annotation").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#annotation-dialog").close()});o("#character-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#character-note-text").value.trim();if(!t){Ce(r.noteEditor.line),o("#character-note-dialog").close();return}let n=An(r.noteEditor.name,t);if(r.noteEditor.line===null)Ot(n);else{let i=ee();i[r.noteEditor.line]=n,ue(i)}o("#character-note-dialog").close()});o("#delete-character-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#character-note-dialog").close()});o("#general-note-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=o("#general-note-text").value.trim();if(!t)return;let n=kn(t);if(r.noteEditor.line===null)Ot(n);else{let i=ee();i[r.noteEditor.line]=n,ue(i)}o("#general-note-dialog").close()});o("#delete-general-note").addEventListener("click",()=>{Ce(r.noteEditor?.line),o("#general-note-dialog").close()});o("#new-file").addEventListener("click",Et);o("#open-file").addEventListener("click",St);o("#save-file").addEventListener("click",()=>Ge(!1));o("#save-file-as").addEventListener("click",()=>Ge(!0));o("#github-connect").addEventListener("click",Nt);o("#github-open").addEventListener("click",be);o("#github-save").addEventListener("click",be);o("#close-github-dialog").addEventListener("click",()=>o("#github-dialog").close());o("#github-install").addEventListener("click",()=>{r.githubInstallUrl&&Tt(r.githubInstallUrl)});o("#github-disconnect").addEventListener("click",async()=>{try{await Y("/auth/logout",{method:"POST"})}catch{}r.githubConnected=!1,r.githubFile=null,Oe()&&Pe(),Lt(),o("#github-dialog").close(),C("Disconnected from GitHub")});o("#github-repository").addEventListener("change",()=>_t().catch(e=>C(e.message)));o("#github-branch").addEventListener("change",()=>ye("").catch(e=>C(e.message)));o("#github-breadcrumbs").addEventListener("click",e=>{let t=e.target.closest("[data-github-path]");t&&ye(t.dataset.githubPath)});o("#github-files").addEventListener("click",e=>{let t=e.target.closest("[data-github-entry]");t&&(t.dataset.githubType==="dir"?ye(t.dataset.githubEntry):Cn(t.dataset.githubEntry))});o("#github-save-here").addEventListener("click",En);window.addEventListener("message",async e=>{if(!(e.origin!==Re||!["github-connected","github-installed","github-error"].includes(e.data?.type))){if(e.data.type==="github-error")return C(e.data.message||"GitHub connection failed");await Ye({notify:!0})&&await be()}});o("#file-input").addEventListener("change",async e=>{let t=e.target.files?.[0];t&&(r.handle=null,Q(await t.text(),t.name,!0)),e.target.value=""});o("#export-pdf").addEventListener("click",()=>$t("pdf"));o("#export-fdx").addEventListener("click",()=>$t("fdx"));o("#export-format").addEventListener("change",e=>{o("#dialog-page-size").hidden=e.target.value!=="pdf"});o("#export-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),Tn(o("#export-format").value))});o("#theme").addEventListener("click",Nn);o("#spellcheck").addEventListener("change",()=>{let e=o("#spellcheck").checked;if(c.spellcheck=e,c.setAttribute("spellcheck",String(e)),o("#spellcheck-help").hidden=!e,re(),e){let t=c.selectionStart,n=c.selectionEnd;c.blur(),c.focus(),c.setSelectionRange(t,n)}});o("#word-wrap").addEventListener("change",()=>{let e=o("#word-wrap").checked;localStorage.setItem("fountain-publisher.word-wrap",String(e)),document.body.classList.toggle("source-wrap",e),c.setAttribute("wrap",e?"soft":"off"),le()});o("#clear-workspace-on-exit").addEventListener("change",e=>{localStorage.setItem("fountain-publisher.clear-workspace-on-exit",String(e.target.checked)),e.target.checked?Pe():k()});o("#open-background-dialog").addEventListener("click",()=>o("#background-dialog").showModal());o("#preview-background").addEventListener("change",e=>{localStorage.setItem("fountain-publisher.preview-background",e.target.value),Fe()});o("#preview-dot-radius").addEventListener("input",e=>{localStorage.setItem("fountain-publisher.preview-dot-radius",e.target.value),Fe()});o("#page-size").addEventListener("change",()=>{ze(0),r.previewMode==="pdf"&&xe()});j("[data-preview-mode]").forEach(e=>e.addEventListener("click",()=>ve(e.dataset.previewMode)));o("#toggle-source").addEventListener("click",()=>X("source"));o("#menu-toggle-source").addEventListener("click",()=>X("source"));o("#toggle-stats").addEventListener("click",()=>X("stats"));o("#menu-toggle-stats").addEventListener("click",()=>X("stats"));o("#undo").addEventListener("click",gt);o("#redo").addEventListener("click",Ae);o("#zoom").addEventListener("change",()=>{r.previewZoom=o("#zoom").value,O()});o("#zoom-out").addEventListener("click",()=>It(-1));o("#zoom-in").addEventListener("click",()=>It(1));o("#zoom-fit").addEventListener("click",()=>{r.previewZoom="fit",O()});o("#open-docs").addEventListener("click",()=>o("#docs-dialog").showModal());o("#close-docs").addEventListener("click",()=>o("#docs-dialog").close());function On(e){let t=c.value;c.value=e+(t?`
`+t:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}function M(e){let t=c.value,n=t?t.endsWith(`

`)?"":t.endsWith(`
`)?`
`:`

`:"";c.value=t+n+e,$(),c.focus()}function Pn(e){let t={},n=e.replace(/\r\n?/g,`
`).split(`
`),i=!1,a=null;for(let s of n){let l=s.trim();if(!l){if(i)break;continue}let p=s.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(p&&Me.has(p[1].trim().toLowerCase()))a=p[1].trim().toLowerCase(),t[a]=p[2].trim(),i=!0;else if(i&&a&&/^\s+/.test(s))t[a]=(t[a]?t[a]+" ":"")+l;else break}return t}function Fn(e){let t=e.replace(/\r\n?/g,`
`).split(`
`),n=!1,i=0;for(let a of t){if(!a.trim()){if(n){i+=1;break}i+=1;continue}let l=a.match(/^([A-Za-z][A-Za-z ]+):(.*)/);if(l&&Me.has(l[1].trim().toLowerCase())||n&&/^\s+/.test(a))n=!0,i+=1;else break}return i}o("#title-page-form").addEventListener("submit",e=>{if(e.submitter?.value!=="default")return;e.preventDefault();let t=[],n=(i,a)=>{let s=o(`#${i}`).value.trim();s&&t.push(`${a}: ${s}`)};if(n("tp-title","Title"),n("tp-credit","Credit"),n("tp-author","Author"),n("tp-date","Draft date"),n("tp-contact","Contact"),t.length){let i=t.join(`
`)+`
`;if(r.metadata.titleFields.length>0){let a=c.value,s=Fn(a),l=a.replace(/\r\n?/g,`
`).split(`
`).slice(s).join(`
`);c.value=i+(l?`
`+l:""),$(),c.setSelectionRange(0,0),c.scrollTop=0,c.focus()}else On(i)}o("#title-page-dialog").close()});function Ht(){let e=r.metadata.titleFields.length>0,t=e?"Edit title page":"Add title page";if(o("#tp-heading").textContent=t,o("#title-page-dialog").querySelector("button.primary").textContent=t,e){let n=Pn(c.value),i=a=>n[a]??"";o("#tp-title").value=i("title"),o("#tp-credit").value=i("credit"),o("#tp-author").value=i("author")||i("authors"),o("#tp-date").value=i("draft date")||i("date"),o("#tp-contact").value=i("contact")}else{let n=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});o("#tp-title").value="",o("#tp-credit").value="Written by",o("#tp-author").value="",o("#tp-date").value=n,o("#tp-contact").value=""}o("#title-page-dialog").showModal(),setTimeout(()=>o("#tp-title").focus(),0)}o("#insert-title-page").addEventListener("click",Ht);o("#insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-title-page").addEventListener("click",Ht);o("#menu-insert-scene").addEventListener("click",()=>{M(`INT. LOCATION - DAY

`)});o("#menu-insert-dialogue").addEventListener("click",()=>{M(`CHARACTER
Dialogue here.

`)});o("#menu-insert-direction").addEventListener("click",()=>{M(`Action description.

`)});o("#menu-insert-transition").addEventListener("click",()=>{M(`CUT TO:

`)});o("#menu-insert-section").addEventListener("click",()=>{M(`# Act 1

`)});o("#menu-insert-pagebreak").addEventListener("click",()=>{M(`===

`)});o("#menu-insert-centered").addEventListener("click",()=>{M(`> Centered text <

`)});function Hn(){document.body.classList.remove("scene-nums-margin","scene-nums-inline","scene-nums-off"),document.body.classList.add(`scene-nums-${N.sceneNumbers}`),re(),ze(0),r.previewMode==="pdf"&&xe()}o("#menu-scene-numbers").addEventListener("click",()=>{o("#scene-num-placement").value=N.sceneNumbers,o("#scene-num-format").value=N.sceneNumberFormat,o("#scene-num-dialog").showModal()});o("#scene-num-form").addEventListener("submit",e=>{e.submitter?.value==="default"&&(e.preventDefault(),Qe("sceneNumbers",o("#scene-num-placement").value),Qe("sceneNumberFormat",o("#scene-num-format").value),Hn(),o("#scene-num-dialog").close())});function Bt(e){document.body.dataset.mobileTab=e,j(".mobile-tab").forEach(t=>t.classList.toggle("active",t.dataset.mobilePanel===e)),localStorage.setItem("fountain-publisher.mobile-tab",e),e==="preview"&&ce()&&r.previewMode!=="live"?ve("live"):e==="preview"&&r.previewMode==="pdf"&&xe(),e==="source"&&(le(),Ue(V().line,"center")),e!=="stats"&&r.insightLine!==null&&requestAnimationFrame(()=>Rt(r.insightLine,!1))}j(".mobile-tab").forEach(e=>e.addEventListener("click",()=>Bt(e.dataset.mobilePanel)));o("#preview-scroll").addEventListener("scroll",()=>{te(),k()});Ee.forEach(e=>e.addEventListener("click",t=>{t.target.closest("button")?e.open=!1:t.target.closest("summary")&&Ze(e)}));document.addEventListener("pointerdown",e=>Ee.forEach(t=>{t.open&&!t.contains(e.target)&&(t.open=!1)}));document.addEventListener("pointerdown",e=>{let t=o("#preview-context-menu");!t.hidden&&!t.contains(e.target)&&te()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!o("#preview-context-menu").hidden?te():e.key==="Escape"&&Ee.some(t=>t.open)?Ze():(c===document.activeElement||g.contains(document.activeElement))&&(e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==="z"?(e.preventDefault(),e.shiftKey?Ae():gt()):(c===document.activeElement||g.contains(document.activeElement))&&e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==="y"?(e.preventDefault(),Ae()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"?(e.preventDefault(),Ge(e.shiftKey)):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="o"?(e.preventDefault(),St()):(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="n"&&(e.preventDefault(),Et())});window.addEventListener("beforeunload",()=>{Oe()?Pe():st()});var $e=0;function Dt(){$e=0;let e=window.visualViewport,t=document.documentElement;t.style.setProperty("--visual-viewport-top",`${e?.offsetTop||0}px`),t.style.setProperty("--visual-viewport-left",`${e?.offsetLeft||0}px`),t.style.setProperty("--visual-viewport-width",`${e?.width||window.innerWidth}px`),t.style.setProperty("--visual-viewport-height",`${e?.height||window.innerHeight}px`)}function de(){$e||($e=requestAnimationFrame(Dt))}window.visualViewport?.addEventListener("resize",de);window.visualViewport?.addEventListener("scroll",de);window.addEventListener("scroll",de);document.addEventListener("focusin",de);window.addEventListener("resize",()=>{de(),te(),le(),ce()&&r.previewMode==="pdf"&&ve("live"),O()});async function Bn(){Dt(),Mt(r.theme),Fe();let e=/Mac/i.test(navigator.platform)||/Mac/i.test(navigator.userAgentData?.platform||"");document.documentElement.dataset.os=e?"mac":"win";let t=localStorage.getItem("fountain-publisher.word-wrap")!=="false";o("#word-wrap").checked=t,document.body.classList.toggle("source-wrap",t),c.setAttribute("wrap",t?"soft":"off"),o("#clear-workspace-on-exit").checked=Oe(),document.body.classList.add(`scene-nums-${N.sceneNumbers}`);let n=Number(localStorage.getItem("fountain-publisher.--source-w")),i=Number(localStorage.getItem("fountain-publisher.--stats-w"));n&&document.documentElement.style.setProperty("--source-w",`${n}px`),i&&document.documentElement.style.setProperty("--stats-w",`${i}px`),X("source",localStorage.getItem("fountain-publisher.source-collapsed")==="true"),X("stats",localStorage.getItem("fountain-publisher.stats-collapsed")==="true"),ot(o("#source-resizer"),"--source-w",1,250,650),ot(o("#stats-resizer"),"--stats-w",-1,240,520);let a=new URLSearchParams(location.search),s=a.get("demo")==="1"?null:Gt(),l=a.get("demo")==="1"?Wt:"",p=a.get("demo")==="1"?"The Last Light.fountain":"Untitled.fountain";if(a.has("project"))try{let m=await(await fetch("/api/project")).json();l=m.source,p=m.filename}catch{}let d=s&&(!a.has("project")||s.filename===p);d&&(l=s.source,p=s.filename||p,r.savedSource=typeof s.savedSource=="string"?s.savedSource:l);let f=a.get("demo")!=="1";Q(l,p,!d,d&&s.githubFile||null),Ye(),Bt(localStorage.getItem("fountain-publisher.mobile-tab")||"source"),d&&["fit","70","85","100","115","130","150","175","200"].includes(String(s.zoom))&&(r.previewZoom=String(s.zoom),s.zoom!=="fit"&&(o("#zoom").value=String(s.zoom))),O();let h=["live","pdf"].includes(s?.previewMode)?s.previewMode:"live";await ve(d?h:localStorage.getItem("fountain-publisher.preview")||"live"),d?requestAnimationFrame(()=>{let u=Math.min(Number(s.selectionStart)||0,c.value.length),m=Math.min(Number(s.selectionEnd)||u,c.value.length);c.setSelectionRange(u,m),c.scrollTop=Math.max(0,Number(s.sourceScrollTop)||0),o("#preview-scroll").scrollTop=Math.max(0,Number(s.previewScrollTop)||0),o("#line-numbers").scrollTop=c.scrollTop,ge(),I(),r.cacheEnabled=f,k(),C("Workspace restored")}):(r.cacheEnabled=f,k())}Bn();
