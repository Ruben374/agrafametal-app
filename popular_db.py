"""
Script para povoar a base de dados SQLite da app Agrafametal com dados de exemplo.

Uso:
    python popular_db.py

Vai pedir o caminho do ficheiro .db (podes arrastar o ficheiro para o terminal
em muitos sistemas, ou colar o caminho manualmente).
"""

import sqlite3
import random
import os
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# DADOS DE EXEMPLO — muda à vontade
# ---------------------------------------------------------------------------

EMPRESAS_DEMO = [
    {
        "nome": "Cerâmica Oliveira, Lda.",
        "maquinas": [
            {"nome": "Prensa Hidráulica 200T", "marca": "SACMI", "modelo": "PH200",
             "serial": "SC-2019-4471", "ano_fab": "2019",
             "elet_v": "400", "elet_hz": "50", "elet_kw": "45",
             "pneu_kgcm2": "6", "hidr_kgcm2": "180", "hidr_lh": "120"},
            {"nome": "Forno Túnel Linha 2", "marca": "Sital", "modelo": "FT-2200",
             "serial": "SI-2017-1029", "ano_fab": "2017",
             "elet_v": "380", "elet_hz": "50", "elet_kw": "90",
             "pneu_kgcm2": "", "hidr_kgcm2": "", "hidr_lh": ""},
        ],
    },
    {
        "nome": "Metalúrgica Nortenha, S.A.",
        "maquinas": [
            {"nome": "Cravadeira SOMME 2", "marca": "SOMME", "modelo": "CS-2",
             "serial": "SM-2021-0087", "ano_fab": "2021",
             "elet_v": "230", "elet_hz": "50", "elet_kw": "5.5",
             "pneu_kgcm2": "8", "hidr_kgcm2": "", "hidr_lh": ""},
            {"nome": "Quinadeira CNC 3000", "marca": "Durma", "modelo": "AD-R 30250",
             "serial": "DR-2020-5532", "ano_fab": "2020",
             "elet_v": "400", "elet_hz": "50", "elet_kw": "22",
             "pneu_kgcm2": "", "hidr_kgcm2": "250", "hidr_lh": "80"},
            {"nome": "Guilhotina Hidráulica", "marca": "Adira", "modelo": "GH-4000",
             "serial": "AD-2018-9012", "ano_fab": "2018",
             "elet_v": "400", "elet_hz": "50", "elet_kw": "15",
             "pneu_kgcm2": "", "hidr_kgcm2": "200", "hidr_lh": "60"},
        ],
    },
    {
        "nome": "Plásticos Aveirense",
        "maquinas": [
            {"nome": "Injetora ENGEL 150", "marca": "ENGEL", "modelo": "E150",
             "serial": "EN-2016-3344", "ano_fab": "2016",
             "elet_v": "400", "elet_hz": "50", "elet_kw": "30",
             "pneu_kgcm2": "", "hidr_kgcm2": "150", "hidr_lh": "100"},
        ],
    },
]

TECNICOS = ["João Silva", "Manuel Costa", "Ricardo Pereira", "André Santos"]
TIPOS_MANUTENCAO = ["Preventiva", "Corretiva", "Inspeção"]

CORPO_RELATORIO_TEMPLATE = """
<p><strong>Descrição da intervenção:</strong></p>
<p>Verificação geral do estado da máquina, lubrificação dos componentes móveis
e inspeção dos níveis de óleo hidráulico. Substituição de filtro de ar.</p>
<p>✓ Sistema elétrico verificado</p>
<p>✓ Pressões dentro dos parâmetros normais</p>
<p>➤ Recomenda-se nova inspeção dentro de 3 meses</p>
"""

# ---------------------------------------------------------------------------
# SCRIPT
# ---------------------------------------------------------------------------

def data_aleatoria(dias_atras_max=365):
    dias = random.randint(0, dias_atras_max)
    return (datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d")


def main():
    caminho = input("Caminho para o ficheiro .db (ex: C:\\Users\\...\\dados\\agrafametal.db): ").strip().strip('"')

    if not caminho:
        print("Nenhum caminho indicado. A terminar.")
        return

    if not os.path.exists(caminho):
        resposta = input(f"O ficheiro '{caminho}' não existe. Criar novo? (s/n): ").strip().lower()
        if resposta != "s":
            print("A terminar sem alterações.")
            return

    conn = sqlite3.connect(caminho)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    # Garante que as tabelas existem (mesmo schema do main.js)
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);

        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            notas TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS maquinas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            nome TEXT NOT NULL,
            marca TEXT, modelo TEXT, serial TEXT, ano_fab TEXT,
            elet_v TEXT, elet_hz TEXT, elet_kw TEXT,
            pneu_kgcm2 TEXT, hidr_kgcm2 TEXT, hidr_lh TEXT,
            estado TEXT DEFAULT 'Operacional',
            notas_tecnicas TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS relatorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maquina_id INTEGER,
            data TEXT NOT NULL,
            tecnico TEXT, tipo_manutencao TEXT DEFAULT 'Preventiva',
            titulo TEXT, corpo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(maquina_id) REFERENCES maquinas(id) ON DELETE CASCADE
        );
    """)

    cur.execute(
        "INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)",
        ("cabecalho_subtitulo", "Serviços Reparação e Manutenção Preventiva"),
    )

    total_empresas = 0
    total_maquinas = 0
    total_relatorios = 0

    for empresa in EMPRESAS_DEMO:
        cur.execute("INSERT INTO empresas (nome) VALUES (?)", (empresa["nome"],))
        empresa_id = cur.lastrowid
        total_empresas += 1

        for maquina in empresa["maquinas"]:
            cur.execute("""
                INSERT INTO maquinas (
                    empresa_id, nome, marca, modelo, serial, ano_fab,
                    elet_v, elet_hz, elet_kw, pneu_kgcm2, hidr_kgcm2, hidr_lh
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                empresa_id, maquina["nome"], maquina["marca"], maquina["modelo"],
                maquina["serial"], maquina["ano_fab"], maquina["elet_v"],
                maquina["elet_hz"], maquina["elet_kw"], maquina["pneu_kgcm2"],
                maquina["hidr_kgcm2"], maquina["hidr_lh"],
            ))
            maquina_id = cur.lastrowid
            total_maquinas += 1

            # 2 a 5 relatórios aleatórios por máquina
            for _ in range(random.randint(2, 5)):
                data = data_aleatoria()
                tecnico = random.choice(TECNICOS)
                tipo = random.choice(TIPOS_MANUTENCAO)
                titulo = f"MANUTENÇÃO {maquina['nome'].upper()}"

                cur.execute("""
                    INSERT INTO relatorios (maquina_id, data, tecnico, tipo_manutencao, titulo, corpo)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (maquina_id, data, tecnico, tipo, titulo, CORPO_RELATORIO_TEMPLATE))
                total_relatorios += 1

    conn.commit()
    conn.close()

    print("\nBase de dados povoada com sucesso!")
    print(f"   Empresas:   {total_empresas}")
    print(f"   Máquinas:   {total_maquinas}")
    print(f"   Relatórios: {total_relatorios}")
    print(f"\nFicheiro: {caminho}")


if __name__ == "__main__":
    main()
