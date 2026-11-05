'use strict';
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const dateFmt=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'});
const monthFmt=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'});
let entries=[];let view='overview';
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toDate=s=>new Date(`${s}T12:00:00`);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function notify(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>$('toast').hidden=true,3200)}
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const json=await r.json();if(!r.ok){if(r.status===401&&url!=='/api/login')showLogin();throw Error(json.error||'Fehler beim Laden');}return json;}
function showLogin(){$('loginScreen').hidden=false;$('dashboard').hidden=true;$('password').value='';}
async function showDashboard(){$('loginScreen').hidden=true;$('dashboard').hidden=false;await loadEntries();}
async function loadEntries(){try{entries=(await api('/api/transactions')).transactions;render();}catch(err){notify(err.message)}}
function sorted(){return [...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))}
function row(t,withActions){
  const isIn=t.type==='income';
  const badge=`<span class="type-badge ${isIn?'':'expense'}">${isIn?'Einnahme':'Ausgabe'}</span>`;
  const category=escapeHtml(t.category);
  return `<tr><td>${escapeHtml(dateFmt.format(toDate(t.date)))}</td><td>${escapeHtml(t.description)}</td><td>${withActions?category:`${badge} <span class="category-small">${category}</span>`}</td>${withActions?`<td>${badge}</td>`:''}<td class="right ${isIn?'money-income':'money-expense'}">${isIn?'+':'−'}${money.format(t.amount)}</td>${withActions?`<td class="right"><button class="delete-btn" data-delete="${escapeHtml(t.id)}" aria-label="Buchung löschen">Löschen</button></td>`:''}</tr>`;
}
function fillTable(id,list,actions=false,cols=5){$(id).innerHTML=list.length?list.map(x=>row(x,actions)).join(''):`<tr><td colspan="${cols}" class="empty-cell">Noch keine Buchungen vorhanden.</td></tr>`;}
function render(){const incomes=entries.filter(t=>t.type==='income').reduce((v,t)=>v+t.amount,0),expenses=entries.filter(t=>t.type==='expense').reduce((v,t)=>v+t.amount,0),combined=incomes+expenses;
  $('totalIncome').textContent=money.format(incomes);$('totalExpenses').textContent=money.format(expenses);$('totalBalance').textContent=money.format(incomes-expenses);$('totalCount').textContent=String(entries.length);
  const list=sorted();fillTable('recentTransactions',list.slice(0,5),false,4);
  const filtered=list.filter(t=>($('typeFilter').value==='all'||t.type===$('typeFilter').value)&&`${t.description} ${t.category}`.toLowerCase().includes($('searchInput').value.trim().toLowerCase()));fillTable('allTransactions',filtered,true,6);
  $('incomeBar').style.width=(combined?incomes/combined*100:50)+'%';$('incomeShare').textContent=(combined?Math.round(incomes/combined*100):0)+' %';$('expenseShare').textContent=(combined?Math.round(expenses/combined*100):0)+' %';$('lastEntry').textContent=list.length?dateFmt.format(toDate(list[0].date)):'Noch keine';
  const months=new Map();for(const t of entries){const key=t.date.slice(0,7);if(!months.has(key))months.set(key,{income:0,expense:0});months.get(key)[t.type]+=t.amount;}
  $('monthlyReport').innerHTML=months.size?[...months].sort(([a],[b])=>b.localeCompare(a)).map(([key,v])=>`<tr><td>${escapeHtml(monthFmt.format(toDate(key+'-01')))}</td><td class="right money-income">${money.format(v.income)}</td><td class="right money-expense">${money.format(v.expense)}</td><td class="right">${money.format(v.income-v.expense)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-cell">Noch keine Monatsdaten vorhanden.</td></tr>';
}
function setView(v){view=v;const titles={overview:'Finanzübersicht',transactions:'Transaktionen',reports:'Berichte'};document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==v+'View');document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.view===v));$('pageTitle').textContent=titles[v];$('breadcrumb').textContent=titles[v].toUpperCase();}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').hidden=true;$('loginButton').disabled=true;try{await api('/api/login',{method:'POST',body:JSON.stringify({password:$('password').value})});await showDashboard();}catch(err){$('loginError').textContent=err.message;$('loginError').hidden=false;}finally{$('loginButton').disabled=false;}});
$('togglePassword').addEventListener('click',()=>{const input=$('password');input.type=input.type==='password'?'text':'password';$('togglePassword').setAttribute('aria-label',input.type==='password'?'Passwort anzeigen':'Passwort verbergen')});
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});}catch{}entries=[];showLogin()});
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.jump)));
function openDialog(){$('entryForm').reset();$('entryDate').value=today();$('entryError').hidden=true;$('entryDialog').showModal();}
$('newEntryTop').addEventListener('click',openDialog);$('closeDialog').addEventListener('click',()=>$('entryDialog').close());$('entryDialog').addEventListener('click',e=>{if(e.target===$('entryDialog'))$('entryDialog').close()});
$('entryForm').addEventListener('submit',async e=>{e.preventDefault();const data={type:$('entryType').value,description:$('entryDescription').value,amount:Number($('entryAmount').value),date:$('entryDate').value,category:$('entryCategory').value};try{await api('/api/transactions',{method:'POST',body:JSON.stringify(data)});$('entryDialog').close();await loadEntries();notify('Buchung erfolgreich gespeichert.');}catch(err){$('entryError').textContent=err.message;$('entryError').hidden=false;}});
$('allTransactions').addEventListener('click',async e=>{const btn=e.target.closest('[data-delete]');if(!btn)return;if(!confirm('Diese Buchung wirklich löschen?'))return;try{await api('/api/transactions/'+encodeURIComponent(btn.dataset.delete),{method:'DELETE'});await loadEntries();notify('Buchung gelöscht.')}catch(err){notify(err.message)}});
$('typeFilter').addEventListener('change',render);$('searchInput').addEventListener('input',render);
$('todayLabel').textContent=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());$('year').textContent=new Date().getFullYear();
(async()=>{try{const s=await api('/api/session');if(s.authenticated)await showDashboard();else showLogin();}catch{showLogin();notify('Server nicht erreichbar. Bitte später erneut versuchen.')}})();
