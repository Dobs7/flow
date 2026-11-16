# Flow

**Download e uso gratuitos.** Qualquer pessoa pode baixar, instalar e usar este aplicativo sem pagar ao Dobs by Azura. Serviços externos, assinaturas e conteúdos de terceiros mantêm suas próprias condições.

[Baixar para Windows](https://github.com/Dobs7/flow/releases/download/v1.1.1/Flow-1.1.1-Windows.exe) · [Ver a release e os arquivos](https://github.com/Dobs7/flow/releases/tag/v1.1.1)

## Como foi feito
Desenvolvido com Electron, HTML, CSS e JavaScript. Os registros ficam em arquivos locais do usuário, com rotinas de persistência e recuperação; a conexão Google Calendar é opcional.

Organizador pessoal para Windows, por **Dobs by Azura**. Reúne tarefas, hábitos, rotina, metas, finanças, calendário e outras áreas de acompanhamento pessoal em uma interface local.

## Baixar e começar
Baixe `Flow-1.1.1-Windows.exe` em **Releases**. Execute o arquivo e aguarde a preparação do aplicativo. Não é necessário copiar uma pasta de dependências.

1. Abra Tarefas, Hábitos ou Rotina e cadastre seus primeiros itens.
2. Em Finanças, crie suas próprias contas e lançamentos.
3. Use as áreas de calendário, compras, metas e acompanhamento conforme sua necessidade.
4. Ajuste aparência e tema nas configurações. Ao fechar, escolha minimizar ou encerrar completamente.

## Dados e privacidade
O pacote começa vazio: sem tarefas, finanças, contas, eventos, histórico ou credenciais do desenvolvedor. Os dados criados por você ficam no perfil local do Windows, na pasta Flow Desktop. O menu Flow permite abrir essa pasta. Não exclua seus dados para atualizar o programa. Uma instalação que já tenha sido usada pode recuperar seus próprios dados locais; pacote virgem não significa apagar perfis existentes.

Nenhuma configuração OAuth do desenvolvedor é distribuída. A integração Google Calendar exige que você configure um cliente OAuth de aplicativo para computador pela opção de configuração da conexão; depois, conecte sua própria conta. Ela consulta eventos em modo de leitura e depende das permissões e do estado do projeto Google configurado. A conexão real com Google não foi revalidada nesta entrega.

## Desenvolvimento
Node.js e pnpm/npm. Instale as dependências descritas em package.json. `npm start` abre a fonte; `npm run package:win` gera o executável. Electron 45.0.0. O programa usa um servidor HTTP apenas em 127.0.0.1 para carregar a interface; a porta local precisa estar livre. Build Windows sem assinatura digital de editor.

## Créditos
Contribuições próprias por Dobs by Azura. Electron, Chromium e componentes de terceiros preservam seus créditos e licenças. Não foi atribuída licença aberta ao código próprio nesta preparação.
