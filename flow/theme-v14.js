// Ordem por prioridade de uso e tema claro persistido com os dados locais.
const menuOrder=['inicio','tarefas','financas','calendario','rotina','habitos','metas','treino','dieta','compras','zone','caverna','loja','configuracoes'];
nav.sort((a,b)=>menuOrder.indexOf(a[0])-menuOrder.indexOf(b[0]));
function flowTheme(){ensureExtra();return state.extra.settings.theme==='light'?'light':'dark';}
function applyFlowTheme(){const theme=flowTheme();document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}
const beforeThemePreferences=preferences;
preferences=function(){beforeThemePreferences();const choice=`<label class="field">Tema<select id="flow-theme-choice"><option value="dark" ${flowTheme()==='dark'?'selected':''}>Escuro · preto profundo</option><option value="light" ${flowTheme()==='light'?'selected':''}>Claro · branco neutro</option></select></label>`;document.querySelector('#modal-content .dialog-head').insertAdjacentHTML('afterend',choice);};
const beforeThemeSettings=settings;
settings=function(){return beforeThemeSettings()+`<section class="panel padding" style="margin-top:24px"><h2>Tema do sistema</h2><p class="row-meta" style="margin:10px 0 18px">A mesma organização, em claro ou escuro.</p><div class="segmented" aria-label="Tema do sistema"><button data-action="flowTheme" data-theme="dark" class="${flowTheme()==='dark'?'active':''}" aria-pressed="${flowTheme()==='dark'}">${icon('moon')} Escuro</button><button data-action="flowTheme" data-theme="light" class="${flowTheme()==='light'?'active':''}" aria-pressed="${flowTheme()==='light'}">${icon('sun')} Claro</button></div></section>`;};
function changeFlowTheme(theme){state.extra.settings.theme=theme==='light'?'light':'dark';applyFlowTheme();save();}
document.addEventListener('change',e=>{if(e.target.id==='flow-theme-choice')changeFlowTheme(e.target.value);});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="flowTheme"]');if(b){changeFlowTheme(b.dataset.theme);render();}});
const beforeThemeRender=render;render=function(){applyFlowTheme();beforeThemeRender();const header=document.querySelector('header');header?.querySelector('#flow-theme-toggle')?.remove();const button=document.createElement('button');button.id='flow-theme-toggle';button.className='icon-button';button.dataset.action='toggleFlowTheme';button.setAttribute('aria-label',flowTheme()==='light'?'Ativar modo escuro':'Ativar modo claro');button.title=flowTheme()==='light'?'Modo escuro':'Modo claro';button.innerHTML=icon(flowTheme()==='light'?'moon':'sun');header?.insertBefore(button,header.querySelector('#flow-notices'));};
applyFlowTheme();render();

document.addEventListener('click',e=>{if(e.target.closest('[data-action=toggleFlowTheme]')){changeFlowTheme(flowTheme()==='light'?'dark':'light');render();}});
render();
