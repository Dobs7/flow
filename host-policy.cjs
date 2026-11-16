const path=require('node:path');
function isHost(config,deviceId){return !!config.hostDeviceId&&deviceId===config.hostDeviceId;}
function dataFolder(config,deviceId){
 if(!isHost(config,deviceId))throw Error('Somente o computador anfitrião pode guardar a operação.');
 if(!path.isAbsolute(config.dataRoot))throw Error('Pasta do Coco inválida.');
 return config.dataRoot;
}
function matchesHost(config,descriptor){return descriptor?.hostDeviceId===config.hostDeviceId&&descriptor?.app==='coco-desktop-v1';}
module.exports={isHost,dataFolder,matchesHost};
