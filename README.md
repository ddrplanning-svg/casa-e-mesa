# Casa & Mesa

Aplicação web gratuita para organizar as ementas semanais da família: calendário de almoços e jantares, geração automática de ementas, livro de receitas com quantidades ajustadas ao número de pessoas e lista de compras automática.

**Endereço (GitHub Pages):** https://ddrplanning-svg.github.io/casa-e-mesa/

## Funcionalidades

- **Início** — refeições de hoje, progresso da semana, número de pessoas e geração rápida da ementa.
- **Calendário** — segunda a domingo, almoço e jantar; navegação entre semanas (incluindo mudanças de mês e ano); dias por planear assinalados; tocar numa refeição para ver a receita, sugerir outro prato, escolher da lista ou remover; gerar a semana, preencher só os espaços vazios, limpar e imprimir.
- **Receitas** — pesquisa por nome ou ingrediente; criar, editar e apagar; ver ingredientes ajustados ao número de pessoas (1 a 20).
- **Compras** — lista gerada a partir das refeições da semana, com ingredientes iguais agrupados (singular/plural e sinónimos), unidades compatíveis somadas (g+kg, ml+l), unidades incompatíveis mantidas lado a lado, arredondamento para cima de produtos que se compram inteiros, organização por categorias, produtos assinalados por semana, produtos manuais, copiar e imprimir.
- **Definições** — número de pessoas, receitas sugeridas, exportar/importar dados (JSON) e repor a aplicação.

### Formato dos ingredientes

Um ingrediente por linha: `quantidade unidade | ingrediente`

```
500 g | frango
1/2 kg | arroz
1,5 un | cebola
2 colher | azeite
q.b. | sal
```

Unidades reconhecidas: g, kg, ml, cl, dl, l, un, colher, colher de chá, dente, lata, fatia, chávena, embalagem, pacote, frasco, molho, ramo, folha, pitada, posta, filete.

## Dados

Tudo é guardado no `localStorage` do navegador (chave `casaMesaV1`, compatível com a versão 3). Os dados **não são sincronizados** entre dispositivos; use *Definições → Exportar dados* para fazer cópia de segurança ou passar para outro dispositivo.

## Estrutura

```
index.html        estrutura da página
css/styles.css    estilos (mobile-first)
js/core.js        cálculo de quantidades, unidades, categorias e lista de compras
js/data.js        receitas iniciais e sugeridas
js/app.js         interface, calendário, estado e persistência
tests/            testes automáticos
```

Sem dependências, sem build e sem serviços pagos: basta servir a pasta como site estático.

## Testes

```bash
npm test          # lógica de quantidades (Node, sem dependências)
npm run test:e2e  # testes no navegador (requer Playwright instalado)
```

## Executar localmente

```bash
python3 -m http.server 8000
```

Depois abrir http://localhost:8000.
