// Catálogo reutilizável de identidades. Não representa contas ou saldos adicionais.
const bankBrands={
 nubank:{name:'Nubank',color:'#820ad1',logo:'nubank.svg',style:'wordmark',source:'https://nubank.com.br/'},
 inter:{name:'Inter',color:'#ff7a00',logo:'inter.svg',style:'icon',source:'https://inter.co/'},
 itau:{name:'Itaú',color:'#ec7000',logo:'itau.png',style:'icon',source:'https://www.itau.com.br/feito-de-futuro'},
 bradesco:{name:'Bradesco',color:'#cc092f',logo:'bradesco.png',style:'wordmark-white',source:'https://banco.bradesco/html/classic/index.shtm'},
 santander:{name:'Santander',color:'#ec0000',logo:'santander.ico',style:'icon',source:'https://www.santander.com.br/'},
 neon:{name:'Neon',color:'#007cba',logo:'neon.svg',style:'wordmark',source:'https://neon.com.br/'},
 infinitepay:{name:'InfinitePay',color:'#171717',logo:'infinitepay.svg',style:'wordmark',source:'https://www.infinitepay.io/'}
};
function bankBrand(id){return bankBrands[id]||null;}
function bankBanner(id,type='Conta corrente'){const b=bankBrand(id);if(!b)return `<div class="bank-banner bank-banner-generic"><span>${icon('wallet')}</span><small>${esc(type)}</small></div>`;return `<div class="bank-banner ${b.style} bank-${id}" style="--bank-color:${b.color}"><span class="bank-brand-lockup"><img src="assets/banks/${b.logo}" alt="${esc(b.name)}" loading="lazy">${b.style==='icon'?`<strong>${esc(b.name)}</strong>`:''}</span><small>${esc(type)}</small></div>`;}
function bankLibrary(){modal(dialogHead('Biblioteca de bancos')+`<p class="summary-note">Identidades disponíveis para os banners de contas. Estas prévias não criam contas nem alteram saldos.</p><div class="bank-library">${Object.entries(bankBrands).map(([id,b])=>`<article class="bank-library-card">${bankBanner(id,'Identidade visual')}<div><strong>${esc(b.name)}</strong><small>${esc(b.color.toUpperCase())}</small></div></article>`).join('')}</div>`);}
const beforeBrandedOverview=operationalOverview;
operationalOverview=function(){return beforeBrandedOverview().replace(/<div class="overview-account-brand">[\s\S]*?<\/div>/,bankBanner('nubank')).replace('<h2>Contas</h2>','<h2>Contas</h2><button class="button quiet small" data-action="bankLibrary">Biblioteca de bancos</button>');};
accountPanel=function(){return `<section class="panel branded-account-panel">${bankBanner('nubank')}<div class="padding"><h3>Meu computador</h3><p class="account-balance">${money(4049)}</p><p class="summary-note">Saldo registrado na conta, separado do resultado financeiro.</p><button class="button quiet" data-action="view" data-group="finance" data-view="contas">Ver conta${icon('arrow')}</button></div></section>`;};
const beforeBankFinance=finance;
finance=function(){let html=beforeBankFinance();if(views.finance==='contas')html+=`<section class="panel padding bank-catalog-intro" style="margin-top:24px"><div class="section-head"><div><h2>Identidades dos bancos</h2><p class="row-meta">Banners reutilizáveis para suas contas</p></div><button class="button" data-action="bankLibrary">Ver biblioteca</button></div><div class="bank-preview-strip">${['nubank','inter','itau'].map(id=>bankBanner(id,'Prévia')).join('')}</div></section>`;if(views.finance==='cartoes')html=html.replace('<span class="bank-wordmark">nu</span>','<img class="nu-card-logo" src="assets/banks/nubank.svg" alt="Nubank">');return html;};
document.addEventListener('click',e=>{if(e.target.closest('[data-action=bankLibrary]'))bankLibrary();});
render();
