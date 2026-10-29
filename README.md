# Shapes Library

Biblioteca particular: livros lidos, em leitura e para ler, anotações, notas por critério e metas anuais. Clicar num livro o tira da estante e abre com animação.

Detalhes de arquitetura, regras e deploy em `CLAUDE.md`.

## Rodar localmente

```
npm install
cp .dev.vars.example .dev.vars
npm run dev
npm run seed
```

Abra http://localhost:8787/?k=teste

## O que já funciona (MVP)

- Estante com prateleiras Lendo agora, Lido, Quero ler e Abandonado; lombadas de couro com largura pelo número de páginas e marcador nos livros em leitura
- Animação: o livro sai da estante, gira, a capa abre e mostra as páginas; ao fechar, volta para o mesmo lugar
- Ficha: situação, datas, página atual e progresso, notas de 1 a 5 por critério com média, nota geral, resenha, releituras
- Anotações: citação, reflexão ou resumo, com página
- Novo livro pela busca (Google Books e Open Library) ou à mão; editar dados, cor da lombada, tags
- Procurar na estante por título, autor, gênero ou tag
- Metas: livros e páginas por ano, ritmo, estante do ano com lugares vazios, gráfico mês a mês
- Ajustes: critérios por tipo de livro, cópia de segurança em JSON e importar (restaurar cópia ou trazer livros de outro lugar)
- Mesma biblioteca no PC e no celular (dados no Cloudflare D1), ícone e modo app

## O que falta

### Para usar de verdade
1. ~~Repo próprio `jacare180/shapes-library` (privado)~~ feito
2. ~~Worker na Cloudflare ligado ao repo, com o secret `KEY_OWNER`~~ feito: https://shapes-library.benyforma.workers.dev
3. Testar a busca com os catálogos reais (aqui foi testada com um catálogo de exemplo). Se o Google Books esgotar a cota grátis, criar uma `GOOGLE_BOOKS_KEY`
4. Testar no iPhone de verdade: animação 3D no Safari e instalar na tela inicial

### Próximas funcionalidades
- Capas: guardar uma cópia na Cloudflare (R2) (links externos somem) e fotografar a capa pelo celular
- Ler o código de barras (ISBN) com a câmera do celular
- Diário de leitura: páginas por dia, sequência de dias lendo
- Estatísticas: gêneros, autores, nota média, mapa da nacionalidade dos autores
- Estantes personalizadas (coleções) e arrastar livros para reordenar
- Anotações: editar, buscar em todas, citação do dia na entrada, cartão para compartilhar
- Importar do Goodreads (CSV)
- Empréstimos: para quem e quando
- Retrospectiva do ano
- Modo dia (tema claro)
- Offline completo: hoje sem internet dá para ver, mas não para gravar

### Dívidas técnicas
- Testes automatizados no repo (os testes de navegador desta versão rodaram fora dele)
- A chave é única: quem tiver o link com a chave tem acesso total. Se vazar, trocar `KEY_OWNER` e fazer novo deploy
