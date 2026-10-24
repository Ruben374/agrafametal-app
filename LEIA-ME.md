# Agrafametal: guia rápido

## 1. Qual dos ficheiros usar?

**Disco externo, para usar em vários computadores:** `Agrafametal-1.1.0-portable.exe`

- Não precisa de instalar nada.
- Copie o ficheiro para uma pasta no disco externo, por exemplo `E:\Agrafametal\`.
- Abra-o com duplo clique. Na primeira vez é criada, ao lado do programa, a pasta `dados`, onde fica toda a informação.
- Ligue o disco a qualquer computador com Windows e abra o mesmo ficheiro: verá sempre os mesmos dados.

```
E:\Agrafametal\
   Agrafametal-1.1.0-portable.exe
   dados\
      agrafametal.db      (a informação)
      backups\            (cópias de segurança)
```

**Um só computador fixo:** `Agrafametal-1.1.0-setup.exe`

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

## 4. Onde estão os dados?

No menu **⋮** (canto inferior esquerdo), escolha **«Acerca da aplicação»**. Aí vê:

- O modo em uso: «Portátil — dados no disco» ou «Instalado — dados neste computador».
- A pasta exata onde estão os dados, com o botão **«Abrir pasta»**.

## 5. Cópias de segurança

**Fazer uma cópia:** menu **⋮** → **«Fazer cópia de segurança»**.

- Por defeito, a cópia é guardada em `dados\backups\` com a data e a hora no nome.
- Recomendação: faça uma cópia regularmente e guarde-a também noutro sítio (outra pen, outro disco ou um serviço na nuvem).

**Restaurar uma cópia:** menu **⋮** → **«Restaurar cópia de segurança»**.

- Escolha o ficheiro `.db` da cópia.
- A aplicação mostra quantas empresas, máquinas e registos a cópia contém e pede confirmação.
- Antes de restaurar, guarda automaticamente uma cópia dos dados atuais (`Antes_do_restauro_…`). Por isso, um restauro feito por engano pode ser desfeito.

## 6. Senha de proteção

A aplicação tem uma **senha** que protege os dados contra alterações por engano ou por
pessoas não autorizadas. A senha é entregue à parte, pelo responsável pela aplicação.

**Não precisa de senha:**

- Consultar, pesquisar, imprimir e exportar PDF.
- Fazer uma cópia de segurança.
- Criar: adicionar empresas, máquinas e registos de manutenção novos. Um registo novo pode ser escrito à vontade até ser guardado pela primeira vez.

**Precisa de senha:**

- Apagar uma empresa, uma máquina ou um registo.
- Mudar o nome de uma empresa.
- Alterar as características da máquina (a «chapa»).
- Alterar um registo já guardado (texto, título ou data).
- Alterar o texto do cabeçalho da folha.
- Restaurar uma cópia de segurança.

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
- **Registo de manutenção novo:** botão «Criar Registo Diário».
  - Primeiro escolha a **data da intervenção**. É obrigatória e não pode ser no futuro.
  - Só depois de escolher a data é possível escrever, guardar, imprimir ou exportar.
  - Use «Guardar» (ou Ctrl+S).
- **Imprimir:** dentro do registo, botão **«Imprimir»** (ou Ctrl+P). Na lista de registos, o ícone da **impressora** imprime sem abrir o registo. Abre-se a janela normal de impressão, onde escolhe a impressora e o número de cópias.
- **Exportar PDF:** dentro do registo, botão «Exportar PDF».

A aplicação lembra-se da última máquina aberta e do tamanho da janela.
