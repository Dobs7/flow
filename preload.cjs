const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
 flowLoad:()=>ipcRenderer.invoke('flow-load'),
 flowSave:value=>ipcRenderer.sendSync('flow-save',value),
 googleCalendarStatus:()=>ipcRenderer.invoke('google-calendar-status'),
 googleCalendarConfigure:()=>ipcRenderer.invoke('google-calendar-configure'),
 googleCalendarConnect:()=>ipcRenderer.invoke('google-calendar-connect'),
 googleCalendarDisconnect:()=>ipcRenderer.invoke('google-calendar-disconnect'),
 googleCalendarList:()=>ipcRenderer.invoke('google-calendar-list'),
 googleCalendarEvents:query=>ipcRenderer.invoke('google-calendar-events',query),
 googleCalendarOpen:url=>ipcRenderer.invoke('google-calendar-open',url),
 googleCalendarWeb:()=>ipcRenderer.invoke('google-calendar-web'),
 discover:()=>ipcRenderer.invoke('discover'),
 host:()=>ipcRenderer.invoke('host'),
 join:address=>ipcRenderer.invoke('join',address)
});
