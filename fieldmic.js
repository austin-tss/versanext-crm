// ===== Field mic: "Speak with Gemini" on every input/select/textarea (keypad excepted)
// Speech -> transcript (browser SpeechRecognition) -> Gemini via Worker (window.VNXT_GEMINI_ENDPOINT / localStorage.vnxt_gemini_endpoint)
// Worker contract: POST {transcript, field:{label,type,options:[{value,text}],current}, today, tz} -> {value}. The Gemini API key lives ONLY in the Worker.
// No endpoint (or it fails) -> local rule-based parser below, so it works today.
const FieldMic=(()=>{const EP=()=>window.VNXT_GEMINI_ENDPOINT||localStorage.vnxt_gemini_endpoint||'';
 const DIG={zero:0,oh:0,o:0,one:1,two:2,to:2,too:2,three:3,four:4,for:4,five:5,six:6,seven:7,eight:8,ate:8,nine:9};
 const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="#6fd0ff" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
 function meta(el){let lab=el.getAttribute('aria-label')||'';const w=el.closest('.fm')?.parentElement;const l=w&&[...w.children].find(x=>x.tagName=='LABEL');if(!lab&&l)lab=l.textContent;if(!lab&&el.id){const f=document.querySelector(`label[for="${el.id}"]`);if(f)lab=f.textContent}if(!lab)lab=el.placeholder||el.name||el.id;
  const type=el.tagName=='SELECT'?'select':el.tagName=='TEXTAREA'?'textarea':(el.type||'text');const o={label:lab.trim(),type,current:el.value};if(type=='select')o.options=[...el.options].map(x=>({value:x.value,text:x.text}));const dl=el.list;if(dl)o.suggestions=[...dl.options].map(x=>x.value);return o}
 const num=t=>{t=wordsToNum(t.toLowerCase()).replace(/,/g,'');const m=t.match(/(-?\d+(?:\.\d+)?)\s*(k|thousand|grand)?/);if(!m)return'';let v=+m[1];if(m[2])v*=1000;return/\bcents?\b/.test(t)?v:String(v)};
 function tparse(t){t=wordsToNum(t.toLowerCase());if(/\bnoon\b/.test(t))return'12:00';const m=t.match(/\b(\d{1,2})(?::(\d\d)|\s+(\d\d)\b)?\s*(a\.?m\.?|p\.?m\.?|in the morning|in the afternoon|in the evening|at night)?/);if(!m)return'';let h=+m[1];const mi=m[2]||m[3]||'00',ap=m[4]||'';if(/p|afternoon|evening|night/.test(ap)&&h<12)h+=12;else if(/a|morning/.test(ap)&&h==12)h=0;else if(!ap&&h<8)h+=12;return String(h).padStart(2,'0')+':'+mi}
 function local(t,f){const raw=t.trim(),l=raw.toLowerCase();
  if(f.type=='date')return parseDate(raw)||(()=>{const d=new Date(raw);return isNaN(d)?'':iso(d)})();
  if(f.type=='time')return tparse(raw);
  if(f.type=='datetime-local'){const d=parseDate(raw.replace(/\bat\b.*$/,''))||parseDate(raw)||iso(new Date()),tm=tparse((raw.match(/\bat\b(.*)$/)||[,''])[1]||'')||'09:00';return d+'T'+tm}
  if(f.type=='number')return num(raw);
  if(f.type=='email')return l.replace(/\s+at\s+/g,'@').replace(/\s+dot\s+/g,'.').replace(/\s+(underscore)\s+/g,'_').replace(/\s+(dash|hyphen)\s+/g,'-').replace(/\s+/g,'');
  if(f.type=='tel'||/phone|mobile|cell/i.test(f.label)&&!/email/i.test(f.label)&&/\d|zero|one|two|three|four|five|six|seven|eight|nine/.test(l)&&!/@| at /.test(l)){const ds=l.replace(/[^a-z0-9]+/g,' ').split(' ').map(w=>w in DIG?DIG[w]:/^\d+$/.test(w)?w:'').join('');if(ds.length>=7){const d=ds.slice(-10);return d.length==10?`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`:d}}
  if(f.type=='select'){const opts=f.options||[];const sc=o=>{const x=(o.text+' '+o.value).toLowerCase();if(l==o.text.toLowerCase())return 100;if(l.includes(o.text.toLowerCase()))return 50+o.text.length;return x.split(/\W+/).filter(w=>w.length>2&&l.includes(w)).length*10};const best=opts.map(o=>[sc(o),o]).sort((a,b)=>b[0]-a[0])[0];return best&&best[0]>0?best[1].value:null}
  if(f.suggestions&&f.suggestions.length){const s=f.suggestions.find(s=>l.includes(s.toLowerCase())||s.toLowerCase().includes(l)||s.toLowerCase().split(' ')[0]==l.split(' ')[0]);if(s)return s}
  if(/name|contact|company|merchant|customer|target/i.test(f.label))return raw.replace(/\b\w/g,c=>c.toUpperCase());
  return raw.charAt(0).toUpperCase()+raw.slice(1)}
 async function interpret(t,f){if(EP()){try{const r=await fetch(EP(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transcript:t,field:f,today:iso(new Date()),tz:Intl.DateTimeFormat().resolvedOptions().timeZone})});if(r.ok){const j=await r.json();if(j&&j.value!=null)return{value:String(j.value),src:'gemini'}}}catch(e){}}return{value:local(t,f),src:'local'}}
 function setVal(el,v){if(v==null||v===''){toast('Didn’t catch a value for that field. Try again.');return false}el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true}
 let active=null;
 function listen(el,btn){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(active){active.stop();return}if(!SR){toast('Voice needs Chrome, Edge or Safari.');return}if(typeof recOn!='undefined'&&recOn)toggleMic();
  const r=new SR();r.lang='en-US';r.interimResults=true;r.continuous=false;let tx='';const tip=document.createElement('span');tip.className='fmt';tip.textContent='Listening…';btn.parentElement.appendChild(tip);btn.classList.add('on');active=r;
  r.onresult=e=>{tx=[...e.results].map(x=>x[0].transcript).join(' ');tip.textContent=tx};
  r.onerror=e=>{if(e.error=='not-allowed')toast('Microphone blocked. Allow mic access.')};
  r.onend=async()=>{active=null;btn.classList.remove('on');if(!tx.trim()){tip.remove();return}btn.classList.add('busy');tip.textContent='Gemini…';const f=meta(el);const res=await FieldMic.interpret(tx,f);btn.classList.remove('busy');tip.remove();if(setVal(el,res.value))el.focus()};try{r.start()}catch(e){active=null;btn.classList.remove('on');tip.remove()}}
 function attach(el){if(el.dataset.fm||el.closest('#login')||el.hasAttribute('data-nomic')||['hidden','file','checkbox','radio','submit','button','password'].includes(el.type))return;el.dataset.fm=1;
  const w=document.createElement('span');w.className='fm';el.parentNode.insertBefore(w,el);w.appendChild(el);const b=document.createElement('button');b.type='button';b.className='fmb';b.title='Speak with Gemini';b.setAttribute('aria-label','Speak with Gemini: '+(meta(el).label||'field'));b.innerHTML=ICON;b.onclick=e=>{e.preventDefault();e.stopPropagation();listen(el,b)};w.appendChild(b)}
 function scan(root){(root||document).querySelectorAll('input,select,textarea').forEach(attach)}
 new MutationObserver(()=>scan(document.body)).observe(document.body,{childList:true,subtree:true});scan();
 return{interpret,local,attach,scan}})();
