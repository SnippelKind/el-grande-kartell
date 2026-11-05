'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const PASSWORD = process.env.APP_PASSWORD || 'Wirtschaft';
const PUBLIC = path.join(__dirname, 'public');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error('DATABASE_URL fehlt. Neon-Verbindungsadresse in Render als Umgebungsvariable hinterlegen.'); process.exit(1); }
const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
const sessions = new Map();
const attempts = new Map();
const MAX_BODY = 16 * 1024;
const SESSION_MS = 12 * 60 * 60 * 1000;

function send(res, status, obj, headers={}) { const body=JSON.stringify(obj); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body); }
function readBody(req) { return new Promise((resolve,reject)=> { let data=''; req.on('data',chunk=>{data+=chunk; if(Buffer.byteLength(data)>MAX_BODY){reject(new Error('Zu große Anfrage'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(data||'{}'));}catch{reject(new Error('Ungültiges JSON'));}});req.on('error',reject); }); }
function session(req){const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eg_session='));if(!cookie)return false;const key=cookie.slice('eg_session='.length);const until=sessions.get(key);if(!until)return false;if(until<Date.now()){sessions.delete(key);return false;}return true;}
function secureEqual(a,b){const ha=crypto.createHash('sha256').update(String(a)).digest(),hb=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(ha,hb);}
function safePath(raw){let decoded;try{decoded=decodeURIComponent(raw);}catch{return null;}if(decoded.includes('\0'))return null;const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');const full=path.resolve(PUBLIC,relative);return full.startsWith(PUBLIC+path.sep)?full:null;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

async function initialize(){
  await pool.query(`CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description VARCHAR(140) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    category VARCHAR(60) NOT NULL,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'MXN'))
  )`);
  await pool.query("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'");
  await pool.query('CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions (transaction_date DESC, created_at DESC)');
}
const fields = `id, type, description, amount_cents, currency, category, to_char(transaction_date, 'YYYY-MM-DD') AS date, created_at`;
function normalize(r){return {id:r.id,type:r.type,description:r.description,amount:Number(r.amount_cents)/100,currency:r.currency,category:r.category,date:r.date,createdAt:new Date(r.created_at).toISOString()};}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');const pathname=url.pathname;
    if(pathname==='/api/health'&&req.method==='GET') { await pool.query('SELECT 1'); return send(res,200,{ok:true}); }
    if(pathname==='/api/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress||'unknown';const state=attempts.get(ip)||{count:0,until:0};if(state.until>Date.now())return send(res,429,{error:'Zu viele Versuche. Bitte später erneut versuchen.'});
      const body=await readBody(req);
      if(!secureEqual(body.password||'',PASSWORD)){state.count++;if(state.count>=8){state.until=Date.now()+15*60*1000;state.count=0;}attempts.set(ip,state);return send(res,401,{error:'Passwort ist nicht korrekt.'});}
      attempts.delete(ip);const id=crypto.randomBytes(32).toString('hex');sessions.set(id,Date.now()+SESSION_MS);
      const secure=(req.headers['x-forwarded-proto']==='https'||req.socket.encrypted)?'; Secure':'';
      return send(res,200,{ok:true},{'Set-Cookie':`eg_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`});
    }
    if(pathname==='/api/logout'&&req.method==='POST'){
      const c=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('eg_session='));if(c)sessions.delete(c.slice('eg_session='.length));return send(res,200,{ok:true},{'Set-Cookie':'eg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    }
    if(pathname==='/api/session'&&req.method==='GET')return send(res,200,{authenticated:session(req)});
    if(pathname.startsWith('/api/')){
      if(!session(req))return send(res,401,{error:'Bitte erneut anmelden.'});
      if(pathname==='/api/transactions'&&req.method==='GET'){
        const result=await pool.query(`SELECT ${fields} FROM finance_transactions ORDER BY transaction_date DESC, created_at DESC`);
        return send(res,200,{transactions:result.rows.map(normalize)});
      }
      if(pathname==='/api/transactions'&&req.method==='POST'){
        const body=await readBody(req);const amount=Number(body.amount);const currency=body.currency||'USD';
        if(!['income','expense'].includes(body.type)||!['USD','MXN'].includes(currency)||typeof body.description!=='string'||!body.description.trim()||body.description.length>140||!Number.isFinite(amount)||amount<=0||amount>1000000000||!validDate(body.date)||typeof body.category!=='string'||body.category.length>60)return send(res,400,{error:'Bitte gültige Angaben eingeben.'});
        const amountCents=Math.round(amount*100);if(!Number.isSafeInteger(amountCents)||amountCents<=0)return send(res,400,{error:'Ungültiger Betrag.'});
        const result=await pool.query(`INSERT INTO finance_transactions (id,type,description,amount_cents,category,transaction_date,currency) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${fields}`,[crypto.randomUUID(),body.type,body.description.trim(),amountCents,body.category.trim()||'Sonstiges',body.date,currency]);
        return send(res,201,{transaction:normalize(result.rows[0])});
      }
      const match=pathname.match(/^\/api\/transactions\/([a-f0-9-]+)$/);
      if(match&&req.method==='DELETE'){
        const result=await pool.query('DELETE FROM finance_transactions WHERE id = $1 RETURNING id',[match[1]]);
        if(!result.rowCount)return send(res,404,{error:'Eintrag nicht gefunden.'});
        return send(res,200,{ok:true});
      }
      return send(res,404,{error:'Nicht gefunden.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Methode nicht erlaubt.'});
    const file=safePath(pathname);if(!file)return send(res,404,{error:'Nicht gefunden.'});
    fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Nicht gefunden');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':pathname==='/'?'no-store':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);});
  }catch(error){console.error('Server-/Datenbankfehler:',error);if(!res.headersSent)send(res,500,{error:'Datenbank nicht erreichbar oder Serverfehler. Bitte später erneut versuchen.'});}
});
initialize().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`El Grande Kartell mit PostgreSQL: http://localhost:${PORT}`))).catch(error=>{console.error('Datenbankverbindung fehlgeschlagen:',error.message);process.exit(1);});
process.on('SIGTERM',()=>{server.close();pool.end().catch(console.error);});
