/* =============================================================
   PRODUTO: EXTRATO DE CARQUEJA (lançamento em breve)
   Página: /carqueja/  ·  arquivo da página: src/produtos/carqueja.njk
   Imagens: src/assets/img/produtos/carqueja/  ·  cores: src/assets/css/produtos/carqueja.css
   Textos baseados nas fontes listadas em "references" (os números entre colchetes).
   Ao lançar: confirme composição, modo de uso, validade e registro,
   defina preços em shared/catalog.js e troque as ilustrações por fotos.
   ============================================================= */

export default {
  slug: "carqueja",

  product: {
    name: "Extrato de Carqueja Agroecológico",
    shortName: "Extrato de Carqueja",
    size: "30 ml",
    brand: "Elixir da Terra",
    tagline: "Tintura artesanal de carqueja: a erva amarga que cuida por dentro e firma por fora.",
    composition: "Tintura das partes aéreas (caules alados) de carqueja em solução hidroalcoólica.",
    storage: "Conservar em local seco, arejado e protegido da luz.",
    tags: ["100% natural", "Feito à mão", "Planta nativa"],
    description: [
      "Nosso extrato será uma tintura de carqueja (<i>Baccharis crispa</i>, antes chamada <i>Baccharis trimera</i>), a erva de caules alados e sabor amargo que cresce firme em campos e solos pedregosos da América do Sul. Cada lote será preparado e envasado artesanalmente.",
      "Amarga, resistente e cheia de história, a carqueja é usada há gerações na medicina popular brasileira para a digestão e o fígado. Nas tradições de matriz africana, é erva de limpeza, proteção e firmeza."
    ],
    usage: "O modo de uso e a quantidade de gotas serão informados no rótulo e nesta página no lançamento. Agite antes de usar.",
    whatsappText: "Olá! Tenho interesse no Extrato de Carqueja da Elixir da Terra. Pode me avisar quando lançar?"
  },

  // Mesmos kits da Cúrcuma; preços entram no lançamento. "image" = posição da foto na galeria (começa em 0)
  kits: [
    { id: "individual", name: "Primeira Gota", desc: "1 frasco", image: 0 },
    { id: "ritual", name: "Ritual da Terra", desc: "3 frascos", badge: "Recomendado", image: 2 },
    { id: "familia", name: "Elixir da Família", desc: "6 frascos", free: true, image: 3 }
  ],

  gallery: [
    { src: "/assets/img/produtos/carqueja/kit-1.webp", alt: "Ilustração do frasco e da caixa do Extrato de Carqueja Elixir da Terra", w: 1200, h: 1200 },
    { src: "/assets/img/produtos/carqueja/frasco.webp", alt: "Ilustração do frasco de 30 ml do Extrato de Carqueja entre ramos floridos", w: 1200, h: 1200 },
    { src: "/assets/img/produtos/carqueja/kit-3.webp", alt: "Ilustração do kit Ritual da Terra com 3 frascos de Extrato de Carqueja", w: 1200, h: 1200 },
    { src: "/assets/img/produtos/carqueja/kit-6.webp", alt: "Ilustração do kit Elixir da Família com 6 frascos de Extrato de Carqueja", w: 1200, h: 1200 },
    { src: "/assets/img/produtos/carqueja/ramo.webp", alt: "Ilustração botânica de um ramo de carqueja com caules alados e flores amarelas", w: 1200, h: 1200 },
    { src: "/assets/img/produtos/carqueja/flores.webp", alt: "Detalhe ilustrado dos caules alados e das flores amarelas da carqueja", w: 1200, h: 1200 }
  ],

  // Dimensão física: o que a tradição e a ciência dizem (cada item aponta para as fontes)
  body: {
    eyebrow: "No corpo",
    title: "O que a tradição e a ciência dizem",
    lead: "A carqueja é uma das plantas medicinais brasileiras mais estudadas. Separamos o que é reconhecido, o que já foi visto em laboratório e o que é saber popular.",
    disclaimer: "Estudos em laboratório e em animais apontam caminhos, mas não garantem o mesmo efeito em pessoas. O extrato não é medicamento e não trata doenças.",
    cards: [
    { icon: "leaf", title: "Digestão", tag: "Farmacopeia Brasileira",
      text: "É o uso mais antigo da planta. O Formulário de Fitoterápicos da Anvisa descreve a tintura de carqueja como auxiliar no alívio dos sintomas de má digestão (dispepsia), e a tradição a usa como tônica, digestiva e estomacal.",
      refs: [1, 2] },
    { icon: "shield", title: "Fígado", tag: "Estudos em animais",
      text: "É o efeito mais estudado. Em ratos, extratos de carqueja protegeram o fígado contra danos causados por álcool e por paracetamol, reduzindo o estresse oxidativo.",
      refs: [3, 4, 5] },
    { icon: "heart", title: "Estômago", tag: "Estudos em animais",
      text: "Em ratos e camundongos, o extrato hidroalcoólico protegeu o estômago e ajudou a cicatrizar úlceras induzidas por álcool e por ácido, sem sinais de toxicidade nesses modelos.",
      refs: [6] },
    { icon: "spark", title: "Antioxidante", tag: "Revisões científicas",
      text: "Flavonoides, terpenos e ácidos clorogênicos das partes aéreas estão ligados às ações antioxidantes e anti-inflamatórias descritas em revisões da literatura sobre a planta.",
      refs: [7] },
    { icon: "drop", title: "Açúcar no sangue", tag: "Estudos em animais · atenção",
      text: "Em ratos com diabetes, o extrato melhorou a glicemia e a função do fígado. Em pessoas faltam estudos, e a Anvisa alerta: a carqueja pode interagir com remédios para baixar o açúcar no sangue.",
      refs: [8, 1] },
    { icon: "sun", title: "Usos populares", tag: "Tradição",
      text: "Diurética, \"para emagrecer\" e para o colesterol são usos populares muito citados, com estudos iniciais em animais. São caminhos de pesquisa, não promessas de resultado.",
      refs: [9, 5, 27] }
    ]
  },

  // Dimensão energética: proteção e firmeza (tradições de matriz africana e espiritualidade popular)
  spirit: {
    eyebrow: "Na dimensão energética",
    title: "A erva amarga que limpa, protege e firma",
    intro: [
      { t: "Nas tradições de matriz africana, as folhas são sagradas: \"sem folha não há orixá\". Na Umbanda, várias casas colocam a carqueja entre as ervas de Ogum, o orixá dos caminhos e das batalhas, usadas no banho de descarrego.", refs: [25, 10, 13] },
      { t: "Ela é chamada de \"amargura que limpa\": uma erva de purificação profunda, ligada ao descarrego e à quebra de magias. As ervas de Ogum entram em banhos, defumações, firmezas e oferendas.", refs: [11, 12] }
    ],
    pillars: [
      { title: "Limpeza", text: "Erva de descarrego: usada no banho para tirar o peso acumulado e renovar as forças.", refs: [10, 11] },
      { title: "Proteção", text: "Ligada a Ogum, que abre caminhos e corta o que atrapalha. Há casas que também a associam a Iansã.", refs: [11, 12] },
      { title: "Firmeza", text: "Cresce em terra seca e pedregosa, à beira das estradas. Uma planta que se mantém de pé onde poucas resistem.", refs: [14, 11] }
    ],
    notes: [
      { t: "Por ser caule e não folha tenra, a tradição ensina a prepará-la na água quente, abafada, e não macerada.", refs: [15] },
      { t: "Cada casa tem seu fundamento: há quem a chame de erva quente, há quem a chame de morna, e há terreiros que não a usam em ritual. Siga a orientação da sua casa.", refs: [12, 16, 17] }
    ],
    small: "O extrato é feito para uso oral. Banhos e defumações são práticas da tradição, feitas com a erva e com orientação de quem conhece o fundamento."
  },

  // A planta
  plant: {
    eyebrow: "A planta",
    title: "Carqueja, a erva dos caules alados",
    image: { src: "/assets/img/produtos/carqueja/ramo.webp", alt: "Ilustração botânica de um ramo de carqueja, com caules de três asas e flores amarelas nas pontas", w: 1200, h: 1200 },
    note: { t: "Várias espécies de <i>Baccharis</i> são vendidas como \"carqueja\". Saber exatamente qual planta vai no frasco é parte do cuidado.", refs: [26, 21] },
    facts: [
    { k: "Nome científico", v: "<i>Baccharis crispa</i> Spreng. (sinônimo de <i>Baccharis trimera</i>)", refs: [18, 19] },
    { k: "Família", v: "Asteraceae, a mesma das margaridas e da camomila", refs: [18] },
    { k: "Como reconhecer", v: "Caules quase sem folhas, com três asas verdes interrompidas ao longo do ramo", refs: [20] },
    { k: "Flores", v: "Pequenas e amarelas, reunidas em capítulos nas pontas dos ramos; há plantas masculinas e femininas", refs: [20, 21] },
    { k: "Onde e quando", v: "Nativa da América do Sul; floresce de outubro a março em campos do Pampa, Mata Atlântica, Cerrado e Caatinga", refs: [18] },
    { k: "No SUS", v: "Está na Relação Nacional de Plantas Medicinais de Interesse ao SUS (Renisus), e o SUS distribui fitoterápicos de carqueja", refs: [22, 23] }
    ]
  },

  careRefs: [1, 24],
  care: [
    "Contém álcool. Não use se tiver alergia a plantas da família das margaridas (Asteraceae).",
    "Não indicado para gestantes, lactantes, crianças, pessoas com diabetes ou com problemas com álcool.",
    "A carqueja pode somar efeito a remédios para baixar o açúcar no sangue. Quem usa esses remédios, remédios para pressão ou outros de uso contínuo deve falar com um profissional de saúde antes.",
    "Suspenda o uso duas semanas antes de cirurgias e interrompa em caso de desconforto."
  ],

  faqTitle: "Perguntas sobre a carqueja",
  faq: [
    { q: "O Extrato de Carqueja já está à venda?",
      a: "Ainda não. Estamos preparando o lançamento. Deixe seu WhatsApp ou e-mail no formulário desta página e avisamos você assim que chegar." },
    { q: "Qual a diferença entre a carqueja e a cúrcuma?",
      a: "A cúrcuma é uma raiz asiática, alaranjada e conhecida pela curcumina. A carqueja é uma erva nativa da América do Sul, de caules alados e sabor amargo, usada tradicionalmente para a digestão e o fígado. São plantas diferentes, com usos que se complementam." },
    { q: "Quem não deve usar?",
      a: "Gestantes, lactantes, crianças, pessoas com diabetes ou com problemas com álcool, e quem tem alergia a plantas da família das margaridas (Asteraceae). Quem usa remédios de uso contínuo, principalmente para diabetes ou pressão, deve consultar um profissional de saúde antes." },
    { q: "A carqueja emagrece?",
      a: "Emagrecer é um dos usos populares mais citados, e há estudos iniciais sobre gordura corporal. Mas não existe promessa de resultado: o extrato não é medicamento e não substitui alimentação, movimento e acompanhamento profissional." },
    { q: "Posso usar a carqueja junto com remédio para diabetes ou pressão?",
      a: "Só com orientação. A Anvisa alerta que a carqueja pode interagir com remédios que baixam o açúcar no sangue, sendo preciso ajustar a dose deles. Converse com seu médico antes de começar." },
    { q: "Como a carqueja é usada nas tradições espirituais?",
      a: "Na Umbanda, muitas casas a usam entre as ervas de Ogum para banhos de descarrego, limpeza e proteção, preparada na água quente e abafada. Os fundamentos variam de casa para casa. O nosso extrato é feito para uso oral; os banhos e defumações são práticas da tradição, feitos com a erva." },
    { q: "Por que uma página antes do lançamento?",
      a: "Para você conhecer a planta com calma, com fontes, e para sabermos quantas pessoas querem o extrato. Quem entra na lista é avisado primeiro." }
  ],

  references: [
    { n: 1, t: "Formulário de Fitoterápicos da Farmacopeia Brasileira, 1º Suplemento — Tintura de Baccharis trimera", s: "Anvisa", u: "https://www.fitoterapiabrasil.com.br/sites/default/files/formulario-fitoterapico/baccharis_trimera.pdf" },
    { n: 2, t: "Considerações sobre a carqueja-amarga (Baccharis trimera)", s: "Oliveira & Saito, Embrapa", u: "https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/12417/1/1987AP001-Saito-Consideracoes-3038.pdf" },
    { n: 3, t: "Protective effect of Baccharis trimera extract on acute hepatic injury (paracetamol)", s: "Evidence-Based Complementary and Alternative Medicine, 2014", u: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4244687/" },
    { n: 4, t: "Efeito antioxidante e hepatoprotetor do extrato aquoso de Baccharis trimera (álcool)", s: "Revista Brasileira de Farmacognosia", u: "https://scielo.br/j/rbfar/a/6w9FB8nwVs98CBD9MpF3LXJ/?lang=en" },
    { n: 5, t: "Hepato- and cardioprotective effects of Baccharis trimera", s: "Anais da Academia Brasileira de Ciências", u: "https://www.scielo.br/j/aabc/a/FvjkNXhs8MT5WDcSt7hHhSk/?lang=en" },
    { n: 6, t: "Hydroethanolic extract of Baccharis trimera promotes gastroprotection and healing of gastric ulcers", s: "PubMed", u: "https://pubmed.ncbi.nlm.nih.gov/27314669" },
    { n: 7, t: "Baccharis trimera: revisão de fitoquímica e atividades biológicas", s: "PubMed (Elsevier, 2018)", u: "https://www.pubmed.gov/30240600/" },
    { n: 8, t: "Baccharis trimera (Carqueja) improves metabolic and redox status in an experimental model of type 1 diabetes", s: "Evidence-Based Complementary and Alternative Medicine, 2018", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6304562" },
    { n: 9, t: "Carqueja: para que serve", s: "Tua Saúde", u: "https://www.tuasaude.com/beneficios-do-cha-de-carqueja/amp/" },
    { n: 10, t: "Amalás e ervas — ervas de Ogum para banho de descarrego", s: "Casa Pai Maneco", u: "https://www.paimaneco.org.br/entidades/amalas-e-ervas/" },
    { n: 11, t: "Ervas de Ogum: força, corte e proteção espiritual", s: "Nossas Vidas", u: "https://nossasvidas.com.br/index.php?catid=91&id=633&option=com_content&view=article" },
    { n: 12, t: "Ervas de Ogum", s: "Jornal TSA", u: "https://jornaltsa.org/?p=1997" },
    { n: 13, t: "Ervas na Umbanda", s: "Luz de Umbanda", u: "https://umbandayorima.blogspot.com/2014/11/ervas-na-umbanda.html?m=1" },
    { n: 14, t: "Carqueja pó — ficha técnica", s: "Farmacam", u: "https://institucional.farmacam.com.br/?p=21935" },
    { n: 15, t: "Ervas — guia de banhos e defumação", s: "IdeiaSUS / Fiocruz", u: "https://ideiasus.fiocruz.br/wp-content/uploads/2025/08/ErvasFlowsize.pdf" },
    { n: 16, t: "Ogum: exemplo de oferendas e elementos", s: "Guerreiros da Luz", u: "https://gdaluz.blogspot.com/2021/10/ogum-exemplo-de-oferendas-e-elementos.html" },
    { n: 17, t: "Ervas e folhas de Ogum", s: "Candomblé — Uma Família de Axé", u: "https://candombleumafamiliadeaxe.comunidades.net/ervas-folhas-ogum" },
    { n: 18, t: "Baccharis crispa", s: "Flora Campestre — UFRGS", u: "https://www.ufrgs.br/floracampestre/?p=2257" },
    { n: 19, t: "Baccharis genistelloides subsp. crispa e sinônimos", s: "World Flora Online", u: "https://list.worldfloraonline.org/wfo-0000011819" },
    { n: 20, t: "Carqueja — ficha de cultivo", s: "Embrapa", u: "https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/812815/1/FOL79.pdf" },
    { n: 21, t: "Plantas do gênero Baccharis em fitoterapia", s: "Infarma — Conselho Federal de Farmácia", u: "https://revistas.cff.org.br/infarma/article/download/207/195/780" },
    { n: 22, t: "Relação Nacional de Plantas Medicinais de Interesse ao SUS (Renisus)", s: "Ministério da Saúde", u: "https://www.gov.br/saude/pt-br/composicao/sectics/plantas-medicinais-e-fitoterapicos/ppnpmf/arquivos/2014/renisus.pdf" },
    { n: 23, t: "Lista de fitoterápicos disponíveis na BNAFAR/SUS — 2025", s: "Ministério da Saúde", u: "https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-no-1-2025-sectics/lista-de-fitoterapicos-disponiveis-na-bnafar" },
    { n: 24, t: "Baccharis trimera: efeito em ratas prenhes (rins e fígado)", s: "Journal of Ethnopharmacology, 2008", u: "https://pesquisa.bvsalud.org/bvsespana/resource/es/mdl-18346859" },
    { n: 25, t: "Plantas rituais no candomblé: \"Kosi ewe, kosi orixá\"", s: "Revista do Museu de Arqueologia e Etnologia — USP", u: "https://journals.usp.br/revmae/article/download/89745/92557/128489" },
    { n: 26, t: "Baccharis: de filho de Júpiter a vassoura e carqueja — os problemas dos produtos comercializados", s: "Scientia Naturalis — UFAC, 2022", u: "https://periodicos.ufac.br/index.php/SciNat/article/view/6249/3866" },
    { n: 27, t: "Carqueja — informativo técnico", s: "Farmacam, 2025", u: "https://institucional.farmacam.com.br/wp-content/uploads/2025/09/Carqueja-Farmacam-2025.pdf" }
  ]
};
