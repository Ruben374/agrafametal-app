# Agrafametal: guia rápido

## 1. Qual dos ficheiros usar?

**Disco externo, para usar em vários computadores:** `Agrafametal-1.2.0-portable.exe`

- Não precisa de instalar nada.
- Copie o ficheiro para uma pasta no disco externo, por exemplo `E:\Agrafametal\`.
- Abra-o com duplo clique. Na primeira vez a aplicação pergunta se quer **criar uma base de dados nova**: confirme. É criada, ao lado do programa, a pasta `dados`, onde fica toda a informação.
- Ligue o disco a qualquer computador com Windows e abra o mesmo ficheiro: verá sempre os mesmos dados.

```
E:\Agrafametal\
   Agrafametal-1.2.0-portable.exe
   dados\
      agrafametal.db      (a informação)
      registos\           (pastas por empresa / ano / mês, com documentos e folhas de custos)
      backups\            (cópias de segurança)
      modelo_custos.xlsx  (opcional: modelo próprio da folha de custos)
```

> **Copie sempre a pasta completa: o programa E a pasta `dados`. Nunca copie só o ficheiro `.exe`.**
> Se a aplicação não encontrar a pasta `dados` ao lado do programa, **não cria nada sem perguntar**:
> mostra a mensagem «Não foram encontrados dados junto à aplicação» com três opções:
>
> - **Criar base de dados nova aqui**: só na primeira utilização.
> - **Escolher pasta de dados…**: para abrir uma pasta `dados` que esteja noutro sítio.
> - **Sair**: para ir buscar a pasta `dados` que falta e voltar a abrir.
>
> Se aparecer esta mensagem e já usava a aplicação nesse disco, escolha **Sair** e confirme que a
> pasta `dados` está mesmo ao lado do programa.

**Um só computador fixo:** `Agrafametal-1.2.0-setup.exe`

- Instala a aplicação e cria um atalho no ambiente de trabalho e no menu Iniciar.
- Os dados ficam guardados nesse computador.

> **Atenção:** as duas versões guardam os dados em sítios diferentes. O que for registado no
> computador onde a app está instalada não aparece no disco externo, e o contrário também.

## 2. Primeira vez: aviso do Windows

Como a aplicação não é distribuída pela loja da Microsoft, o Windows pode mostrar o aviso
**«O Windows protegeu o seu PC»** (SmartScreen). Para continuar:

1. Clique em **«Mais informações»**.
2. Clique em **«Executar mesmo assim»**.

Este aviso só aparece na primeira vez em cada computador.

## 3. Regras importantes no disco externo

- **Feche sempre a aplicação antes de desligar o disco.**
- **Para mudar de sítio, mova a pasta inteira (programa + pasta `dados`).**
- Abra a aplicação apenas uma vez de cada vez. Se já estiver aberta, a janela existente passa para a frente.
- **Disco protegido contra escrita:** se o disco estiver só de leitura (ou o Windows bloquear a escrita), a aplicação avisa e deixa abrir **só para consulta**. Nesse modo aparece uma barra vermelha no topo e nada é gravado.

## 4. Onde estão os dados?

Está **sempre visível no rodapé da lista**, em baixo à esquerda, por exemplo
«**Portátil** E:\Agrafametal\dados». Clique aí para abrir a pasta.

Se aparecer «Instalado» quando devia aparecer «Portátil», está a trabalhar com os dados deste
computador e não com os do disco: feche e abra o programa portátil do disco.

Mais detalhes no menu **⋮** (canto inferior esquerdo) → **«Acerca da aplicação»**.

## 5. Cópias de segurança

**Fazer uma cópia:** menu **⋮** → **«Fazer cópia de segurança»**.

- A cópia é um ficheiro **.zip** com a base de dados **e** a pasta `registos` (documentos e folhas de custos).
- Por defeito, a cópia é guardada em `dados\backups\` com a data e a hora no nome.
- Com muitos documentos pode demorar um pouco: aparece o aviso «A criar a cópia de segurança…».
- Recomendação: faça uma cópia regularmente e guarde-a também noutro sítio (outra pen, outro disco ou um serviço na nuvem).

**Restaurar uma cópia:** menu **⋮** → **«Restaurar cópia de segurança»**.

- Escolha o ficheiro `.zip` da cópia. As cópias antigas (`.db`, das versões anteriores) também são aceites: nesse caso só a base de dados é substituída e as pastas dos registos ficam como estão.
- A aplicação mostra quantas empresas, máquinas, registos e documentos a cópia contém e pede confirmação.
- Antes de restaurar, guarda automaticamente uma cópia dos dados atuais (`Antes_do_restauro_…`). Por isso, um restauro feito por engano pode ser desfeito.

## 6. Senha de proteção

A aplicação tem uma **senha** que protege os dados contra alterações por engano ou por
pessoas não autorizadas. A senha é entregue à parte, pelo responsável pela aplicação.

**Não precisa de senha:**

- Consultar, pesquisar, imprimir e exportar PDF.
- Fazer uma cópia de segurança.
- Criar: adicionar empresas, máquinas e registos de manutenção novos. Um registo novo pode ser escrito à vontade até ser guardado pela primeira vez.
- Anexar documentos a um registo e criar a folha de custos.

**Precisa de senha:**

- Apagar uma empresa, uma máquina ou um registo.
- Mudar o nome de uma empresa.
- Alterar as características da máquina (a «chapa»).
- Alterar um registo já guardado (texto, título ou data).
- Alterar o texto do cabeçalho da folha.
- Restaurar uma cópia de segurança.
- Remover um documento de um registo.
- Alterar a configuração de custos.

**Botões «Editar»:**

- **Chapa da máquina:** carregue em **«Editar»**, introduza a senha, altere os valores e no fim carregue em **«Concluir»**. Ao mudar de máquina, a chapa volta a ficar protegida.
- **Registo já guardado:** abre só para leitura (pode imprimir ou exportar). Para o alterar, carregue em **«Editar»** na barra de cima e introduza a senha.

**Mudar a senha:** menu **⋮** → **«Alterar senha»**. Pede a senha atual e a nova duas vezes (mínimo 6 caracteres).

Por segurança, depois de 5 tentativas erradas seguidas é preciso esperar 30 segundos.
Se esquecer a senha, contacte o responsável pela aplicação. Os dados não se perdem.

## 7. Utilização do dia a dia

- **Adicionar empresa:** botão «Adicionar Empresa», em baixo à esquerda.
- **Adicionar máquina, renomear ou remover empresa:** passe o rato sobre o nome da empresa e use os botões **+**, **lápis** e **caixote do lixo**.
- **Pesquisar:** escreva no campo «Pesquisar…» no topo da lista. Não é preciso acentos («maquina» encontra «Máquina»). A tecla Esc limpa a pesquisa.
- **Registo de manutenção novo:** botão **+** redondo ao lado do nome da máquina (ou «Criar Registo Diário»).
  - Primeiro escolha a **data da intervenção**. É obrigatória e não pode ser no futuro.
  - Indique o **técnico** e o **tipo de manutenção** (Preventiva, Corretiva, Inspeção…) no quadro «Documentos e custos», por cima da folha.
  - Só depois de escolher a data é possível escrever, gravar, imprimir ou exportar.
  - **«Gravar»** (ou Ctrl+S) grava e fecha. **«Aplicar»** grava e deixa o registo aberto, por exemplo para logo a seguir anexar documentos ou criar a folha de custos.
- **Imprimir:** dentro do registo, botão **«Imprimir»** (ou Ctrl+P). Na lista de registos, o ícone da **impressora** imprime sem abrir o registo. Abre-se a janela normal de impressão, onde escolhe a impressora e o número de cópias.
- **Exportar PDF:** dentro do registo, botão «Exportar PDF».

A aplicação lembra-se da última máquina aberta e do tamanho da janela.


## 8. Pastas por mês (vista da empresa)

Clique no **nome de uma empresa** na lista da esquerda. Aparecem os **12 meses do ano**:

- **Verde:** pelo menos uma máquina da empresa tem registo nesse mês.
- **Vermelho (tracejado), «Sem registos»:** mês que já passou sem nenhum registo.
- **Amarelo, «Em curso»:** o mês atual, ainda sem registos.
- **Cinzento:** meses futuros e meses antes de a empresa ter sido criada na aplicação.

Use as setas **‹ ›** para mudar de ano. Clique num mês para ver os registos desse mês numa tabela
(clique nos títulos das colunas para ordenar). Clique no número do registo para o abrir.

**No disco** existem também as pastas, para quem preferir o Explorador do Windows:

```
dados\registos\1_Cerâmica Oliveira, Lda\2026\03-Março\25_2026-03-14_Prensa Hidráulica\
```

- As 12 pastas dos meses do ano são criadas logo (ao criar a empresa e no início de cada ano).
- Dentro do mês fica uma pasta por registo, com os documentos e a folha de custos.
- O número no início dos nomes (`1_`, `25_`) é o número da empresa e do registo. Não o apague.
- Se mudar o nome de uma empresa ou máquina, ou a data de um registo, as pastas são renomeadas
  ou mudadas de mês automaticamente.
- **No Windows as pastas não ficam a vermelho:** as cores só existem dentro da aplicação.
- **Não mude nem apague estas pastas à mão.** Para remover, use a aplicação.

## 9. Documentos e folha de custos

Dentro de um registo (já gravado), no quadro **«Documentos e custos»**:

- **Criar folha de custos:** cria um ficheiro Excel (`custos_<nº>.xlsx`) na pasta do registo, já com
  a empresa, a máquina, a data, o técnico e os preços por defeito, e abre-o. A partir daí o botão
  passa a **«Abrir folha de custos»**.
  - As células a **amarelo** são para preencher; os totais (mão de obra, oficina, deslocação, peças,
    outros custos, taxa de urgência, desconto, IVA e total) são calculados pelo próprio Excel.
  - A folha está protegida **sem senha** para não apagar fórmulas por engano (no Excel:
    Rever › Desproteger folha).
- **Adicionar ficheiros…:** copia fotos, PDFs, faturas, etc. para a pasta do registo.
- **Abrir pasta:** abre a pasta do registo no Explorador do Windows.
- Duplo clique num documento abre-o no programa habitual.
- **Remover** um documento pede a senha. O ficheiro não é apagado: vai para `dados\registos\_eliminados\`.
- Ao eliminar um registo, máquina ou empresa, as pastas também vão para `_eliminados`.
  Se algum ficheiro estiver aberto (por exemplo no Excel), a aplicação pede para o fechar primeiro.

**Configuração de custos:** menu **⋮** → **«Configuração de custos»**. Define os valores que aparecem
já preenchidos nas folhas novas (preço/hora, horas extra, oficina, viagem, €/km, taxa de urgência e
IVA). Pede a senha. As folhas já criadas não mudam.

**Modelo próprio (opcional):** se quiser outra folha, crie-a no Excel e grave-a como
`dados\modelo_custos.xlsx`. As folhas novas passam a ser cópias desse modelo. Para a aplicação
preencher células automaticamente, dê-lhes estes nomes (no Excel: Fórmulas › Definir Nome):

| Nome | Conteúdo |
|---|---|
| `EMPRESA`, `MAQUINA`, `MARCA_MODELO`, `NUM_SERIE` | Empresa e máquina |
| `DATA`, `TECNICO`, `TIPO`, `NUM_REGISTO`, `TITULO` | Dados do registo |
| `PRECO_HORA`, `PERC_EXTRA`, `PRECO_HORA_OFICINA` | Mão de obra e oficina |
| `PRECO_HORA_VIAGEM`, `PRECO_KM` | Deslocação |
| `PERC_URGENCIA`, `IVA` | Percentagens (ex.: 23% fica 0,23) |

Os nomes que não existirem no modelo são simplesmente ignorados.

## 10. Corretor ortográfico

As palavras com erro ficam sublinhadas a vermelho (português de Portugal). Com o **botão direito**
sobre a palavra aparecem sugestões e «Adicionar ao dicionário». O mesmo menu tem Cortar, Copiar,
Colar e Selecionar tudo.
