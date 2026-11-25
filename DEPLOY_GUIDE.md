# Guia de Deploy Gratuito (Ambiente de Demonstração)

Este guia orienta o processo de deploy 100% gratuito da plataforma **Baygon**, mantendo os dados atuais do banco local como carga inicial de produção.

---

## 🏗️ Arquitetura de Produção (100% Gratuita)

| Camada | Provedor Recomendado | Plano | Por que essa escolha? |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Hobby (Free) | Otimizado nativamente para Next.js, CDN global ultrarrápida, SSL automático e deploy contínuo via Git. |
| **Backend API** | **Render.com** | Free Web Service | 750 horas/mês gratuitas, suporte nativo a Python/FastAPI/Uvicorn, deploy automático via Git. |
| **Banco de Dados** | **TiDB Cloud** | Serverless (Free Forever) | 100% compatível com MySQL 8.0 (mesmo dialeto do projeto), 5 GB de armazenamento, sem necessidade de cartão de crédito. |

---

## 📦 Artefatos de Dump & Seeder Já Gerados no Projeto

Os scripts e arquivos para exportação e importação já estão prontos no repositório:
- 📄 `scripts/dump_initial_data.sql`: Arquivo SQL com todos os 440 registros das 31 tabelas locais (com chaves estrangeiras desligadas durante a inserção e `INSERT IGNORE`).
- 📄 `scripts/initial_data_dump.json`: Cópia espelhada dos dados em JSON.
- ⚙️ `scripts/export_dump.py`: Script para reexportar novos dumps caso os dados locais sofram alterações.
- 🚀 `scripts/seed_production.py`: Seeder automatizado para popular o banco de produção.
- ⚙️ `Procfile` & `render.yaml`: Configurações de inicialização rápida para o Render.

---

## 🚀 Passo a Passo de Execução

### Passo 1: Criar o Banco de Dados MySQL Grátis (TiDB Cloud)

1. Acesse **[tidbcloud.com](https://tidbcloud.com)** e crie uma conta gratuita (com GitHub ou Google).
2. No painel, clique em **Create Cluster**.
3. Selecione a opção **Serverless (Free)**.
4. Escolha a região mais próxima do seu backend (ex: **AWS us-east-1 / N. Virginia**).
5. Defina o nome do cluster (ex: `baygon-db`) e clique em **Create**.
6. Clique em **Connect** e gere uma senha para o usuário do banco.
7. Selecione o método de conexão **General** ou copie a string de conexão MySQL fornecida:
   ```
   mysql://<usuario>:<senha>@gateway01.<regiao>.prod.aws.tidbcloud.com:4000/<nome_do_banco>?ssl={"rejectUnauthorized":true}
   ```
   > **Nota:** Guarde esta URL! Ela será sua `DATABASE_URL` de produção. O backend do Baygon já foi configurado para converter automaticamente `mysql://` para `mysql+aiomysql://` e habilitar SSL quando necessário.

---

### Passo 2: Rodar as Migrações do Alembic no Banco de Produção

No seu terminal local (com a virtualenv ativada), aponte a variável `DATABASE_URL` temporariamente para o banco de produção e execute as migrações:

**No Windows (PowerShell):**
```powershell
$env:DATABASE_URL="mysql+aiomysql://<usuario>:<senha>@gateway01.<regiao>.prod.aws.tidbcloud.com:4000/<banco>"
alembic -c app/alembic.ini upgrade head
```

**No Linux / macOS (Bash):**
```bash
DATABASE_URL="mysql+aiomysql://<usuario>:<senha>@gateway01.<regiao>.prod.aws.tidbcloud.com:4000/<banco>" alembic -c app/alembic.ini upgrade head
```

Isso criará toda a estrutura de tabelas, índices e relacionamentos em produção exatamente como estão no seu ambiente local.

---

### Passo 3: Popular o Banco de Produção com o Dump Local (Seeder)

Agora execute o seeder passando a URL de produção criada:

```powershell
.\venv\Scripts\python.exe scripts/seed_production.py --db-url "mysql+aiomysql://<usuario>:<senha>@gateway01.<regiao>.prod.aws.tidbcloud.com:4000/<banco>"
```

O script irá:
1. Conectar ao banco em nuvem de forma assíncrona com SSL;
2. Desativar temporariamente a verificação de chaves estrangeiras (`SET FOREIGN_KEY_CHECKS = 0;`);
3. Inserir todos os registros (times, jogadores, partidas, scouts, usuários, enquetes, premiações, fantasy e tenants);
4. Reativar as chaves estrangeiras (`SET FOREIGN_KEY_CHECKS = 1;`).

---

### Passo 4: Deploy do Backend FastAPI (Render.com)

1. Faça commit e push das alterações para o GitHub:
   ```bash
   git add .
   git commit -m "feat: add production seeder and deployment configs"
   git push origin main
   ```
2. Acesse **[render.com](https://render.com)** e faça login com seu GitHub.
3. Clique em **New +** > **Web Service**.
4. Conecte o repositório do **Baygon**.
5. Configure as opções básicas:
   - **Name**: `baygon-api`
   - **Region**: `Ohio (US East)` ou `Oregon (US West)`
   - **Branch**: `main`
   - **Root Directory**: `.` *(deixe em branco ou ponto)*
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
6. Em **Environment Variables**, adicione:
   - `ENVIRONMENT` = `production`
   - `DATABASE_URL` = `<SUA_STRING_DO_TIDB_CLOUD>`
   - `SECRET_KEY` = `b4y60n_d3v_s3cr3t_k3y_2026_x9a8f7c6e5d4b3a2109876543210fedcba`
   - `PHRASE_ENCODE` = `y2SYNH59mqp_7guwTmebiRz5IVRFeNit-_em-A-wYCQ=`
   - `PHRASE_DECODE` = `gAAAAABq5PUfJV4vWTQ83yCXQ7K8QAuToY4AxF5Uuism9lH_5QgW264QKsK1X9Ynuw3L7Pkb4N5vILWxnJSPWtRdCMcGOKykX09mOiuKnWUzrrUTiSQPzaaGiW-9b7JM95w5K2G03XLnSGqY7R9w0oG3EefR93IIuQ==`
7. Clique em **Create Web Service**.
8. Assim que o deploy for concluído, copie a URL gerada (exemplo: `https://baygon-api.onrender.com`).
   - Teste no navegador acessando: `https://baygon-api.onrender.com/docs` para ver o Swagger no ar!

---

### Passo 5: Deploy do Frontend (Vercel)

1. Acesse **[vercel.com](https://vercel.com)** e entre com sua conta do GitHub.
2. Clique em **Add New...** > **Project**.
3. Selecione o repositório do **Baygon**.
4. Nas configurações do projeto:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: clique em `Edit` e selecione a pasta **`web`**.
5. Em **Environment Variables**, configure:
   - `NEXT_PUBLIC_API_URL` = `https://baygon-api.onrender.com/api/v1` *(use a URL real gerada no Passo 4)*
   - `NEXT_PUBLIC_DEFAULT_TENANT` = `baygon`
6. Clique em **Deploy**!
7. Em cerca de 1 a 2 minutos, sua aplicação estará online com certificado SSL gratuito e domínio `https://<nome-do-projeto>.vercel.app`.

---

## 🔒 Credenciais de Acesso em Produção

Após rodar o seeder, o banco de dados estará com as mesmas credenciais do seu ambiente local:
- **URL da Aplicação**: `https://<nome-do-projeto>.vercel.app`
- **Usuário Administrador**: `admin`
- **Senha**: `Admin@123`
