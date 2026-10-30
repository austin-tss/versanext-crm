// ===== Expenses: receipt scanning (on-device OCR via Tesseract.js) + Drive/Sheets sync hook
// Sync hook: set window.VNXT_EXPENSE_ENDPOINT (or localStorage.vnxt_exp_endpoint) to the Cloudflare Worker URL.
// Worker contract: POST JSON {expense:{id,date,amount,currency,merchant,category,notes,rep,createdAt}, image:"data:image/jpeg;base64,..."}
//   -> uploads image to the Drive "VNXT Receipts" folder, appends a row to the "VNXT Expenses" Sheet, returns {ok:true,driveFileId,driveUrl,sheetRow}.
// Fields date (YYYY-MM-DD), amount (number), merchant (string) are kept for Amex transaction matching later.
const EXP_EP=()=>window.VNXT_EXPENSE_ENDPOINT||localStorage.vnxt_exp_endpoint||'';
const ECATS=['Meals','Travel','Fuel','Lodging','Office supplies','Software','Client gift','Other'];
function expGuessCat(t){t=t.toLowerCase();return/shell|exxon|chevron|bp\b|marathon|qt\b|quiktrip|fuel|gas|unleaded|diesel/.test(t)?'Fuel':/hotel|inn\b|marriott|hilton|hyatt|lodging|suite/.test(t)?'Lodging':/uber|lyft|airline|delta|parking|toll|taxi|rental car|hertz|avis/.test(t)?'Travel':/restaurant|cafe|coffee|grill|pizza|starbucks|chick|burger|bbq|taco|bar\b|kitchen|server|tip|gratuity|diner/.test(t)?'Meals':/office ?depot|staples|paper|ink|toner|supplies/.test(t)?'Office supplies':/software|subscription|saas|adobe|google|microsoft/.test(t)?'Software':'Other'}
function expParse(txt){const lines=txt.split(/\n/).map(l=>l.trim()).filter(Boolean);
 const merchant=(lines.find(l=>/[a-z]{3}/i.test(l)&&!/receipt|invoice|welcome|thank/i.test(l))||'').replace(/[^\w&'.\- ]/g,'').trim();
 const amt=l=>{const m=[...l.matchAll(/\$?\s?(\d{1,5}(?:,\d{3})*[.,]\d{2})\b/g)].map(x=>parseFloat(x[1].replace(/,(?=\d{3})/g,'').replace(',','.')));return m.length?m[m.length-1]:null};
 let total=null;for(const l of lines){if(/\b(grand\s*)?total\b|amount\s*due|balance\s*due/i.test(l)&&!/sub\s*-?total/i.test(l)){const v=amt(l);if(v!=null)total=v}}
 if(total==null){const all=lines.map(amt).filter(v=>v!=null);total=all.length?Math.max(...all):0}
 let date='',m;if(m=txt.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/)){let y=+m[3];if(y<100)y+=2000;date=`${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`}else if(m=txt.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/))date=m[0];
 else if(m=txt.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)/i)){const mo=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase())+1;date=`${m[3]}-${String(mo).padStart(2,'0')}-${m[2].padStart(2,'0')}`}
 return{merchant,date:date||iso(new Date()),amount:total||0,category:expGuessCat(txt)}}
function loadTess(){return window.Tesseract?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=ok;s.onerror=()=>no(new Error('OCR library failed to load'));document.head.appendChild(s)})}
function shrink(file,max){return new Promise(ok=>{const img=new Image();img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.8))};img.src=URL.createObjectURL(file)})}
async function scanReceipt(file){const st=$('#xst');$('#xrev').innerHTML='';st.innerHTML='<div class=xspin></div> Reading receipt on your device…';
 const big=await shrink(file,1600),thumb=await shrink(file,500);let txt='';
 try{await loadTess();const r=await Tesseract.recognize(big,'eng',{logger:m=>{if(m.status=='recognizing text')st.innerHTML=`<div class=xspin></div> Reading receipt… ${Math.round(m.progress*100)}%`}});txt=r.data.text}catch(e){st.textContent='OCR unavailable ('+e.message+'). Fill in the fields below.'}
 const x=txt?expParse(txt):{merchant:'',date:iso(new Date()),amount:0,category:'Other'};if(txt)st.textContent='✨ Captured. Check the fields, then save.';expReview(x,thumb,txt)}
function expReview(x,img,txt){$('#xrev').innerHTML=`<div class="card dk"><div class=xr><img src="${img}" alt=receipt><div><div class=ex>
<div><label>Merchant</label><input id=x_merchant value="${esc(x.merchant)}"></div><div><label>Date</label><input id=x_date type=date value="${x.date}"></div>
<div><label>Total ($)</label><input id=x_amount type=number step=.01 inputmode=decimal value="${(+x.amount).toFixed(2)}"></div><div><label>Category</label><select id=x_category>${ECATS.map(c=>`<option ${c==x.category?'selected':''}>${c}</option>`).join('')}</select></div></div>
<label>Customer / deal (optional)</label><select id=x_cust><option value="">—</option>${(D.customers||[]).map(c=>`<option value=${c.id}>${esc(c.name)}</option>`).join('')}</select><label>Notes</label><input id=x_notes placeholder="e.g. Lunch with Sarah, Acme"></div></div>
${txt?`<details><summary>Raw OCR text</summary><pre>${esc(txt)}</pre></details>`:''}<br><button class=btn id=x_save>✔ Save expense</button> <button class="btn g" onclick="$('#xrev').innerHTML='';$('#xst').textContent=''">Discard</button></div>`;
 $('#x_save').onclick=async()=>{const e={id:uid(),date:$('#x_date').value,amount:+(+$('#x_amount').value).toFixed(2),currency:'USD',merchant:$('#x_merchant').value.trim()||'Unknown merchant',category:$('#x_category').value,customerId:+$('#x_cust').value||undefined,notes:$('#x_notes').value,rep:'William Griffin',createdAt:new Date().toISOString(),img,sync:'local'};
  D.expenses.unshift(e);try{save()}catch(err){e.img='';save();toast('Saved without image (storage full)')}await syncExp(e);view('expenses');toast('✔ Expense saved: '+e.merchant+' '+money2(e.amount))}}
const money2=n=>'$'+(+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
async function syncExp(e){if(!EXP_EP())return;try{const r=await fetch(EXP_EP(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expense:{...e,img:undefined},image:e.img})});const j=await r.json();if(r.ok&&j.ok){e.sync='drive';e.driveUrl=j.driveUrl}else e.sync='error'}catch(err){e.sync='error'}save()}
function expView(){const ex=D.expenses,mo=iso(new Date()).slice(0,7),mt=ex.filter(e=>e.date.startsWith(mo)).reduce((s,e)=>s+e.amount,0);
 return`<div class="card dk"><h1>Expenses</h1><p class=tag>Snap a receipt. VNXT reads it on your phone and logs it.</p>
<label class=xsnap for=xfile><span>📷</span><b>Scan a receipt</b><small>Take a photo or upload</small></label><input id=xfile type=file accept="image/*" capture=environment hidden>
<p id=xst class=hint></p><div class=kpi style="grid-template-columns:1fr 1fr"><div>This month<b>${money2(mt)}</b></div><div>Receipts<b>${ex.length}</b></div></div>
<p class=hint>Sync: ${EXP_EP()?'🟢 Google Drive sync on':'⚪ Saved on this device. Google Drive sync turns on once the VNXT Worker is connected.'}</p></div><div id=xrev></div>
<div class="card dk"><h2>Recent expenses</h2>${ex.map(e=>`<div class=xi>${e.img?`<img src="${e.img}" alt="">`:'<span class=xph>🧾</span>'}<div><b>${esc(e.merchant)}</b><small>${e.date} · ${e.category}${e.customerId&&custById(e.customerId)?' · '+esc(custById(e.customerId).name):''}</small></div><div class=xa><b>${money2(e.amount)}</b><small>${e.sync=='drive'?'☁️ Drive':e.sync=='error'?'⚠️ Sync failed':'📱 Local'}</small></div></div>`).join('')||'<p class=hint>No expenses yet.</p>'}
${ex.length?`<br><button class="btn g" onclick=expCSV()>⬇ Export CSV (Amex-matchable)</button>`:''}</div>`}
function expCSV(){const rows=[['date','amount','merchant','category','customer','notes','id']].concat(D.expenses.map(e=>[e.date,e.amount.toFixed(2),e.merchant,e.category,e.customerId&&custById(e.customerId)?custById(e.customerId).name:'',e.notes,e.id]));const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='vnxt-expenses.csv';a.click()}
const _view2=view;
view=function(v){document.body.classList.toggle('dark',v=='expenses');if(!D.expenses)D.expenses=[];if(v!='expenses')return _view2(v);
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v==v));app.innerHTML=expView();$('#xfile').onchange=e=>{const f=e.target.files[0];if(f)scanReceipt(f)};scrollTo(0,0)};
const _od=openDeal;openDeal=function(id){document.body.classList.remove('dark');_od(id)};const _oc=openCust;openCust=function(id){document.body.classList.remove('dark');_oc(id)};
