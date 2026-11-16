// Áudio sintetizado localmente. Inicia somente após interação do usuário.
let flowAudio=null,flowLastSound=0;
function flowSound(kind='tap',force=false){
 ensureExtra();if(!state.extra.settings.sounds)return;
 const volume=Math.max(0,Math.min(1,Number(state.extra.settings.soundVolume??.25)));if(!volume)return;
 const now=performance.now();if(!force&&now-flowLastSound<70)return;flowLastSound=now;
 try{const AudioAPI=window.AudioContext||window.webkitAudioContext;if(!AudioAPI)return;flowAudio=flowAudio||new AudioAPI();if(flowAudio.state==='suspended')flowAudio.resume().catch(()=>{});
 const tones={tap:[[560,0,.045]],navigate:[[440,0,.055],[660,.035,.065]],complete:[[523.25,0,.09],[659.25,.07,.09],[783.99,.14,.14]],off:[[410,0,.06],[310,.035,.07]]};
 for(const [hz,delay,duration]of tones[kind]||tones.tap){const oscillator=flowAudio.createOscillator(),gain=flowAudio.createGain(),start=flowAudio.currentTime+delay;oscillator.type='sine';oscillator.frequency.setValueAtTime(hz,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*.12,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);gain.connect(flowAudio.destination);oscillator.start(start);oscillator.stop(start+duration+.015);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
 }catch{/* Navegação continua disponível se áudio não for suportado. */}
}
const beforeSoundSettings=settings;
settings=function(){const enabled=!!state.extra.settings.sounds,v=Math.round((state.extra.settings.soundVolume??.25)*100);return beforeSoundSettings()+`<section class="panel padding" style="margin-top:24px"><h2>Feedback sonoro</h2><p class="summary-note">Toques suaves para navegar e concluir. O áudio respeita a opção Sons de navegação acima.</p><label class="field">Volume <span id="flow-volume-label">${v}%</span><input id="flow-sound-volume" type="range" min="0" max="100" value="${v}" aria-label="Volume dos sons"></label><div class="module-tools"><button class="button" data-action="soundPreview" data-sound="navigate" ${enabled?'':'disabled'}>Testar navegação</button><button class="button" data-action="soundPreview" data-sound="complete" ${enabled?'':'disabled'}>Testar conclusão</button></div></section>`;};
// Captura o estado anterior à ação para distinguir concluir de desmarcar.
document.addEventListener('click',e=>{const b=e.target.closest('a,button');if(!b||b.disabled)return;if(b.dataset.action==='soundPreview'){flowSound(b.dataset.sound,true);return;}if(b.closest('#navigation')&&b.matches('a')){if(!b.hasAttribute('aria-current'))flowSound('navigate');return;}if(b.matches('.check')){flowSound(b.getAttribute('aria-pressed')==='true'?'off':'complete');return;}if(b.closest('.section-tabs,.segmented'))flowSound('tap');},true);
document.addEventListener('change',e=>{if(e.target.id==='flow-sound-volume'){state.extra.settings.soundVolume=Number(e.target.value)/100;save();flowSound('tap',true);}if(e.target.matches('[data-setting="sounds"]')){if(e.target.checked)flowSound('tap',true);render();}});
document.addEventListener('input',e=>{if(e.target.id==='flow-sound-volume'){const label=document.getElementById('flow-volume-label');if(label)label.textContent=e.target.value+'%';}});
render();
