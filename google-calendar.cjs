// Google Agenda via OAuth (app para computador, loopback + PKCE) e API Calendar somente leitura.
const crypto=require('crypto'),fs=require('fs'),fsp=fs.promises,http=require('http'),path=require('path');
const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth',TOKEN_URL='https://oauth2.googleapis.com/token',REVOKE_URL='https://oauth2.googleapis.com/revoke';
const API='https://www.googleapis.com/calendar/v3',SCOPE='https://www.googleapis.com/auth/calendar.readonly',WEB_URL='https://calendar.google.com/calendar/r';
const CONFIG_FILE='google-calendar-config.bin',TOKENS_FILE='google-calendar-tokens.bin';
// Public application identifier registered for Flow Desktop; never an account token.
const FLOW_CLIENT_ID='';
const MAX_CONFIG_BYTES=64*1024,MAX_PAGES=25,FETCH_TIMEOUT=15000,CONNECT_TIMEOUT=3*60*1000;

class SafeError extends Error{constructor(message,code){super(message);this.code=code;}}
const cancelled=()=>new SafeError('Conexão com o Google Agenda cancelada','cancelled');
const b64=buf=>buf.toString('base64url');
function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}

function isCalendarLink(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  return u.hostname==='calendar.google.com'||(u.hostname==='www.google.com'&&(u.pathname==='/calendar'||u.pathname.startsWith('/calendar/')));}catch{return false;}
}
function parseClientConfig(json){
 const c=json&&typeof json==='object'?json.installed:null;
 if(!c||typeof c!=='object')throw new SafeError(json&&json.web?'Use um cliente OAuth do tipo "App para computador"':'Arquivo não é um cliente OAuth de app para computador');
 const clientId=c.client_id,clientSecret=c.client_secret;
 if(typeof clientId!=='string'||!/^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/.test(clientId))throw new SafeError('client_id inválido no arquivo de configuração');
 if(clientSecret!=null&&(typeof clientSecret!=='string'||!clientSecret||clientSecret.length>256||/[\s\u0000-\u001f]/.test(clientSecret)))throw new SafeError('client_secret inválido no arquivo de configuração');
 return clientSecret?{clientId,clientSecret}:{clientId};
}
function localIso(d){
 const p=n=>String(Math.abs(n)).padStart(2,'0'),off=-d.getTimezoneOffset();
 return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off>=0?'+':'-'}${p(Math.trunc(off/60))}:${p(off%60)}`;
}
function monthRange(month){
 const m=typeof month==='string'&&/^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
 if(!m||+m[1]<1970||+m[1]>2100)throw new SafeError('Mês inválido (use AAAA-MM)');
 return {timeMin:localIso(new Date(+m[1],+m[2]-1,1)),timeMax:localIso(new Date(+m[1],+m[2],1))};
}
function validCalendarId(id){
 if(typeof id!=='string'||!id||id.length>1024||/[\u0000-\u001f\u007f]/.test(id))throw new SafeError('Agenda inválida');
 return id;
}

function createCalendarService({safeStorage,data,openExternal,chooseFile,defaultClientId,fetchImpl=globalThis.fetch,now=Date.now,fetchTimeout=FETCH_TIMEOUT,connectTimeout=CONNECT_TIMEOUT}){
 const configPath=path.join(data,CONFIG_FILE),tokensPath=path.join(data,TOKENS_FILE);
 let configCache,tokensCache,pending=null,refreshing=null,gen=0,disposed=false,chain=Promise.resolve();
 // Serializa escrita/remoção dos arquivos; a geração invalida operações iniciadas antes de configure/disconnect.
 const lock=fn=>{const p=chain.then(fn);chain=p.catch(()=>{});return p;};

 async function readEncrypted(file){
  let buf;try{buf=await fsp.readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw new SafeError('Falha ao ler dados locais do Google Agenda');}
  try{const v=JSON.parse(safeStorage.decryptString(buf));if(v&&typeof v==='object')return v;}catch{}
  throw new SafeError('Dados locais do Google Agenda ilegíveis; configure ou conecte novamente');
 }
 async function writeEncrypted(file,value){
  if(!safeStorage.isEncryptionAvailable())throw new SafeError('Criptografia do sistema indisponível; não é possível salvar com segurança');
  const tmp=`${file}.${b64(crypto.randomBytes(6))}.tmp`;
  try{await fsp.mkdir(data,{recursive:true});await fsp.writeFile(tmp,safeStorage.encryptString(JSON.stringify(value)),{mode:0o600});await fsp.rename(tmp,file);}
  catch{await fsp.unlink(tmp).catch(()=>{});throw new SafeError('Falha ao salvar dados do Google Agenda');}
 }
 async function remove(file){try{await fsp.unlink(file);}catch(e){if(e.code!=='ENOENT')throw new SafeError('Falha ao remover dados locais do Google Agenda');}}
 async function loadConfig(){
  if(configCache===undefined){const c=await readEncrypted(configPath);configCache=c?parseClientConfig({installed:{client_id:c.clientId,client_secret:c.clientSecret}}):defaultClientId?parseClientConfig({installed:{client_id:defaultClientId}}):null;}
  return configCache;
 }
 async function loadTokens(){
  if(tokensCache===undefined){const t=await readEncrypted(tokensPath);tokensCache=t&&typeof t.access_token==='string'?t:null;}
  return tokensCache;
 }
 async function clearTokens(){tokensCache=null;await remove(tokensPath);}
 async function saveTokens(t){await writeEncrypted(tokensPath,t);tokensCache=t;}

 async function request(url,options={}){
  let res;
  try{res=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(fetchTimeout)});}
  catch(e){throw new SafeError(e&&(e.name==='TimeoutError'||e.name==='AbortError')?'Tempo esgotado ao falar com o Google':'Sem conexão com o Google');}
  return res;
 }
 async function readJson(res){try{return await res.json();}catch{throw new SafeError('Resposta inválida do Google');}}
 async function tokenRequest(params){
  const res=await request(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams(params).toString()});
  const json=await readJson(res);
  if(!res.ok){
   if(json&&json.error==='invalid_request'&&/client_secret/.test(json.error_description||''))throw new SafeError('Configuração Google incompleta: importe o JSON do cliente para computador com sua chave.');
   if(json&&json.error==='invalid_grant')throw new SafeError('Autorização do Google expirada ou revogada; conecte novamente','invalid_grant');
   if(json&&json.error==='invalid_client')throw new SafeError('Cliente OAuth recusado pelo Google; verifique a configuração');
   throw new SafeError(`Falha na autorização do Google (${res.status})`);
  }
  if(!json||typeof json.access_token!=='string'||!json.access_token)throw new SafeError('Resposta de autorização inválida do Google');
  if(typeof json.scope==='string'&&!json.scope.split(' ').includes(SCOPE))throw new SafeError('Permissão de leitura da agenda não concedida');
  const ttl=Number.isFinite(json.expires_in)&&json.expires_in>0?json.expires_in:3600;
  return {access_token:json.access_token,refresh_token:typeof json.refresh_token==='string'?json.refresh_token:undefined,expiry:now()+ttl*1000};
 }
 async function revoke(t){
  const token=t&&(t.refresh_token||t.access_token);if(!token)return;
  try{await request(REVOKE_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}).toString()});}catch{}
 }

 async function status(){
  let configured=false,connected=false;
  try{const config=await loadConfig();configured=!!config?.clientSecret;}catch{}
  if(configured)try{const t=await loadTokens();connected=!!t&&(!!t.refresh_token||t.expiry>now());}catch{}
  return {configured,connected};
 }

 function cancelPending(){if(pending){pending.cancel();pending=null;}}

 async function configure(){
  const file=await chooseFile();
  if(!file)return {...await status(),canceled:true};
  let json;
  try{const st=await fsp.stat(file);if(!st.isFile()||st.size>MAX_CONFIG_BYTES)throw 0;json=JSON.parse((await fsp.readFile(file,'utf8')).replace(/^﻿/,''));}
  catch{throw new SafeError('Arquivo JSON de configuração inválido');}
  const config=parseClientConfig(json);
  cancelPending();gen++;
  const old=await lock(async()=>{
   gen++;await writeEncrypted(configPath,config);configCache=config;
   let t=null;try{t=await loadTokens();}catch{}
   await clearTokens();return t;
  });
  await revoke(old);
  return status();
 }

 function startLoopback(state){
  return new Promise((resolve,reject)=>{
   let done=false,listening=false,settle;
   const code=new Promise((res,rej)=>{settle={res,rej};});code.catch(()=>{});
   const server=http.createServer((req,res)=>{
    const send=(statusCode,text)=>{res.writeHead(statusCode,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Connection':'close'});res.end(text);};
    let u;try{u=new URL(req.url,'http://127.0.0.1');}catch{return send(400,'Requisição inválida');}
    if(req.method!=='GET'||u.pathname!=='/oauth2callback')return send(404,'Não encontrado');
    if(done||!safeEqual(u.searchParams.get('state'),state))return send(400,'Requisição inválida');
    if(u.searchParams.get('error')){send(200,'Autorização não concedida. Você pode fechar esta aba.');return finish(new SafeError('Autorização negada no Google'));}
    const c=u.searchParams.get('code');
    if(!c||c.length>4096)return send(400,'Requisição inválida');
    send(200,'Autorização recebida. Volte ao Flow para acompanhar a conclusão da conexão. Você pode fechar esta aba.');finish(null,c);
   });
   const timer=setTimeout(()=>finish(new SafeError('Tempo esgotado aguardando o login no navegador')),connectTimeout);
   function finish(error,value){
    if(done)return;done=true;clearTimeout(timer);server.close();
    setTimeout(()=>server.closeAllConnections?.(),1000).unref();
    if(error)settle.rej(error);else settle.res(value);
   }
   server.on('error',()=>{if(!listening){clearTimeout(timer);done=true;reject(new SafeError('Não foi possível iniciar o retorno local do login'));}else finish(new SafeError('Falha no retorno local do login'));});
   server.listen(0,'127.0.0.1',()=>{
    listening=true;
    const flow={redirectUri:`http://127.0.0.1:${server.address().port}/oauth2callback`,code,cancelled:false,cancel(){flow.cancelled=true;finish(cancelled());}};
    resolve(flow);
   });
  });
 }

 async function connect(){
  if(disposed)throw cancelled();
  const config=await loadConfig();
  if(!config)throw new SafeError('Configure o cliente OAuth do Google antes de conectar');
  if(!config.clientSecret)throw new SafeError('A conexão Google precisa da chave do cliente para computador. Configure o aplicativo antes de conectar.');
  cancelPending();
  const g=gen,verifier=b64(crypto.randomBytes(32)),state=b64(crypto.randomBytes(24));
  const flow=await startLoopback(state);
  if(disposed||g!==gen){flow.cancel();throw cancelled();}
  pending=flow;
  const stale=()=>flow.cancelled||g!==gen||disposed;
  try{
   const auth=new URL(AUTH_URL);
   auth.search=new URLSearchParams({client_id:config.clientId,redirect_uri:flow.redirectUri,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:b64(crypto.createHash('sha256').update(verifier).digest()),code_challenge_method:'S256'}).toString();
   try{await openExternal(auth.toString());}catch{throw new SafeError('Não foi possível abrir o navegador para o login Google');}
   const code=await flow.code;
   if(stale())throw cancelled();
   const params={grant_type:'authorization_code',code,client_id:config.clientId,code_verifier:verifier,redirect_uri:flow.redirectUri};
   if(config.clientSecret)params.client_secret=config.clientSecret;
   const t=await tokenRequest(params);
   await lock(async()=>{if(stale())throw cancelled();await saveTokens(t);});
  }finally{flow.cancel();if(pending===flow)pending=null;}
  return status();
 }

 async function accessToken(force){
  const t=await loadTokens();
  if(!t)throw new SafeError('Google Agenda não conectado','not_connected');
  if(!force&&t.expiry-60000>now())return t.access_token;
  if(!refreshing){
   const g=gen;
   refreshing=(async()=>{
    if(!t.refresh_token){await lock(async()=>{if(g===gen)await clearTokens();});throw new SafeError('Sessão do Google expirada; conecte novamente','not_connected');}
    const config=await loadConfig();
    if(!config)throw new SafeError('Configure o cliente OAuth do Google antes de conectar');
    const params={grant_type:'refresh_token',refresh_token:t.refresh_token,client_id:config.clientId};
    if(config.clientSecret)params.client_secret=config.clientSecret;
    let r;
    try{r=await tokenRequest(params);}
    catch(e){if(e.code==='invalid_grant')await lock(async()=>{if(g===gen)await clearTokens();});throw e;}
    return lock(async()=>{
     if(g!==gen)throw cancelled();
     await saveTokens({...t,access_token:r.access_token,expiry:r.expiry,refresh_token:r.refresh_token||t.refresh_token});
     return r.access_token;
    });
   })().finally(()=>{refreshing=null;});
  }
  return refreshing;
 }

 async function api(pathname,params){
  for(let attempt=0;;attempt++){
   const token=await accessToken(attempt>0);
   const u=new URL(API+pathname);
   for(const [k,v] of Object.entries(params))if(v!=null)u.searchParams.set(k,String(v));
   const res=await request(u,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
   if(res.status===401&&attempt===0)continue;
   if(!res.ok)throw new SafeError(res.status===401?'Sessão do Google expirada; conecte novamente':res.status===403?'Acesso negado pela API Google Agenda':res.status===404?'Agenda não encontrada':`Falha na API Google Agenda (${res.status})`);
   return readJson(res);
  }
 }
 async function paginate(pathname,params,map){
  const out=[];let pageToken;
  for(let page=0;page<MAX_PAGES;page++){
   const json=await api(pathname,{...params,pageToken});
   if(!json||(json.items!=null&&!Array.isArray(json.items)))throw new SafeError('Resposta inválida da API Google Agenda');
   for(const item of json.items||[]){const v=item&&typeof item==='object'?map(item):null;if(v)out.push(v);}
   if(!json.nextPageToken)return out;
   if(typeof json.nextPageToken!=='string'||json.nextPageToken===pageToken)throw new SafeError('Paginação inválida da API Google Agenda');
   pageToken=json.nextPageToken;
  }
  throw new SafeError(`Resultado excede o limite de ${MAX_PAGES} páginas da API Google Agenda`);
 }
 const str=v=>typeof v==='string'?v:'';

 async function listCalendars(){
  const calendars=await paginate('/users/me/calendarList',{maxResults:250},c=>typeof c.id==='string'&&c.id?{id:c.id,summary:str(c.summaryOverride)||str(c.summary),primary:c.primary===true,selected:c.selected===true,backgroundColor:/^#[0-9a-fA-F]{6}$/.test(c.backgroundColor)?c.backgroundColor:''}:null);
  return {calendars};
 }
 async function listEvents(input){
  const {timeMin,timeMax}=monthRange(input&&input.month);
  const calendarId=validCalendarId(input&&input.calendarId);
  let timeZone;try{timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch{}
  const when=v=>v&&typeof v==='object'?str(v.dateTime)||str(v.date):'';
  const events=await paginate(`/calendars/${encodeURIComponent(calendarId)}/events`,{singleEvents:true,orderBy:'startTime',timeMin,timeMax,timeZone,maxResults:2500},ev=>{
   if(typeof ev.id!=='string'||ev.status==='cancelled')return null;
   return {id:ev.id,summary:str(ev.summary),start:when(ev.start),end:when(ev.end),location:str(ev.location),htmlLink:isCalendarLink(ev.htmlLink)?ev.htmlLink:'',calendarId};
  });
  return {events};
 }

 async function disconnect(){
  cancelPending();gen++;
  const old=await lock(async()=>{
   gen++;let t=null;try{t=await loadTokens();}catch{}
   await clearTokens();return t;
  });
  await revoke(old);
  return status();
 }
 async function open(arg){
  const link=typeof arg==='string'?arg:arg&&arg.htmlLink;
  if(!isCalendarLink(link))throw new SafeError('Link do Google Agenda inválido');
  try{await openExternal(link);}catch{throw new SafeError('Não foi possível abrir o navegador');}
  return {ok:true};
 }
 async function openWeb(){
  try{await openExternal(WEB_URL);}catch{throw new SafeError('Não foi possível abrir o navegador');}
  return {ok:true};
 }
 function dispose(){disposed=true;cancelPending();gen++;}

 return {status,configure,connect,disconnect,listCalendars,listEvents,open,openWeb,dispose};
}

function installCalendar({win,ipcMain,shell,dialog,safeStorage,trusted,data}){
 const service=createCalendarService({safeStorage,data,defaultClientId:FLOW_CLIENT_ID,
  openExternal:url=>shell.openExternal(url),
  chooseFile:async()=>{
   if(win.isDestroyed())return null;
   const r=await dialog.showOpenDialog(win,{title:'Selecionar cliente OAuth (app para computador)',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
   return r.canceled||!r.filePaths||!r.filePaths[0]?null:r.filePaths[0];
  }});
 const handle=(name,fn)=>ipcMain.handle(name,async(e,arg)=>{
  if(!trusted(e)||e.sender!==win.webContents)throw new Error('Origem não autorizada');
  try{return await fn(arg);}catch(err){throw new Error(err instanceof SafeError?err.message:'Falha no Google Agenda');}
 });
 handle('google-calendar-status',()=>service.status());
 handle('google-calendar-configure',()=>service.configure());
 handle('google-calendar-connect',()=>service.connect());
 handle('google-calendar-disconnect',()=>service.disconnect());
 handle('google-calendar-list',()=>service.listCalendars());
 handle('google-calendar-events',arg=>service.listEvents(arg));
 handle('google-calendar-open',arg=>service.open(arg));
 handle('google-calendar-web',()=>service.openWeb());
 win.on('closed',()=>service.dispose());
 return service;
}

module.exports={installCalendar,createCalendarService,isCalendarLink,parseClientConfig,monthRange,SafeError};
