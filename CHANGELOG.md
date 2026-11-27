# Agrafametal: alterações da versão 1.2.0

## O que mudou

### 1. A senha "volta ao início" noutro PC (corrigido)

**Causa:** a senha fica guardada dentro da base de dados. Quando a versão portátil não encontrava a pasta `dados` ao lado do programa, ou não conseguia escrever nela, mudava **sem avisar** para `%APPDATA%`. Aí criava uma base de dados nova, vazia e com a senha por defeito.

**Agora:**
- **Versão portátil: nunca muda de pasta sem avisar.**
  - **Sem dados ao lado do programa:** pergunta se quer criar uma base de dados nova aqui, escolher a pasta de dados ou sair.
  - **Disco só de leitura:** pergunta se quer abrir só para consulta ou sair.
- **Modo só de consulta:** aparece uma barra vermelha no topo e as ações de escrita são bloqueadas no processo principal.
- **O modo e a pasta de dados ficam sempre visíveis** no rodapé da barra lateral. Um clique abre a pasta.
- **Aviso único** quando é criada uma base de dados nova, com o sítio onde ficou.

### 2. Meses por empresa
- **Clicar numa empresa** mostra os 12 meses do ano, que aparecem sempre todos:
  - verde: mês com registos;
  - vermelho tracejado: mês passado sem registos;
  - amarelo: mês atual ainda sem registos;
  - cinzento: meses futuros ou anteriores à criação da empresa na aplicação.
- **Setas ‹ ›** para mudar de ano.
- **Tabela do mês selecionado** com colunas ordenáveis e contador de registos. Clicar no Nº abre o registo; ao voltar, fica-se na vista da empresa.

**Pastas no disco:** `dados/registos/<id>_<Empresa>/<ano>/<mm-Mês>/<idRegisto>_<data>_<Máquina>/`
- As 12 pastas do ano são criadas ao criar a empresa, ao arrancar (para o ano atual) e ao gravar um registo noutro ano.
- **Renomear uma empresa ou máquina, ou mudar a data de um registo**, renomeia ou muda a pasta de sítio. Se falhar porque há ficheiros abertos, a informação fica gravada e é mostrado um aviso. Volta a tentar no próximo arranque.
- **Eliminar um registo, máquina ou empresa** move as pastas para `registos/_eliminados`. Se houver ficheiros abertos, nada é eliminado e é pedido para os fechar.
- **Nova coluna `relatorios.pasta`**, com o caminho relativo. A migração das bases de dados antigas é automática.

### 3. Documentos e folha de custos
- **Novo quadro «Documentos e custos»** por cima da folha do registo, onde também ficam o técnico e o tipo de manutenção. Estas colunas já existiam mas não havia campos para as preencher.
- **Documentos:** criar ou abrir a folha de custos, adicionar ficheiros, abrir a pasta, abrir com duplo clique e remover (pede a senha; vai para `_eliminados`).
- **Folha de custos Excel** (`custos_<nº>.xlsx`, feita com exceljs) com fórmulas reais do Excel, numa página A4:
  - mão de obra (normais/extra), oficina, deslocação (km, tempo de viagem, portagens);
  - 10 linhas de peças e 5 de outros custos;
  - taxa de urgência (Sim/Não), desconto, IVA e total.
  - A folha está protegida sem senha.
- **Modelo próprio:** se existir `dados/modelo_custos.xlsx`, é copiado e as células com nome definido são preenchidas (os nomes estão no LEIA-ME).
- **Menu ⋮ → Configuração de custos:** valores por defeito das folhas novas. Pede a senha e fica guardado na tabela `config` (chaves `custo_*`).
- **Botões do registo:** **Gravar** (grava e fecha, Ctrl+S) e **Aplicar** (grava e continua aberto; num registo novo fica em edição).

### 4. Cópia de segurança em zip
- **A cópia** passa a ser um `.zip` com `agrafametal.db` e a pasta `registos/`, sem `_eliminados`. Mostra um aviso «a trabalhar» enquanto cria o ficheiro.
- **O restauro** aceita `.zip` e também o `.db` antigo. Mantém tudo o que já fazia: pede a senha, valida, guarda a cópia «Antes_do_restauro» (agora em zip) e mantém a senha atual. Com zip, a pasta `registos` também é trocada e a pasta `_eliminados` atual mantém-se.

### 5. Corretor ortográfico pt-PT
- **Volta a estar ativo:** palavras com erro sublinhadas. O botão direito mostra sugestões, «Adicionar ao dicionário» e Cortar / Copiar / Colar / Selecionar tudo.

### 6. Visual
- **Botão «+» redondo** ao lado do título: novo registo, nova máquina ou nova empresa, conforme o ecrã.
- **Etiquetas coloridas** para o tipo de manutenção, na tabela e na lista de registos da máquina.
- **Avisos a amarelo** (toast) quando a ação foi gravada mas houve um problema com as pastas.

### Ficou de fora (como combinado)
- Dashboard inicial.
- Periodicidade por máquina e próximas manutenções.
- App móvel, centros de custo e contas.
- **Estado da máquina:** não tem nenhum campo para o editar, por isso não leva etiqueta.

### Dependências novas
- `exceljs` (folha de custos)
- `archiver@7` (criar zip)
- `adm-zip` (ler zip)

## Como testar (no Windows)

1. **Disco portátil novo:** copiar só o `Agrafametal-1.2.0-portable.exe` para uma pasta vazia e abrir.
   - Deve aparecer «Não foram encontrados dados junto à aplicação».
   - **Sair** não deve criar nada (nem em `%APPDATA%`).
   - **Criar base de dados nova aqui** cria a pasta `dados` e mostra o aviso de base de dados nova.
2. **Mudar de PC:** copiar a pasta completa (o exe e a pasta `dados`) para outra pen ou outro PC e abrir. Abre sem perguntas, com os mesmos dados e a mesma senha. O rodapé mostra «Portátil» e o caminho da pen.
3. **Só o exe noutro sítio:** copiar só o exe para outra pasta. Aparece a pergunta. **Escolher pasta de dados…** e apontar para a pasta `dados` original: abre os dados certos.
4. **Disco protegido:** pen com proteção contra escrita (ou pasta só de leitura). Deve aparecer o aviso, e **Abrir só para consulta** mostra a barra vermelha. Criar uma empresa dá erro de «modo só de consulta».
5. **Atualizar uma base de dados antiga:** abrir a v1.2.0 sobre a pasta `dados` da v1.1.0. Os dados aparecem e é criada a pasta `registos` com as empresas e os 12 meses do ano.
6. **Meses:** clicar numa empresa e ver as cores, mudar de ano, clicar num mês e ordenar as colunas. Abrir um registo pelo Nº e voltar.
7. **Registo novo com Aplicar:** escolher a data, o técnico e o tipo, e carregar em **Aplicar**. O registo continua aberto e o quadro «Documentos e custos» fica ativo.
8. **Folha de custos:** **Criar folha de custos**. Abre no Excel, com os dados do registo e os preços configurados. Preencher horas e peças e confirmar os totais. Voltar à app: o botão passa a «Abrir folha de custos».
9. **Anexos:** adicionar ficheiros (incluindo um com nome repetido, que deve ficar `(2)`). Abrir com duplo clique. Remover (pede a senha) e confirmar que foi para `_eliminados`.
10. **Mudar a data para outro mês:** **Editar** + senha, mudar a data e Gravar. A pasta do registo passa para o mês novo no Explorador.
11. **Ficheiro aberto:** com a folha de custos aberta no Excel, mudar a data do registo. Deve aparecer o aviso amarelo e a informação fica gravada. Fechar o Excel e reabrir a app: a pasta fica no sítio certo.
12. **Renomear uma empresa com registos:** a pasta da empresa é renomeada e os documentos continuam a abrir.
13. **Eliminar um registo com documentos:** a pasta vai para `_eliminados`. Com um ficheiro aberto, deve pedir para o fechar e não eliminar nada.
14. **Cópia zip:** fazer a cópia e confirmar que o zip tem `agrafametal.db` e `registos/`.
15. **Restaurar o zip:** os dados e os documentos voltam, e é criado o «Antes_do_restauro_….zip».
16. **Restaurar um `.db` antigo** da v1.1.0: funciona e as pastas dos registos ficam como estavam.
17. **Configuração de custos:** alterar o preço/hora (pede a senha). As folhas novas usam o valor novo; as antigas não mudam.
18. **Modelo próprio:** gravar um `modelo_custos.xlsx` com nomes definidos (por exemplo `EMPRESA`, `IVA`) na pasta `dados` e criar uma folha nova. Deve sair a partir do modelo, com essas células preenchidas.
19. **Corretor:** escrever «manutencao» num registo. Fica sublinhado, e o botão direito mostra as sugestões.
20. **Impressão e PDF:** devem sair iguais à v1.1.0. O quadro «Documentos e custos» não aparece.
