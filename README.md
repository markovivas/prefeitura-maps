# 🏛️ Prefeitura Municipal — MVP de Navegação Indoor

Sistema web completo de **mapeamento e navegação indoor (interno e externo)** desenvolvido para guiar cidadãos e servidores dentro do Paço Municipal e demais prédios da Prefeitura.

Funciona diretamente no navegador (**celular via QR Code, totem de autoatendimento ou desktop**), sem necessidade de instalar aplicativos.

---

## 📐 Arquitetura do Sistema

O projeto utiliza uma arquitetura enxuta baseada em **4 containers Docker** (sem dependência inicial de GeoServer), comunicando **MapLibre GL JS**, **FastAPI** e **PostgreSQL/PostGIS** através de um proxy reverso **NGINX**:

```text
                         ┌─────────────────────┐
                         │     Navegador       │
                         │  Celular / Desktop  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    indoor_nginx     │
                         │    Proxy (:80)      │
                         └──────────┬──────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │ (/* e /admin)                     │ (/api/* e /docs)
                  ▼                                   ▼
        ┌──────────────────┐                ┌──────────────────┐
        │ indoor_frontend  │                │    indoor_api    │
        │  MapLibre GL JS  │                │     FastAPI      │
        └────────┬─────────┘                └────────┬─────────┘
                 │                                   │
                 │                         ┌─────────▼─────────┐
                 │                         │     indoor_db     │
                 │                         │ PostgreSQL/PostGIS│
                 │                         └─────────┬─────────┘
                 │                                   │
                 └──────────────┬────────────────────┘
                                ▼
                       ┌─────────────────┐
                       │ Indoor GeoJSON  │
                       │ + Nós + Rotas   │
                       │   (Dijkstra)    │
                       └─────────────────┘
```

### Containers Orquestrados (`docker-compose.yml`)

| Container | Imagem / Build | Porta | Responsabilidade |
| :--- | :--- | :--- | :--- |
| **`indoor_nginx`** | `nginx:1.27-alpine` | `80:80` | Ponto único de entrada. Roteia `/` e `/admin` para o frontend e `/api/*` e `/docs` para o backend. |
| **`indoor_frontend`** | `./frontend/Dockerfile` | `80` (interna) | Interface interativa em **MapLibre GL JS v4.7.1** e Painel Administrativo (`/admin`). |
| **`indoor_api`** | `./backend/Dockerfile` | `8000:8000` | API REST em **Python 3.11 + FastAPI**, integração espacial PostGIS e motor de roteamento **Dijkstra**. |
| **`indoor_db`** | `postgis/postgis:16-3.4-alpine` | `5432:5432` | Banco de dados espacial **PostgreSQL 16 + PostGIS 3.4** com inicialização automática (`01_schema.sql` e `02_seed.sql`). |

---

## ✨ Funcionalidades Implementadas no MVP

1. **Mapa Externo Integrado ao OpenStreetMap**
   - Exibe a localização do prédio da **Prefeitura Municipal de Três Corações — MG** (`Av. Brasil, 225 - Jardim América`) no mapa da cidade com marcador interativo (`📍 Prefeitura Municipal de Três Corações`).
   - Botão **"Entrar no mapa interno"** que realiza transição suave de câmera (`flyTo`) para a planta interna.
2. **Planta Indoor Multi-Andar (`Térreo` e `1º Andar`)**
   - Renderização vetorial de alta precisão via GeoJSON (`EPSG:4326`): contorno do pavimento, corredores de circulação e salas categorizadas por cores (Recepção, Atendimento, Secretarias/Admin, Circulação Vertical e Sanitários).
   - Seletor flutuante de andares (`[ Térreo ] [ 1º Andar ]`) e alternância de inclinação **2D / 3D**.
   - Botão **"🕸️ Ver Grafo (Nós)"** para inspecionar visualmente os nós e arestas de roteamento sobre a planta.
3. **Busca Inteligente de Salas e Serviços**
   - Pesquisa em tempo real por número da sala (`101`, `102`, `201`), sigla (`ISS`, `SEPLAN`, `RH`) ou serviço/secretaria (`Dívida Ativa`, `Finanças`, `Obras`, `Licitações`).
   - Filtro rápido por andar e card de detalhes da sala com horário de atendimento e descrição dos serviços.
4. **Roteamento Indoor Multi-Andar (Algoritmo de Dijkstra)**
   - Calcula o caminho mais curto entre qualquer sala de origem e destino, inclusive trocando de andar.
   - **Filtro de Acessibilidade (`♿ Priorizar rota acessível`)**: quando marcado, evita escadas (`is_accessible = false`) e direciona automaticamente pelo **Elevador**.
   - Instruções passo a passo consolidadas com distância em metros e tempo estimado de caminhada.
   - Marcador interativo de transição no mapa (`⬆ Ir para 1º Andar`) ao chegar no elevador ou escada.
5. **Suporte a QR Code ("Você está aqui")**
   - Modal gerador de QR Code que cria links diretos com parâmetros de origem e destino (`/?from_room=1&to_room=3`), ideal para totens na recepção ou placas nas portas.
6. **Painel Administrativo (`/admin`)**
   - Interface dedicada para visualizar indicadores do banco e cadastrar/editar/excluir **Prédios**, **Andares**, **Salas** e **Pontos de Navegação (Nós)**.

---

## 📂 Estrutura de Diretórios e Arquivos

```text
prefeitura-maps/
│
├── docker-compose.yml                      # Orquestração dos containers (db, api, frontend, nginx)
├── .env                                    # Variáveis de ambiente ativas
├── .env.example                            # Modelo de variáveis de ambiente
├── .gitignore                              # Arquivos ignorados pelo Git
├── README.md                               # Documentação do projeto
│
├── nginx/
│   └── nginx.conf                          # Configuração do Proxy Reverso principal (:80)
│
├── data/
│   ├── postgres/
│   │   ├── 01_schema.sql                   # Criação da extensão PostGIS, tabelas e índices GIST
│   │   └── 02_seed.sql                     # Carga inicial: Prefeitura, 2 andares, 16 salas, 22 nós e 40 arestas
│   └── geojson/
│       └── prefeitura_demo.geojson         # Arquivo GeoJSON consolidado de referência
│
├── indoor/                                 # Coleções GeoJSON modulares de referência/importação
│   ├── buildings/
│   │   └── prefeitura_municipal.geojson    # Polígono externo (footprint) do prédio
│   ├── floors/
│   │   ├── terreo.geojson                  # Contorno e corredor do Térreo (level 0)
│   │   └── andar_1.geojson                 # Contorno e corredor do 1º Andar (level 1)
│   ├── rooms/
│   │   ├── terreo_rooms.geojson            # Polígonos das salas do Térreo
│   │   └── andar_1_rooms.geojson           # Polígonos das salas do 1º Andar
│   └── routing/
│       ├── nodes.geojson                   # 22 nós de navegação indoor (Point)
│       └── edges.geojson                   # Arestas de conexão do grafo (LineString)
│
├── backend/
│   ├── Dockerfile                          # Imagem Python 3.11-slim com Uvicorn
│   ├── requirements.txt                    # Dependências: FastAPI, Uvicorn, Psycopg2, Pydantic, Dotenv
│   └── app/
│       ├── __init__.py
│       ├── main.py                         # Aplicação FastAPI e rotas (/api/*)
│       ├── database.py                     # Gerenciador de conexão PostgreSQL/PostGIS
│       ├── routing.py                      # Implementação do algoritmo de Dijkstra multi-andar
│       └── schemas.py                      # Schemas de validação Pydantic (Create/Update)
│
└── frontend/
    ├── Dockerfile                          # Imagem Nginx para servir os arquivos estáticos
    ├── nginx.default.conf                  # Roteamento interno do container frontend (/ e /admin)
    ├── index.html                          # Interface principal do Mapa Interativo
    ├── admin.html                          # Interface do Painel Administrativo (/admin)
    ├── css/
    │   └── styles.css                      # Estilização responsiva (Desktop / Mobile)
    └── js/
        ├── api.js                          # Cliente HTTP para consumo dos endpoints /api/*
        ├── map.js                          # Controlador MapLibre GL JS (fontes, layers, filtros e marcadores)
        ├── app.js                          # Estado da aplicação, busca, rotas e QR Code
        └── admin.js                        # Operações CRUD do painel administrativo
```

---

## ▶️ Como Executar o Projeto

### 1. Subir todos os serviços

Na pasta raiz do projeto, execute:

```bash
docker compose up -d --build
```

Na primeira execução, o container `indoor_db` executará automaticamente os scripts `data/postgres/01_schema.sql` e `data/postgres/02_seed.sql`, criando a estrutura PostGIS e populando o prédio de demonstração.

### 2. Acessar no navegador

- **Mapa Interativo (Cidadão):** [http://localhost](http://localhost)
- **Painel Administrativo:** [http://localhost/admin](http://localhost/admin)
- **Swagger UI (Documentação da API):** [http://localhost/docs](http://localhost/docs)
- **Healthcheck da API + PostGIS:** [http://localhost/api/health](http://localhost/api/health)

### 3. Comandos Úteis de Manutenção

```bash
# Verificar status dos containers
docker compose ps

# Acompanhar logs da API e do Banco em tempo real
docker compose logs -f indoor_api indoor_db

# Parar os containers mantendo os dados do banco
docker compose down

# Resetar completamente o banco de dados e recarregar o seed inicial (01_schema + 02_seed)
docker compose down -v
docker compose up -d --build
```

---

## 🏢 Dados de Demonstração Pré-Carregados

O banco inicial representa a **Prefeitura Municipal de Três Corações — MG** (`Av. Brasil, 225 - Jardim América` | `latitude: -21.670830, longitude: -45.269030`) com **2 pavimentos**, **16 ambientes**, **22 nós de navegação** e **40 conexões direcionadas**:

### Térreo (`level = 0` | `floor_id = 1`)
| ID | Código | Ambiente | Departamento / Serviço | Nó Vinculado |
| :-: | :---: | :--- | :--- | :---: |
| `1` | `REC` | **Recepção** | Atendimento ao Cidadão / Triagem | `N0_REC` (`#1`) |
| `2` | `101` | **Sala 101** | Dívida Ativa e Parcelamento | `N0_101` (`#3`) |
| `3` | `102` | **Sala 102** | ISS e Tributos Mobiliários | `N0_102` (`#4`) |
| `4` | `103` | **Sala 103** | SEPLAN - Planejamento Urbano | `N0_103` (`#6`) |
| `5` | `104` | **Sala 104** | Posto Receita Federal / Protocolo | `N0_104` (`#7`) |
| `6` | `ELEV-0` | **Elevador** | Circulação Vertical Acessível | `N0_ELEV` (`#9`) |
| `7` | `ESC-0` | **Escada** | Circulação Vertical | `N0_ESC` (`#10`) |
| `8` | `WC-0` | **Sanitários Térreo** | Banheiros Acessíveis / PNE | `N0_WC` (`#11`) |

### 1º Andar (`level = 1` | `floor_id = 2`)
| ID | Código | Ambiente | Departamento / Serviço | Nó Vinculado |
| :-: | :---: | :--- | :--- | :---: |
| `9` | `SEC` | **Secretaria Geral** | Gabinete e Secretaria de Governo | `N1_SEC` (`#22`) |
| `10` | `201` | **Sala 201** | Secretaria da Fazenda e Finanças | `N1_201` (`#20`) |
| `11` | `202` | **Sala 202** | Secretaria de Obras e Infraestrutura | `N1_202` (`#21`) |
| `12` | `203` | **Sala 203** | Recursos Humanos (RH) | `N1_203` (`#17`) |
| `13` | `204` | **Sala 204** | Licitações e Contratos | `N1_204` (`#18`) |
| `14` | `ELEV-1` | **Elevador** | Circulação Vertical Acessível | `N1_ELEV` (`#12`) |
| `15` | `ESC-1` | **Escada** | Circulação Vertical | `N1_ESC` (`#13`) |
| `16` | `WC-1` | **Sanitários 1º Andar** | Banheiros Acessíveis / PNE | `N1_WC` (`#14`) |

### Exemplos de Rotas Calculadas pelo Dijkstra

- **Mesmo Andar (`Recepção [id=1] → Sala 102 [id=3]`):**
  - **Distância total:** `32.0 metros`
  - **Instruções:**
    1. Siga pelo corredor principal a partir da Recepção (`22.0 m`)
    2. Vire à esquerda para entrar na Sala 102 (ISS) (`10.0 m`)
- **Entre Andares (`Recepção [id=1] → Sala 201 [id=10]`):**
  - **Distância total:** `85.0 metros` (via Elevador acessível)
  - **Percurso:** Recepção (Térreo) → Corredor Central → Elevador (Térreo) → Elevador (1º Andar) → Corredor 1º Andar → Sala 201 (Finanças).

---

## 🔌 Referência dos Endpoints da API (`FastAPI`)

| Método | Endpoint | Descrição |
| :---: | :--- | :--- |
| `GET` | `/api/health` | Verifica status da API e versão ativa do PostGIS. |
| `GET` | `/api/buildings` | Lista os prédios cadastrados com polígono GeoJSON e lista de andares. |
| `GET` | `/api/buildings/{id}` | Detalhes de um prédio específico. |
| `POST` | `/api/buildings` | Cadastra um novo prédio. |
| `PUT` | `/api/buildings/{id}` | Atualiza nome, endereço ou coordenadas de um prédio. |
| `GET` | `/api/floors` | Lista os pavimentos (`?building_id=1`) com contagem de salas e nós. |
| `POST` | `/api/floors` | Cria um novo pavimento no prédio. |
| `DELETE` | `/api/floors/{id}` | Remove um pavimento. |
| `GET` | `/api/floors/{id}/geojson` | Retorna o `FeatureCollection` GeoJSON completo do andar (contorno, corredor, salas, rótulos, nós e arestas). |
| `GET` | `/api/rooms` | Lista ou pesquisa salas (`?q=ISS&floor_id=1&level=0`). |
| `POST` | `/api/rooms` | Cadastra uma nova sala no PostGIS. |
| `PUT` | `/api/rooms/{id}` | Atualiza dados de uma sala existente. |
| `DELETE` | `/api/rooms/{id}` | Remove uma sala. |
| `GET` | `/api/navigation/nodes` | Lista os nós do grafo de navegação (`?floor_id=1`). |
| `POST` | `/api/navigation/nodes` | Cadastra um novo nó de navegação (`Point`). |
| `DELETE` | `/api/navigation/nodes/{id}` | Remove um nó de navegação. |
| `GET` | `/api/navigation/edges` | Lista todas as arestas do grafo de roteamento. |
| `POST` | `/api/navigation/edges` | Cria uma nova aresta entre dois nós (com opção `bidirectional: true`). |
| `DELETE` | `/api/navigation/edges/{id}` | Remove uma aresta. |
| `GET` | `/api/navigation/route` | Calcula a menor rota via Dijkstra (`?from_room_id=1&to_room_id=10&accessible_only=true`). |
| `GET` | `/api/admin/stats` | Retorna os totais de prédios, andares, salas, nós e arestas para o painel `/admin`. |

---

## 🗺️ Como Substituir pela Planta Oficial da Prefeitura

Quando a planta arquitetônica oficial (DWG, DXF ou PDF) estiver disponível, não é necessário alterar o código do sistema:

```text
PLANTA DWG/PDF  ──►  QGIS (Georreferenciamento EPSG:4326)  ──►  GeoJSON  ──►  PostGIS / Painel /admin
```

1. **Georreferenciamento no QGIS:**
   - Importe a planta baixa no **QGIS** sobre a camada do OpenStreetMap na coordenada real do prédio da Prefeitura.
   - Desenhe os polígonos das salas (`Polygon` em `EPSG:4326`) e os pontos/linhas do corredor para o grafo de navegação.
2. **Importação para o Sistema:**
   - **Opção A (Via Painel Web):** Acesse `http://localhost/admin` para atualizar as coordenadas do prédio, cadastrar os andares, salas e nós de navegação.
   - **Opção B (Via Banco / SQL):** Substitua as geometrias em `data/postgres/02_seed.sql` (ou importe direto no container `indoor_db` usando `ogr2ogr` / `shp2pgsql`) e recrie o volume com `docker compose down -v && docker compose up -d`.
