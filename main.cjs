const {app,BrowserWindow,ipcMain,Menu,dialog,shell,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),dgram=require('node:dgram'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const MODE=fs.readFileSync(path.join(__dirname,'mode.txt'),'utf8').trim();
const TESTING=process.argv.includes('--smoke-test')&&!!process.env.FLOW_COCO_TEST_PROFILE;
const FLOW=MODE==='flow',PORT=TESTING?Number(process.env.COCO_TEST_PORT||18768):18765,DISCOVERY=TESTING?19182:19179;
const FLOW_PORT=TESTING?18769:18767, FLOW_ORIGIN='http://127.0.0.1:'+FLOW_PORT;
app.setName(FLOW?'Flow Desktop':'Coco Desktop');
app.setAppUserModelId(FLOW?'com.flow.desktop':'com.coconut.desktop');
app.setPath('userData',path.join(app.getPath('appData'),FLOW?'Flow Desktop':'Coco Desktop'));
if(process.argv.includes('--smoke-test')&&process.env.FLOW_COCO_TEST_PROFILE)app.setPath('userData',path.join(process.env.FLOW_COCO_TEST_PROFILE,FLOW?'Flow Desktop':'Coco Desktop'));
let win,child,staticServer,beacon,allowedOrigin='',flowClosePrompt=false;
const data=app.getPath('userData');fs.mkdirSync(data,{recursive:true});
if(FLOW){
 const flowStore=require('./flow-storage.cjs').createStore(data);
 let flowRead=false,flowFirstSave=true,flowInitial=null;
 const trusted=e=>e.senderFrame?.url?.startsWith(FLOW_ORIGIN+'/')&&e.senderFrame===e.sender.mainFrame;
 ipcMain.handle('flow-load',e=>{if(!trusted(e))return {ok:false,error:'Origem não autorizada'};try{flowInitial=flowStore.load();flowRead=true;flowFirstSave=true;return {ok:true,state:flowInitial};}catch(error){return {ok:false,error:error.message};}});
 ipcMain.on('flow-save',(e,value)=>{if(!trusted(e)||!flowRead){e.returnValue={ok:false,error:'Leitura inicial dos dados não concluída'};return;}try{const counts=s=>[s?.tasks,s?.habits,s?.routine,s?.extra?.financeV3?.items,s?.extra?.financeV3?.subs,s?.extra?.accountsV1,s?.extra?.events,s?.extra?.goals].map(a=>Array.isArray(a)?a.length:0);if(flowFirstSave&&flowInitial&&counts(flowInitial).some((n,i)=>n>counts(value)[i]))throw Error('Inicialização incompleta bloqueada para preservar seus dados');flowStore.save(value);flowFirstSave=false;e.returnValue={ok:true};}catch(error){e.returnValue={ok:false,error:error.message};}});
}
let machineGuid;try{machineGuid=execFileSync('reg.exe',['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{windowsHide:true,encoding:'utf8'}).match(/MachineGuid\s+REG_SZ\s+(\S+)/)[1]}catch{machineGuid=os.hostname()}
const profile={id:crypto.createHash('sha256').update('flow-coco-desktop-machine-v1:'+machineGuid).digest('hex'),name:os.hostname()};
const hostPolicy=require('./host-policy.cjs');
const hostConfig=JSON.parse(fs.readFileSync(path.join(__dirname,'host-config.json'),'utf8'));
if(process.argv.includes('--smoke-test')&&process.env.FLOW_COCO_TEST_PROFILE)hostConfig.dataRoot=path.join(process.env.FLOW_COCO_TEST_PROFILE,'Coco Host Test');
const ownsData=!FLOW&&hostPolicy.isHost(hostConfig,profile.id);
const connectionFile=path.join(data,'connection.json');
fs.writeFileSync(path.join(data,'machine-profile.json'),JSON.stringify(profile,null,2));
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){win.restore();win.focus()}});
 app.whenReady().then(start).catch(e=>{dialog.showErrorBox('Não foi possível abrir',e.message);app.quit()});
}
function addresses(){return Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal&&isPrivate(x.address)).map(x=>x.address)}
function isPrivate(ip){if(!net.isIPv4(ip))return false;const a=ip.split('.').map(Number);return a[0]===10||a[0]===192&&a[1]===168||a[0]===172&&a[1]>=16&&a[1]<=31||ip==='127.0.0.1'}
function get(url){return new Promise((resolve,reject)=>{const req=http.get(url,r=>{let body='';r.on('data',b=>{body+=b;if(body.length>500000){req.destroy();reject(Error('Resposta inválida'))}});r.on('end',()=>{try{resolve(JSON.parse(body))}catch{reject(Error('O endereço não respondeu como Coco.'))}})});req.setTimeout(2000,()=>req.destroy(Error('Não foi possível conectar. Confira o IP, o anfitrião e o Firewall.')));req.on('error',reject)})}
async function waitServer(url){for(let i=0;i<60;i++){if(child&&child.exitCode!==null)throw Error('O serviço Coco encerrou. Consulte coco-service.log na pasta de dados.');try{return await get(url)}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('O Coco não iniciou. Consulte coco-service.log na pasta de dados.')}
function navigate(url){allowedOrigin=new URL(url).origin;return win.loadURL(url)}
async function host(){
 if(!ownsData)throw Error('Somente '+hostConfig.hostName+' pode ser anfitrião. Conecte-se a esse computador pela rede.');
 if(child)return navigate(`http://127.0.0.1:${PORT}/`);
 // Never attach to an unknown listener or start a second database owner.
 const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',()=>reject(Error('A porta 18765 está ocupada. Feche a outra instância do Coco Desktop.')));probe.listen(PORT,'0.0.0.0',()=>probe.close(resolve))});
 const db=path.join(hostPolicy.dataFolder(hostConfig,profile.id),'data','coco.sqlite3');
 if(!fs.existsSync(db))throw Error('Banco do Coco não encontrado em '+db+'. Restaure sua pasta de dados antes de iniciar.');
 const log=fs.openSync(path.join(data,'coco-service.log'),'a');
 child=spawn(path.join(__dirname,'backend','coco-service.exe'),['--host','0.0.0.0','--port',String(PORT),'--db',db],{cwd:data,env:{...process.env,COCO_HOST_DEVICE_ID:profile.id},windowsHide:true,stdio:['ignore',log,log]});fs.closeSync(log);
 child.on('error',e=>dialog.showErrorBox('Coco',e.message));
 child.on('exit',()=>{child=null;if(!app.isQuitting&&win&&!win.isDestroyed())dialog.showErrorBox('Coco desconectado','O serviço encerrou. Reabra o aplicativo para reconectar.')});
 await waitServer(`http://127.0.0.1:${PORT}/api/auth`);
 beacon=dgram.createSocket({type:'udp4',reuseAddr:true});beacon.on('error',e=>fs.appendFileSync(path.join(data,'network.log'),e.message+'\n'));
 beacon.on('message',(msg,remote)=>{if(msg.toString()==='COCO_DESKTOP_DISCOVER_V1'&&isPrivate(remote.address))beacon.send(Buffer.from(JSON.stringify({app:'coco-desktop-v1',hostDeviceId:profile.id,name:os.hostname(),port:PORT})),remote.port,remote.address)});beacon.bind(DISCOVERY,'0.0.0.0');
 buildMenu(true);await navigate(`http://127.0.0.1:${PORT}/`);
}
async function join(address){address=String(address).trim();if(!isPrivate(address))throw Error('Informe um IP da rede local, como 192.168.1.250.');const descriptor=await get(`http://${address}:${PORT}/api/host`);if(!hostPolicy.matchesHost(hostConfig,descriptor))throw Error('Este PC não é o anfitrião autorizado: '+hostConfig.hostName+'.');await navigate(`http://${address}:${PORT}/`);fs.writeFileSync(connectionFile,JSON.stringify({address}));buildMenu(false)}
function discover(){return new Promise(resolve=>{const found=new Map(),socket=dgram.createSocket('udp4');const finish=()=>{try{socket.close()}catch{}resolve([...found.values()])};socket.on('error',finish);socket.on('message',(msg,r)=>{try{const v=JSON.parse(msg);if(hostPolicy.matchesHost(hostConfig,v)&&v.port===PORT&&isPrivate(r.address))found.set(r.address,{address:r.address,name:String(v.name).slice(0,80)})}catch{}});socket.bind(0,'0.0.0.0',()=>{socket.setBroadcast(true);const targets=new Set(['255.255.255.255']);for(const rows of Object.values(os.networkInterfaces()))for(const nic of rows||[])if(nic.family==='IPv4'&&!nic.internal){const ip=nic.address.split('.').map(Number),mask=nic.netmask.split('.').map(Number);targets.add(ip.map((n,i)=>n|(~mask[i]&255)).join('.'))}for(const target of targets)socket.send('COCO_DESKTOP_DISCOVER_V1',DISCOVERY,target)});setTimeout(finish,1800)})}
function buildMenu(hosting=false){Menu.setApplicationMenu(Menu.buildFromTemplate([{label:FLOW?'Flow':'Coco',submenu:[...(!FLOW?[{label:'Conexão LAN',click:()=>{if(child){dialog.showMessageBox(win,{message:'Este PC é o anfitrião',detail:'Pasta dos dados: '+hostConfig.dataRoot+'\nIP para os outros PCs: '+addresses().join(', ')+'\nMantenha este aplicativo e o PC ligados. Mesma rede local; porta TCP 18765 e UDP 19179.'})}else win.loadFile(path.join(__dirname,'launcher.html'))}}]:[]),{label:'Abrir pasta dos dados',click:()=>shell.openPath(ownsData?hostConfig.dataRoot:data)},{label:'Recarregar',role:'reload'},{type:'separator'},...(FLOW?[{label:'Minimizar',click:()=>win.minimize()},{label:'Fechar completamente',click:()=>app.quit()}]:[{label:'Sair',role:'quit'}])]},{label:'Exibir',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}]));}
async function start(){
 win=new BrowserWindow({show:!process.argv.includes('--smoke-test'),title:FLOW?'Flow':'Coconut Water',icon:path.join(__dirname,'app-icon.ico'),width:1440,height:960,minWidth:850,minHeight:620,backgroundColor:'#101411',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if(FLOW)win.on('close',async event=>{
  if(app.isQuitting)return;
  event.preventDefault();
  if(flowClosePrompt)return;
  flowClosePrompt=true;
  try{
   const {response}=await dialog.showMessageBox(win,{type:'question',title:'Flow',message:'O que você quer fazer com o Flow?',buttons:['Minimizar','Fechar completamente','Cancelar'],defaultId:0,cancelId:2,noLink:true});
   if(response===0)win.minimize();
   if(response===1)app.quit();
  }finally{flowClosePrompt=false;}
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 if(FLOW)require('./google-calendar.cjs').installCalendar({win,ipcMain,shell,dialog,safeStorage,data,trusted:e=>e.senderFrame===win.webContents.mainFrame&&e.senderFrame?.url?.startsWith(FLOW_ORIGIN+'/')});
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==allowedOrigin)event.preventDefault()});
 win.webContents.session.webRequest.onBeforeSendHeaders((details,callback)=>{if(!FLOW&&allowedOrigin&&new URL(details.url).origin===allowedOrigin){details.requestHeaders['X-Coco-Device']=profile.id;details.requestHeaders['X-Coco-Machine']=encodeURIComponent(profile.name)}callback({requestHeaders:details.requestHeaders})});
 win.webContents.session.on('will-download',(_event,item)=>{item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),item.getFilename())})});
 const localOnly=(e)=>{if(e.senderFrame.url!==require('node:url').pathToFileURL(path.join(__dirname,'launcher.html')).href)throw Error('Abra a tela de conexão LAN.');};
 ipcMain.handle('discover',e=>{localOnly(e);return discover()});ipcMain.handle('host',e=>{localOnly(e);return host()});ipcMain.handle('join',(e,a)=>{localOnly(e);return join(a)});
 buildMenu();
 if(FLOW){await win.webContents.session.clearCache();const root=path.join(__dirname,'flow');staticServer=http.createServer((req,res)=>{try{if(new URL(req.url,'http://localhost').pathname==='/desktop-machine'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(profile))}const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}const target=file===root?path.join(root,'index.html'):file;const ext=path.extname(target);const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream';fs.readFile(target,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':type,'Cache-Control':'no-store, max-age=0','Pragma':'no-cache'});res.end(err?'Arquivo não encontrado':bytes)})}catch{res.writeHead(400);res.end()}});await new Promise((resolve,reject)=>{staticServer.on('error',reject);staticServer.listen(FLOW_PORT,'127.0.0.1',resolve)});await navigate(FLOW_ORIGIN+'/');}
 else if(ownsData)await host();
 else {
  await win.loadFile(path.join(__dirname,'launcher.html'));
  let connected=false;
  try{const saved=JSON.parse(fs.readFileSync(connectionFile,'utf8'));await join(saved.address);connected=true}catch{}
  if(!connected){const found=await discover();if(found.length)try{await join(found[0].address)}catch{}}
 }
 if(process.argv.includes('--smoke-host'))await host();
 if(process.argv.includes('--smoke-test')){setTimeout(async()=>{if(!FLOW&&process.argv.includes('--smoke-weather'))await win.webContents.executeJavaScript("page='weather';shell();loadWeather(true)");await new Promise(resolve=>setTimeout(resolve,250));const check=await win.webContents.executeJavaScript('({title:document.title,body:document.body.innerText.length,errors:document.body.innerText.includes("Não foi possível conectar"),tasks:typeof state!=="undefined"&&state?.tasks?.length,finance:typeof state!=="undefined"&&state.extra?.financeV3?.items?.length,boot:window.flowBootOk===true,ready:document.querySelector("#flow-shell")?.hidden===false,loader:document.querySelector("#flow-loader h1")?.textContent,financeFont:typeof state!=="undefined"&&window.flowBootOk?(()=>{page="financas";render();const cell=document.querySelector(".operational-table td");return cell?getComputedStyle(cell).fontSize:null})():null,weatherAvailable:typeof weatherData!=="undefined"&&!!weatherData,weatherError:typeof weatherError!=="undefined"?weatherError:"",weatherPage:!!document.querySelector(".weather-week"),forecastDays:typeof weatherData!=="undefined"&&weatherData?weatherData.daily.time.length:0})');fs.writeFileSync(path.join(data,'smoke-test.json'),JSON.stringify(check));fs.writeFileSync(path.join(data,'smoke-test.png'),(await win.webContents.capturePage()).toPNG());app.quit()},process.argv.includes('--smoke-host')?10000:2500)}
}
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{app.isQuitting=true;if(child)child.kill();if(beacon)beacon.close();if(staticServer)staticServer.close()});
