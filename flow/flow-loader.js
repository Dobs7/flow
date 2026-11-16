// Load the Windows profile before any screen or write handler starts.
(async function startFlow() {
 const loader = document.querySelector('#flow-loader');
 const shell = document.querySelector('#flow-shell');
 try {
  const result = await window.desktop?.flowLoad();
  if (!result?.ok) throw Error(result?.error || 'Conexão com os dados locais indisponível.');
  window.flowInitialState = result.state;
  window.flowBootOk = true;
  for (const entry of document.querySelectorAll('script[data-flow-src]')) {
   await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = entry.dataset.flowSrc;
    script.onload = resolve;
    script.onerror = () => reject(Error('Não foi possível iniciar ' + entry.dataset.flowSrc));
    document.body.append(script);
   });
  }
  if (!document.querySelector('#content')?.childElementCount) throw Error('A interface não iniciou.');
  loader.hidden = true;
  shell.hidden = false;
 } catch (error) {
  window.flowBootOk = false;
  loader.querySelector('h1').textContent = 'Não foi possível carregar seus dados';
  loader.querySelector('p').textContent = error.message;
  loader.querySelector('button').hidden = false;
  loader.querySelector('button').onclick = () => location.reload();
 }
})();
