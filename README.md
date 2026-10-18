# Agrafametal

Aplicação de secretária (Electron + React + SQLite) para gerir empresas-cliente, as suas
máquinas e os registos de manutenção da Agrafametal, Lda.

## Requisitos

- Node.js 20 ou superior
- Para gerar os instaladores do Windows: um PC com Windows (x64)

## Desenvolvimento

```bash
npm install
npm run dev      # abre a app em modo de desenvolvimento
npm run lint     # verificação do código
```

Em desenvolvimento os dados ficam na pasta do utilizador (`%APPDATA%\agrafametal-app\dados`
no Windows).

## Gerar os ficheiros para o cliente (Windows)

```bash
npm install
npm run build:win
```

Os dois ficheiros aparecem na pasta `dist\`:

| Ficheiro                          | Para quê                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `Agrafametal-1.0.0-setup.exe`     | Instalador: instala num PC (dados ficam nesse PC)                 |
| `Agrafametal-1.0.0-portable.exe`  | Versão portátil: copia-se para o disco externo (dados no disco)   |

A versão vem do campo `version` do `package.json`.

## Onde ficam os dados

O mesmo código serve as duas versões (ver `resolverPastaDados()` em `src/main/index.js`):

1. Se existir uma pasta `dados` ao lado do `.exe` e for possível escrever nela, a base de dados
   fica lá (`dados\agrafametal.db`). A versão portátil cria esta pasta na primeira execução.
2. Caso contrário, fica na pasta do utilizador do PC (`%APPDATA%\agrafametal-app\dados`).

As cópias de segurança são guardadas por defeito em `dados\backups\`.
A janela «Acerca» (menu ⋮ no canto inferior esquerdo) mostra a pasta de dados em uso.

## Estrutura

- `src/main/index.js`: processo principal (base de dados, cópias de segurança, PDF, janela)
- `src/preload/index.js`: API exposta à interface (`window.api`)
- `src/renderer/src/App.jsx`: interface
- `src/renderer/src/assets/main.css`: paleta de cores (tokens) e estilos de impressão
- `branding/`: logótipo em SVG (símbolo e logótipo completo; versões clara, escura e mono)
- `build/` e `resources/`: ícones da aplicação
- `popular_db.py`: script para encher uma base de dados com dados de exemplo (testes)
