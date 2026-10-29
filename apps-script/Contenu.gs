// Quiz intégrés. Ils restent côté serveur : un élève ne reçoit que ceux que l'administrateur lui a donnés
// (page ?p=admin, rubrique « Quiz intégrés »). Les quiz créés depuis l'administration sont stockés à part.
var BUILTIN_QUIZZES = [
  {
    "id": "byzance",
    "emoji": "🏰",
    "matiere": "Histoire",
    "titre": "Byzance et l'Europe carolingienne",
    "description": "Justinien, Charlemagne, le schisme de 1054 et la chute de Constantinople.",
    "questions": [
      {
        "question": "Quelles sont les dates qui marquent le début et la fin du Moyen Âge ?",
        "options": [
          "476 et 1492",
          "0 et 1000",
          "800 et 1453",
          "527 et 843"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est la capitale de l'Empire byzantin ?",
        "options": [
          "Aix-la-Chapelle",
          "Rome",
          "Constantinople",
          "Ravenne"
        ],
        "correct": 2
      },
      {
        "question": "Sous quel empereur l'Empire byzantin a-t-il atteint son apogée (527-565) ?",
        "options": [
          "Charlemagne",
          "Justinien",
          "Charles Martel",
          "Louis le Pieux"
        ],
        "correct": 1
      },
      {
        "question": "En quelle année et dans quelle ville Charlemagne a-t-il été sacré empereur ?",
        "options": [
          "En 476 à Ravenne",
          "En 843 à Verdun",
          "En 1054 à Constantinople",
          "En 800 à Rome"
        ],
        "correct": 3
      },
      {
        "question": "Où se situe la capitale de l'Empire carolingien ?",
        "options": [
          "Paris",
          "Aix-la-Chapelle",
          "Lyon",
          "Marseille"
        ],
        "correct": 1
      },
      {
        "question": "Quelle était la langue officielle de l'Empire byzantin ?",
        "options": [
          "Le latin",
          "Le français",
          "L'arabe",
          "Le grec"
        ],
        "correct": 3
      },
      {
        "question": "Comment s'appelle l'épouse de Justinien qui a joué un rôle politique majeur ?",
        "options": [
          "Cléopâtre",
          "Isabelle",
          "Théodora",
          "Jeanne"
        ],
        "correct": 2
      },
      {
        "question": "Comment appelle-t-on la séparation définitive en 1054 entre l'Église orthodoxe et catholique ?",
        "options": [
          "Le schisme",
          "La croisade",
          "L'évangélisation",
          "L'apogée"
        ],
        "correct": 0
      },
      {
        "question": "Qui est le chef spirituel de l'Église orthodoxe ?",
        "options": [
          "Le Pape",
          "L'Évêque",
          "Le Missi Dominici",
          "Le Patriarche"
        ],
        "correct": 3
      },
      {
        "question": "Quel événement marque la fin de l'Empire byzantin en 1453 ?",
        "options": [
          "La mort de Justinien",
          "La prise de Constantinople par les Turcs",
          "Le traité de Verdun",
          "Le couronnement de Charlemagne"
        ],
        "correct": 1
      }
    ]
  },
  {
    "id": "byzance-30",
    "emoji": "🏛️",
    "matiere": "Histoire",
    "titre": "Grand quiz : Byzance et l'Empire carolingien",
    "description": "30 questions avec explications : Moyen Âge, Justinien, Charlemagne, le schisme de 1054.",
    "questions": [
      {
        "question": "En quelle année s'effondre l'Empire romain, marquant le début du Moyen Âge ?",
        "options": [
          "395",
          "476",
          "800",
          "1492"
        ],
        "correct": 1,
        "explication": "La chute de l'Empire romain d'Occident a lieu en 476, ce qui marque le passage de l'Antiquité au Moyen Âge."
      },
      {
        "question": "Quel événement marque historiquement la fin du Moyen Âge en 1492 ?",
        "options": [
          "Le Traité de Verdun",
          "La prise de Constantinople",
          "La « découverte » des Amériques",
          "Le Schisme de l'Église"
        ],
        "correct": 2,
        "explication": "La « découverte » des Amériques par Christophe Colomb en 1492 marque la fin du Moyen Âge et le début de la Renaissance."
      },
      {
        "question": "Combien de temps environ a duré la période du Moyen Âge ?",
        "options": [
          "Environ 100 ans",
          "Environ 500 ans",
          "Plus de mille ans",
          "Près de 2000 ans"
        ],
        "correct": 2,
        "explication": "Le Moyen Âge dure plus de 1000 ans, entre 476 (chute de Rome) et 1492."
      },
      {
        "question": "Que désigne la « légende noire » historiquement associée au Moyen Âge ?",
        "options": [
          "Une image positive d'art et de beauté",
          "L'invention des universités",
          "Une image de chaos, guerres et ignorance",
          "L'expansion des empires romains"
        ],
        "correct": 2,
        "explication": "La « légende noire » qualifie à tort le Moyen Âge de période sombre et ignorante, alors qu'il a été culturellement très riche."
      },
      {
        "question": "Comment appelle-t-on un régime politique centralisé dirigé par un empereur regroupant des peuples divers ?",
        "options": [
          "Une république",
          "Un empire",
          "Une démocratie",
          "Un duché"
        ],
        "correct": 1,
        "explication": "Un empire est un régime centralisé où un empereur dirige des peuples et territoires variés."
      },
      {
        "question": "De quel célèbre dirigeant en Occident descendent les empereurs carolingiens ?",
        "options": [
          "Jules César",
          "Alexandre le Grand",
          "Charles Martel",
          "Auguste"
        ],
        "correct": 2,
        "explication": "L'Empire carolingien regroupe les descendants de Charles Martel en Occident."
      },
      {
        "question": "Sous le règne de quel empereur (527-565) l'Empire byzantin atteint-il son apogée ?",
        "options": [
          "Charlemagne",
          "Justinien",
          "Constantin",
          "Louis le Pieux"
        ],
        "correct": 1,
        "explication": "Justinien (527-565) permet à l'Empire byzantin de reconquérir une grande partie du bassin méditerranéen."
      },
      {
        "question": "Où se situe le cœur territorial de l'Empire byzantin ?",
        "options": [
          "En Gaule et en Italie",
          "En Asie mineure et en Grèce",
          "En Espagne et en Afrique",
          "En Germanie"
        ],
        "correct": 1,
        "explication": "Le cœur historique et territorial de l'Empire byzantin se trouve en Grèce et en Asie mineure."
      },
      {
        "question": "Quel événement met définitivement fin à l'Empire byzantin en 1453 ?",
        "options": [
          "Le Traité de Verdun",
          "La prise de Constantinople par les Turcs",
          "L'invasion des Vikings",
          "Le sacre de Charlemagne"
        ],
        "correct": 1,
        "explication": "En 1453, les Turcs ottomans s'emparent de Constantinople, marquant la fin définitive de l'Empire byzantin."
      },
      {
        "question": "Pendant quelle période Charlemagne a-t-il régné sur l'Empire carolingien ?",
        "options": [
          "527-565",
          "768-814",
          "800-843",
          "1054-1118"
        ],
        "correct": 1,
        "explication": "Charlemagne a régné de 768 à 814. Il est sacré empereur à Rome en l'an 800."
      },
      {
        "question": "Quel traité signé en 843 divise l'Empire carolingien entre les trois petits-fils de Charlemagne ?",
        "options": [
          "Le Traité de Rome",
          "Le Traité de Verdun",
          "Le Traité de Constantinople",
          "Le Traité de Ravenne"
        ],
        "correct": 1,
        "explication": "Le Traité de Verdun (843) partage le vaste empire de Charlemagne en trois royaumes distincts."
      },
      {
        "question": "Quels peuples envahisseurs ont menacé l'Empire carolingien après sa division ?",
        "options": [
          "Les Romains et les Grecs",
          "Les Vikings, les Hongrois et les Musulmans",
          "Les Incas et les Aztèques",
          "Les Perses"
        ],
        "correct": 1,
        "explication": "Aux IXe et Xe siècles, l'Occident carolingien fait face aux invasions des Vikings, des Hongrois et des Musulmans."
      },
      {
        "question": "Sur quelles mers la ville de Constantinople possède-t-elle une ouverture maritime stratégique ?",
        "options": [
          "La mer du Nord et l'Océan Atlantique",
          "La mer Noire et la mer Méditerranée",
          "La mer Rouge et la mer Baltique",
          "La mer Manche"
        ],
        "correct": 1,
        "explication": "Constantinople est une ville carrefour située au contact de la mer Noire et de la mer Méditerranée."
      },
      {
        "question": "Quel est le plus grand monument religieux construit à Constantinople ?",
        "options": [
          "La Chapelle Palatine",
          "La basilique Sainte-Sophie",
          "La cathédrale Saint-Pierre",
          "L'église Saint-Vital"
        ],
        "correct": 1,
        "explication": "La basilique Sainte-Sophie est le cœur et le siège religieux majeur de l'Empire byzantin à Constantinople."
      },
      {
        "question": "Quels éléments d'organisation urbaine et politique les Byzantins conservent-ils des Romains ?",
        "options": [
          "Les pyramides et les temples égyptiens",
          "Le Sénat, les forums et les aqueducs",
          "Les châteaux forts en bois",
          "Les temples païens"
        ],
        "correct": 1,
        "explication": "Les Byzantins s'inspirent directement des Romains en conservant le Sénat, les forums, les thermes et les aqueducs."
      },
      {
        "question": "Pourquoi Charlemagne installe-t-il sa capitale à Aix-la-Chapelle ?",
        "options": [
          "Pour être près de la mer",
          "Car elle est proche de la Saxe qu'il souhaite conquérir",
          "Parce que le Pape y réside",
          "Pour imiter la ville de Rome"
        ],
        "correct": 1,
        "explication": "Aix-la-Chapelle a été choisie par Charlemagne car elle était proche de la Saxe, région qu'il cherchait à soumettre et christianiser."
      },
      {
        "question": "Comment appelle-t-on les lois rédigées par l'empereur Charlemagne ?",
        "options": [
          "Le Code Justinien",
          "Les Capitulaires",
          "Les Mosaïques",
          "Les Papyrus"
        ],
        "correct": 1,
        "explication": "Les capitulaires sont les lois édictées par les empereurs carolingiens pour administrer l'Empire."
      },
      {
        "question": "Quelle était la langue officielle parlée dans l'Empire byzantin ?",
        "options": [
          "Le Latin",
          "Le Grec",
          "L'Arabe",
          "Le Francique"
        ],
        "correct": 1,
        "explication": "Alors que l'Empire romain utilisait le latin, l'Empire byzantin adopte officiellement le grec."
      },
      {
        "question": "Quelle langue était utilisée pour la messe et l'administration dans l'Empire carolingien ?",
        "options": [
          "Le Grec",
          "Le Latin",
          "Le Français moderne",
          "L'Allemand"
        ],
        "correct": 1,
        "explication": "Dans l'Empire carolingien en Occident, le latin reste la langue officielle de l'Église et de l'administration."
      },
      {
        "question": "Combien d'habitants comptait la ville de Constantinople au XIe siècle ?",
        "options": [
          "50 000 habitants",
          "100 000 habitants",
          "400 000 habitants",
          "1 000 000 d'habitants"
        ],
        "correct": 2,
        "explication": "Avec 400 000 habitants au XIe siècle, Constantinople est la plus grande ville d'Europe."
      },
      {
        "question": "Sur la mosaïque de Ravenne, quel élément au-dessus de la tête de Justinien montre la protection divine ?",
        "options": [
          "Une couronne dorée",
          "Une auréole",
          "Un casque militaire",
          "Une mitre d'évêque"
        ],
        "correct": 1,
        "explication": "L'auréole derrière la tête de Justinien montre qu'il est le représentant de Dieu sur Terre et bénéficie de sa protection."
      },
      {
        "question": "Que signifie le mot grec « Basileus » ?",
        "options": [
          "Empereur suprême",
          "Roi",
          "Général",
          "Saint"
        ],
        "correct": 1,
        "explication": "« Basileus » est le mot grec qui signifie « Roi », titre porté par l'empereur byzantin."
      },
      {
        "question": "Par qui le Basileus byzantin est-il sacré lors de son couronnement ?",
        "options": [
          "Par le Pape de Rome",
          "Par le Patriarche de Constantinople",
          "Par les comtes",
          "Par l'armée"
        ],
        "correct": 1,
        "explication": "L'empereur byzantin est sacré à Constantinople par le Patriarche, le chef de l'Église orthodoxe."
      },
      {
        "question": "Quel nom porte le célèbre recueil de lois anciennes romaines compilé sous Justinien ?",
        "options": [
          "Les Capitulaires",
          "Le Code Justinien",
          "La Mosaïque des Lois",
          "Le Traité de Rome"
        ],
        "correct": 1,
        "explication": "Le Code Justinien rassemble et réorganise les anciennes lois romaines et autorise leur traduction en grec."
      },
      {
        "question": "Qui sont les « missi dominici » sous Charlemagne ?",
        "options": [
          "Des soldats de garde",
          "Des envoyés de l'empereur chargés de surveiller les comtes",
          "Des prêtres de village",
          "Des marchands"
        ],
        "correct": 1,
        "explication": "Les missi dominici (« envoyés du maître ») circulent dans l'empire par deux pour contrôler la gestion des comtes."
      },
      {
        "question": "Quel rôle majeur l'impératrice Théodora a-t-elle joué en 532 aux côtés de Justinien ?",
        "options": [
          "Elle a traduit la Bible",
          "Elle l'a aidé à écraser la révolte Nika",
          "Elle a construit le palais d'Aix",
          "Elle est partie en croisade"
        ],
        "correct": 1,
        "explication": "L'impératrice Théodora a conseillé Justinien et l'a convaincu de rester à Constantinople pour écraser la révolte Nika en 532."
      },
      {
        "question": "Qui est le chef suprême de l'Église catholique en Occident ?",
        "options": [
          "Le Patriarche de Constantinople",
          "Le Pape à Rome",
          "L'empereur byzantin",
          "Le roi de France"
        ],
        "correct": 1,
        "explication": "L'Église catholique a pour chef spirituel le Pape, qui siège à Rome."
      },
      {
        "question": "Dans quelle Église les prêtres ont-ils le droit de porter la barbe et de se marier ?",
        "options": [
          "L'Église catholique",
          "L'Église orthodoxe",
          "Dans les deux Églises",
          "Dans aucune"
        ],
        "correct": 1,
        "explication": "Dans l'Église orthodoxe, les prêtres portent la barbe et peuvent se marier, contrairement au clergé catholique (célibataire et imberbe)."
      },
      {
        "question": "Quels missionnaires célèbres ont évangélisé les peuples Slaves (Russes, Bulgares, Serbes) ?",
        "options": [
          "Cyrille et Méthode",
          "Pierre et Paul",
          "Martin et Patrick",
          "Augustin et Jérôme"
        ],
        "correct": 0,
        "explication": "Les moines Cyrille et Méthode ont évangélisé les Slaves et ont créé l'alphabet cyrillique pour traduire les textes religieux."
      },
      {
        "question": "Comment appelle-t-on la séparation officielle entre Église catholique et orthodoxe en 1054 ?",
        "options": [
          "La Réforme",
          "Le Schisme",
          "Le Traité de Verdun",
          "L'Excommunication"
        ],
        "correct": 1,
        "explication": "En 1054, les désaccords religieux entraînent le Schisme, la séparation définitive entre Église catholique (Occident) et orthodoxe (Orient)."
      }
    ]
  },
  {
    "id": "zootopia",
    "emoji": "🦊",
    "matiere": "Anglais",
    "titre": "Zootopia : les quartiers",
    "description": "Vocabulaire anglais des quartiers de Zootopie. Les réponses s'écrivent au clavier.",
    "questions": [
      {
        "question": "Le quartier du désert, chaud et sec ?",
        "reponses": [
          "sahara square"
        ]
      },
      {
        "question": "Le quartier glacé et enneigé ?",
        "reponses": [
          "tundratown"
        ]
      },
      {
        "question": "Le centre-ville animé avec les gratte-ciels ?",
        "reponses": [
          "downtown"
        ]
      },
      {
        "question": "La forêt tropicale très humide ?",
        "reponses": [
          "rainforest district"
        ]
      },
      {
        "question": "Comment dit-on « des gratte-ciels » ?",
        "reponses": [
          "skyscrapers",
          "skyscraper"
        ]
      },
      {
        "question": "Comment dit-on « des dunes de sable » ?",
        "reponses": [
          "sand dunes",
          "sand dune"
        ]
      },
      {
        "question": "Comment dit-on « une cascade » ?",
        "reponses": [
          "waterfall"
        ]
      },
      {
        "question": "L'accentuation : quelle est LA syllabe accentuée dans GIRAFFE ? (Tape juste la syllabe)",
        "reponses": [
          "raffe"
        ]
      },
      {
        "question": "L'accentuation : quelle est LA syllabe accentuée dans ELEPHANT ? (Tape juste la syllabe)",
        "reponses": [
          "el"
        ]
      },
      {
        "question": "Traduis : « humide »",
        "reponses": [
          "humid",
          "wet"
        ]
      }
    ]
  }
];
