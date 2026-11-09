/* Casa & Mesa — receitas iniciais (os ids são os da versão 3 para manter compatibilidade). */
window.CM_DEFAULT_RECIPES = [
  ['Arroz de frango', 2, '300 g | arroz\n350 g | frango\n1 un | cebola\n2 colher | azeite', 'Refogar a cebola no azeite, juntar o frango e o arroz, cobrir com água e cozinhar até o arroz estar pronto e o frango bem cozinhado.'],
  ['Salmão no forno', 2, '2 un | posta de salmão\n400 g | batata\n1 un | limão\n2 colher | azeite', 'Temperar e levar ao forno a 190 ºC até cozinhar.'],
  ['Massa à bolonhesa', 2, '250 g | massa\n300 g | carne picada\n200 g | tomate\n1 un | cebola', 'Cozer a massa e preparar o molho com os restantes ingredientes.'],
  ['Omelete de legumes', 2, '4 un | ovo\n1 un | curgete\n1 un | cebola\n1 colher | azeite', 'Saltear os legumes e juntar os ovos batidos.'],
  ['Sopa de legumes', 2, '2 un | cenoura\n2 un | batata\n1 un | curgete\n1 un | cebola', 'Cozer os legumes em água e triturar.'],
  ['Bacalhau com grão', 2, '300 g | bacalhau\n300 g | grão-de-bico\n2 un | ovo\n1 un | cebola', 'Cozer o bacalhau e os ovos e servir com grão.'],
  ['Frango grelhado com arroz', 2, '350 g | peito de frango\n200 g | arroz\n1 un | limão', 'Grelhar o frango e acompanhar com arroz.'],
  ['Salada de atum', 2, '2 lata | atum\n2 un | tomate\n1 un | alface\n2 un | ovo', 'Misturar os ingredientes e servir fresco.']
].map((r, i) => ({ id: 'r' + i, name: r[0], servings: r[1], ingredients: r[2], instructions: r[3] }));

window.CM_LIBRARY = [
  ['Frango no forno com batatas', '500 g | peito ou coxas de frango\n500 g | batatas\n1 un | cebola\n2 dentes | alho\n2 colher | azeite', 'Aquecer o forno a 200 ºC. Cortar batatas e cebola, temperar com alho e azeite. Juntar o frango e assar 40–50 minutos, verificando que fica bem cozinhado.'],
  ['Arroz de atum e tomate', '180 g | arroz\n2 lata | atum\n250 g | tomate\n1 un | cebola\n1 colher | azeite', 'Refogar a cebola no azeite. Juntar tomate picado e arroz, adicionar água conforme o arroz utilizado e cozinhar. Misturar o atum escorrido no final.'],
  ['Massa com cogumelos e espinafres', '200 g | massa\n200 g | cogumelos\n120 g | espinafres\n2 dentes | alho\n2 colher | azeite', 'Cozer a massa. Saltear alho e cogumelos no azeite, adicionar espinafres e envolver a massa com um pouco da água da cozedura.'],
  ['Salmão com legumes no forno', '300 g | salmão\n1 un | curgete\n2 un | cenoura\n300 g | batata\n1 colher | azeite', 'Cortar os legumes e levar ao forno a 200 ºC durante 20 minutos. Adicionar o salmão temperado e assar mais 12–18 minutos, até estar cozinhado.'],
  ['Omelete de espinafres com salada', '4 un | ovos\n100 g | espinafres\n2 un | tomate\n1 un | alface\n1 colher | azeite', 'Bater os ovos. Saltear os espinafres, juntar os ovos e cozinhar a omelete dos dois lados. Servir com salada lavada.'],
  ['Feijão estufado com arroz', '400 g | feijão cozido\n160 g | arroz\n1 un | cebola\n200 g | tomate\n1 un | cenoura', 'Cozer o arroz. Refogar cebola, cenoura e tomate com um pouco de água; juntar feijão escorrido e cozinhar 10 minutos. Servir com arroz.'],
  ['Peru salteado com cuscuz', '350 g | peito de peru\n160 g | cuscuz\n1 un | pimento\n1 un | curgete\n2 colher | azeite', 'Hidratar o cuscuz conforme a embalagem. Cortar o peru em tiras e saltear até cozinhar completamente. Adicionar pimento e curgete e servir com cuscuz.'],
  ['Sopa de legumes e tostas de queijo', '400 g | abóbora\n2 un | cenoura\n2 un | batata\n1 un | alho francês\n4 fatias | pão\n2 fatias | queijo', 'Cozer os legumes cortados em água até ficarem macios e triturar. Tostar o pão com queijo e servir com a sopa.'],
  ['Pescada com puré e brócolos', '350 g | filetes de pescada\n450 g | batata\n250 g | brócolos\n100 ml | leite\n1 colher | azeite', 'Cozer as batatas e esmagar com leite para fazer puré. Cozer os brócolos ao vapor. Cozinhar a pescada numa frigideira com azeite até ficar bem cozinhada.'],
  ['Caril suave de grão', '400 g | grão cozido\n200 ml | leite de coco\n200 g | tomate\n1 un | cebola\n160 g | arroz\n1 colher | caril', 'Cozer o arroz. Refogar cebola, juntar tomate, grão, leite de coco e caril. Cozinhar 15 minutos e servir com arroz.'],
  ['Esparguete à bolonhesa', '200 g | esparguete\n300 g | carne picada\n300 g | polpa de tomate\n1 un | cebola\n1 un | cenoura', 'Cozer o esparguete. Refogar cebola e cenoura, juntar a carne e cozinhar completamente. Adicionar polpa de tomate e apurar 15 minutos.'],
  ['Salada de grão com ovo', '400 g | grão cozido\n4 un | ovos\n2 un | tomate\n1 un | pepino\n1 colher | azeite', 'Cozer os ovos até ficarem firmes. Misturar grão escorrido com tomate e pepino lavados e cortados. Juntar ovos e temperar com azeite.'],
  ['Arroz de frango com ervilhas', '300 g | frango\n180 g | arroz\n150 g | ervilhas\n1 un | cebola\n1 un | cenoura', 'Cozer o frango completamente e desfiar. Refogar cebola e cenoura, juntar arroz, água e ervilhas. Incorporar o frango e cozinhar até o arroz estar pronto.'],
  ['Batata-doce recheada com feijão', '2 un | batata-doce\n250 g | feijão preto cozido\n150 g | tomate\n1 un | cebola\n2 colher | iogurte natural', 'Assar batatas-doces a 200 ºC até ficarem macias. Aquecer feijão com cebola e tomate, abrir as batatas e rechear. Terminar com iogurte.'],
  ['Tortilha de batata e legumes', '4 un | ovos\n350 g | batata\n1 un | cebola\n1 un | pimento\n1 colher | azeite', 'Cozer previamente a batata em cubos. Saltear cebola e pimento, adicionar batata e ovos batidos. Cozinhar em lume brando dos dois lados.'],
  ['Massa de frango e brócolos', '200 g | massa\n300 g | frango\n200 g | brócolos\n2 dentes | alho\n1 colher | azeite', 'Cozer massa e brócolos. Saltear o frango em cubos com alho e azeite até estar bem cozinhado. Envolver tudo.']
].map(([name, ingredients, instructions]) => ({
  id: 'gen-' + name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'),
  name, servings: 2, ingredients, instructions
}));
