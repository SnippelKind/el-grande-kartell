'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const PASSWORD = process.env.APP_PASSWORD || 'Wirtschaft';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'finances.json');
const PUBLIC = path.join(__dirname, 'public');
const sessions = new Map();
const MAX_BODY = 16 * 1024;
const SESSION_MS = 12 * 60 * 60 * 1000;
function send(res, status, obj, headers={}) { const body=JSON.stringify(obj); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(body); }
function readBody(req) { return new Promise((resolve,reject)=> { let data=''; req.on('data', chunk=>{data+=chunk; if(data.length>MAX_BODY){reject(new Error('Zu große Anfrage'));req.destroy();}}); req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch{reject(new Error('Ungültiges JSON'));}});req.on('error',reject); }); }
function readData(){try{const data=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));return Array.isArray(data.transactions)?data.transactions:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}}
function writeData(entries){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});const temp=DATA_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify({transactions:entries},null,2));fs.renameSync(temp,DATA_FILE);}
function session(req){const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eg_session='));if(!cookie)return false;const key=cookie.slice('eg_session='.length);const until=sessions.get(key);if(!until)return false;if(until<Date.now()){sessions.delete(key);return false;}return true;}
function secureEqual(a,b){const ha=crypto.createHash('sha256').update(String(a)).digest(),hb=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(ha,hb);}
function safePath(raw){let decoded;try{decoded=decodeURIComponent(raw);}catch{return null;}if(decoded.includes('\0'))return null;const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');const full=path.resolve(PUBLIC,relative);return full.startsWith(PUBLIC+path.sep)?full:null;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const attempts=new Map();
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');const pathname=url.pathname;
    if(pathname==='/api/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress||'unknown';const state=attempts.get(ip)||{count:0,until:0};if(state.until>Date.now())return send(res,429,{error:'Zu viele Versuche. Bitte später erneut versuchen.'});
      const body=await readBody(req);
      if(!secureEqual(body.password||'',PASSWORD)){state.count++;if(state.count>=8){state.until=Date.now()+15*60*1000;state.count=0;}attempts.set(ip,state);return send(res,401,{error:'Passwort ist nicht korrekt.'});}
      attempts.delete(ip);const id=crypto.randomBytes(32).toString('hex');sessions.set(id,Date.now()+SESSION_MS);
      const secure=(req.headers['x-forwarded-proto']==='https'||req.socket.encrypted)?'; Secure':'';
      return send(res,200,{ok:true},{'Set-Cookie':`eg_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`});
    }
    if(pathname==='/api/logout'&&req.method==='POST'){
      const c=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eg_session='));if(c)sessions.delete(c.slice(11));return send(res,200,{ok:true},{'Set-Cookie':'eg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    }
    if(pathname==='/api/session'&&req.method==='GET')return send(res,200,{authenticated:session(req)});
    if(pathname.startsWith('/api/')){
      if(!session(req))return send(res,401,{error:'Bitte erneut anmelden.'});
      if(pathname==='/api/transactions'&&req.method==='GET')return send(res,200,{transactions:readData()});
      if(pathname==='/api/transactions'&&req.method==='POST'){
        const body=await readBody(req);const amount=Number(body.amount);
        if(!['income','expense'].includes(body.type)||typeof body.description!=='string'||!body.description.trim()||body.description.length>140||!Number.isFinite(amount)||amount<=0||amount>1000000000||!/^\d{4}-\d{2}-\d{2}$/.test(body.date||'')||Number.isNaN(Date.parse(body.date))||typeof body.category!=='string'||body.category.length>60)return send(res,400,{error:'Bitte gültige Angaben eingeben.'});
        const tx={id:crypto.randomUUID(),type:body.type,description:body.description.trim(),amount:Math.round(amount*100)/100,category:body.category.trim()||'Sonstiges',date:body.date,createdAt:new Date().toISOString()};const data=readData();data.push(tx);writeData(data);return send(res,201,{transaction:tx});
      }
      const match=pathname.match(/^\/api\/transactions\/([a-f0-9-]+)$/);
      if(match&&req.method==='DELETE'){const old=readData(),updated=old.filter(x=>x.id!==match[1]);if(old.length===updated.length)return send(res,404,{error:'Eintrag nicht gefunden.'});writeData(updated);return send(res,200,{ok:true});}
      return send(res,404,{error:'Nicht gefunden.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Methode nicht erlaubt.'});
    const file=safePath(pathname);if(!file)return send(res,404,{error:'Nicht gefunden.'});
    fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Nicht gefunden');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':pathname==='/'?'no-store':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
  }catch(error){console.error(error);if(!res.headersSent)send(res,500,{error:'Serverfehler. Prüfe die Konsole und den Datenspeicher.'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`El Grande Kartell: http://localhost:${PORT}`));
