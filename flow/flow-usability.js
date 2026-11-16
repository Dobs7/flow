// Keep every pending imported task discoverable, regardless of its old date.
views.tasks='pendentes';
const flowDateTasks=tasks;
tasks=function(){
 if(views.tasks!=='pendentes')return flowDateTasks();
 const items=state.tasks.filter(t=>!t.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.sequence||0)-(b.sequence||0));
 return heading('Suas pendências','Tarefas',`${items.length} tarefas pendentes, de todas as datas.`,qualityButton('Nova tarefa','task'))+tabset('tasks',[['pendentes','Todas as pendentes'],['hoje','Hoje'],['semana','Semana'],['mes','Mês'],['atrasadas','Atrasadas'],['concluidas','Concluídas'],['algumdia','Algum dia']])+`<div class="tasks-layout"><div>${items.length?items.map(taskCard).join(''):blank('Nenhuma tarefa pendente.','Você pode criar uma tarefa acima.','tasks')}</div></div>`;
};
const flowPeriodTasks=tasks;
tasks=function(){const html=flowPeriodTasks();return views.tasks==='pendentes'?html:html.replace(/(<button[^>]*data-view="hoje")/,`<button data-action="view" data-group="tasks" data-view="pendentes" aria-pressed="false">Todas as pendentes</button>$1`);};
const flowHome=home;
home=function(){const late=state.tasks.filter(t=>!t.done&&t.date&&t.date<flowToday());return (late.length?`<section class="panel padding" style="margin-bottom:20px"><h2>${late.length} tarefas pendentes de dias anteriores</h2><p>Seus dados estão aqui. Abra as pendências para continuar de onde parou.</p><button class="button primary" data-action="flowPending">Ver todas as pendências</button></section>`:'')+flowHome();};
document.addEventListener('click',e=>{if(e.target.closest('[data-action="flowPending"]')){views.tasks='pendentes';page='tarefas';location.hash='tarefas';render();}});
const flowSettings=settings;
const flowPreferences=preferences;
preferences=function(){flowPreferences();document.querySelector('#modal-content [data-action="reset"]')?.remove();const note=document.querySelector('#modal-content .settings-note');if(note)note.textContent='Suas alterações são salvas neste computador. Para preservar ou importar seus dados, use Configurações.';};
document.addEventListener('click',e=>{if(e.target.closest('[data-action="reset"]')){e.preventDefault();e.stopImmediatePropagation();toast('Use Configurações para importar ou exportar seus dados.');}},true);
settings=function(){return `<section class="panel padding"><h2>Dados neste computador</h2><p>${state.tasks.length} tarefas · ${state.habits.length} hábitos · ${state.routine.length} itens de rotina · ${financeStore().items.length} lançamentos financeiros · ${financeStore().subs.length} assinaturas</p><p>Dados salvos no seu perfil do Windows. As tarefas pendentes permanecem acessíveis em Todas as pendentes.</p></section>`+flowSettings();};
save=function(){try{flowWriteState(state);lastSavedLabel='Salvo neste computador às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.documentElement.dataset.flowSave='ok';}catch{lastSavedLabel='Alterações não salvas';document.documentElement.dataset.flowSave='error';toast('Não foi possível salvar no computador. Preserve uma exportação em Configurações e tente novamente.');}updateStats();let indicator=document.getElementById('flow-save-status');if(!indicator){indicator=document.createElement('span');indicator.id='flow-save-status';indicator.setAttribute('role','status');document.querySelector('footer').append(indicator);}indicator.textContent=' · '+lastSavedLabel;indicator.style.color=document.documentElement.dataset.flowSave==='error'?'#ed7b7b':'';};
render();save();
