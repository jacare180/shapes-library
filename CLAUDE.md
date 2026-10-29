# Shapes Library

Biblioteca digital pessoal do Beny: livros lidos, em leitura e para ler, anotações, notas por critério e metas anuais. Vibe de biblioteca à noite (madeira, placas de latão, lombadas de couro, papel creme). Clicar num livro o tira da estante e abre com animação 3D.

No ar em https://shapes-library.benyforma.workers.dev (Workers Builds, publica a cada push na `main`). Repo `jacare180/shapes-library` (privado). Nasceu numa pasta do repo `jacare180/beny`; o Claude não consegue criar repositórios (a integração do GitHub recusa com 403), então o usuário criou este vazio.

## Arquitetura

Cloudflare Workers (site estático + API) com banco D1, HTML/CSS/JS puro sem build. Saiu do Netlify para não gastar os créditos da conta, que são do app de viagem `jacare180/sadosboets`.

- `public/`: o site. `index.html` carrega `js/app.js` como módulo ES. Rotas por hash: `#/` (estante), `#/livro/<id>`, `#/metas`, `#/ajustes`
  - `js/api.js`: estado em memória, cópia em localStorage (abre na hora e offline), gravação otimista
  - `js/shelf.js`: prateleiras por situação (Lendo agora, Lido, Quero ler, Abandonado), lombadas com largura pelo número de páginas
  - `js/book-open.js`: o livro 3D (capas, lombada, bordas das páginas) e as animações de abrir, fechar e virar página. A origem da transformação fica na lombada: no começo ela coincide com a lombada clicada na estante e, aberto, fica no meio da tela
  - `js/book-page.js`: o que está escrito no livro aberto. Página esquerda: ficha, situação, datas, progresso, notas por critério, nota geral, resenha. Direita: anotações (citação, reflexão, resumo, com página)
  - `js/forms.js`: novo livro (busca nos catálogos ou à mão) e editar dados
  - `js/goals.js`: meta anual de livros e páginas, ritmo, "estante do ano" com lugares vazios, gráfico mês a mês
  - `js/settings.js`: critérios de avaliação por tipo, backup em JSON, importar (backup ou arquivo preparado), sair do aparelho
  - Livro pode ter `link` e `linkLabel` (ex.: a página do Notion), mostrados na ficha
- `src/worker.js`: API, tudo exige a chave (`x-library-key` = secret `KEY_OWNER`). Só `/api/*` passa pelo Worker (`run_worker_first`); o resto são arquivos de `public/`
  - `GET /api/state` | `POST /api/write {op: set|update|delete, path, data}` | `POST /api/import {docs: [{path, data}]}` (até 500, em lote; mesmo caminho sobrescreve, então reimportar não duplica) | `GET /api/search?q=`
  - D1, tabela `docs (path, coll, data, updated_at)`, criada pelo próprio Worker na primeira chamada. Uma linha por documento, para gravações do PC e do celular não se sobrescreverem: `books/<id>`, `reads/<id>`, `notes/<id>`, `goals/<ano>`, `config/criteria`. A biblioteca inteira vem numa consulta só
  - **Livro** e **Leitura** são separados: cada releitura é uma nova leitura com suas próprias datas e notas. A leitura atual é a mais recente
  - Livro removido fica com `deleted: true` (some da API, mas continua no banco)
  - Busca: Google Books (secret opcional `GOOGLE_BOOKS_KEY`) e Open Library ao mesmo tempo; se um falha, o outro responde. Com `SHAPES_FAKE_SEARCH` responde com o catálogo de exemplo de `src/sample-search.js`
- `wrangler.jsonc`: produção é o Worker `shapes-library` com o banco `shapes-library`; testes vão para `--env preview`, Worker `shapes-library-preview` com o banco `shapes-library-preview`. Teste nunca toca nos dados reais (no SA dos Boets a branch mexia neles)
- `dev/seed.mjs`: põe livros de exemplo numa biblioteca local

## Rodar localmente

```
npm install
cp .dev.vars.example .dev.vars   # KEY_OWNER=teste e busca de exemplo
npm run dev                      # http://localhost:8787/?k=teste (D1 local em .wrangler/)
npm run seed                     # livros de exemplo
```

## Notion

Antes da Shapes Library, as leituras ficavam na base "Fila de leitura" do Notion (`collection://73872891-253b-43b7-b5e7-77fa2d029b1b`, página "Livros para ler"), lida pelo artifact "Estante de Leitura". Importada em 29/10/2026 com ids `notion-<fim do id da página>`: Por que ler, Observação e Conexões no registro (FilosoX) viraram anotações; Tema virou gênero e tags; Ordem virou a ordem nas prateleiras.

## Regras

- Interface em português. Sem travessões nos textos
- Critérios padrão (editáveis em Ajustes). Ficção: Escrita, Enredo, Personagens, Ritmo, Impacto emocional, Vontade de reler. Não ficção: Clareza, Profundidade, Aplicabilidade, Originalidade, Vontade de reler. Notas de 1 a 5; tocar de novo no mesmo ponto apaga
- Identidade: madeira escura, latão (`--brass`), couro, papel `--paper`, acento bordô `--accent`. Fontes Cormorant Garamond (títulos) e EB Garamond (texto)
- Respeitar `prefers-reduced-motion` (o livro abre sem voar da estante)
- Funcionar com toque: nada pode depender de passar o mouse

## Deploy (Cloudflare)

- Workers Builds ligado ao repo do GitHub: cada push na `main` publica em produção (`npx wrangler deploy`). Outras branches rodam `npx wrangler preview`, que usa o bloco `previews` do `wrangler.jsonc` (banco `shapes-library-preview`). Nunca usar `wrangler versions upload` para branches: as versões usam o banco de produção
- Sem `database_id` no `wrangler.jsonc`: o Wrangler cria os bancos D1 no primeiro deploy
- `KEY_OWNER` como Secret no Worker (Settings > Variables and Secrets), em `shapes-library` e em `shapes-library-preview`, com chaves diferentes
- Plano grátis com limites diários (zeram 00:00 UTC). Desde 01/09/2026, D1 acima do limite diário falha até o dia seguinte; uso pessoal fica muito abaixo
- Repo privado funciona: a Cloudflare publica os commits do Claude (no Netlify e na Vercel grátis não publicaria)
- A sessão de nuvem do Claude não alcança `*.workers.dev` nem a API da Cloudflare: testes no site publicado são feitos pelo usuário
- Entrar num aparelho: abrir `https://<site>/?k=CHAVE` uma vez; a chave fica no aparelho e sai da barra de endereço

## Pendente

Lista completa em `README.md` ("O que falta"). Primeiro: testar a busca real e o iPhone.
