function flowToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function flowWriteState(value){
 if(window.flowBootOk!==true)throw Error('Leitura inicial não concluída');
 const result=window.desktop.flowSave(value);
 if(!result?.ok)throw Error(result?.error||'Falha ao salvar dados Flow');
}
