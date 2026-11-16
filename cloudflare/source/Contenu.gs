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
  },
  {
    "id": "musique-carnaval",
    "emoji": "🎼",
    "matiere": "Musique",
    "titre": "Musique descriptive : Le Carnaval des animaux (5ᵉ)",
    "description": "40 questions : Le Carnaval des animaux, Camille Saint-Saëns, les 4 paramètres du son, les nuances et l'analyse de 6 extraits.",
    "lien": {
      "texte": "Écouter les extraits sonores (Padlet / Digipad)",
      "url": "https://digipad.app/p/1852174/2ea2dfaf331198",
      "icone": "🎧"
    },
    "questions": [
      {
        "question": "Quelle est la définition exacte de la musique descriptive ?",
        "options": [
          "Une musique sans instruments accompagnant un texte poétique.",
          "Genre musical dans lequel le compositeur imite des éléments non musicaux à l'aide d'un orchestre symphonique.",
          "Une musique jouée uniquement au piano pour illustrer un film muet."
        ],
        "correct": 1
      },
      {
        "question": "Le Carnaval des animaux est qualifié par le compositeur de « ______ zoologique ».",
        "reponses": [
          "fantaisie",
          "grande fantaisie"
        ]
      },
      {
        "question": "En quelle année Le Carnaval des animaux a-t-il été composé ?",
        "options": [
          "1786",
          "1886",
          "1921"
        ],
        "correct": 1
      },
      {
        "question": "À quelle période du siècle cette œuvre appartient-elle ?",
        "options": [
          "Début du 19ᵉ siècle",
          "Milieu du 19ᵉ siècle",
          "Fin du 19ᵉ siècle"
        ],
        "correct": 2
      },
      {
        "question": "Pour quelle occasion festive cette œuvre a-t-elle été composée à l'origine ? Concert de ______.",
        "reponses": [
          "mardi gras"
        ]
      },
      {
        "question": "Quel était le but principal du compositeur en écrivant cette œuvre ?",
        "options": [
          "Faire pleurer",
          "Faire rire",
          "Composer une hymne religieuse"
        ],
        "correct": 1
      },
      {
        "question": "Pourquoi Saint-Saëns a-t-il interdit l'exécution publique du Carnaval des animaux de son vivant ?",
        "options": [
          "Il la trouvait trop difficile à jouer pour les orchestres.",
          "Il craignait pour sa réputation de membre de l'Académie des beaux-arts.",
          "Le ministre de la Culture l'avait censurée."
        ],
        "correct": 1
      },
      {
        "question": "Quelle est la seule pièce du Carnaval des animaux qui n'a pas été censurée par Saint-Saëns de son vivant ? Le ______.",
        "reponses": [
          "cygne",
          "le cygne"
        ]
      },
      {
        "question": "Combien de tableaux (petites pièces musicales) comporte au total Le Carnaval des animaux ?",
        "options": [
          "6 tableaux",
          "10 tableaux",
          "14 tableaux"
        ],
        "correct": 2
      },
      {
        "question": "À quelle autre œuvre musicale célèbre (composée par Prokofiev) Le Carnaval des animaux est-il comparé pour sa grande popularité ? ______ et le loup.",
        "reponses": [
          "pierre"
        ]
      },
      {
        "question": "Dans quelle ville Camille Saint-Saëns est-il né en 1835 ?",
        "reponses": [
          "paris"
        ]
      },
      {
        "question": "Où et de quelle maladie est mort Camille Saint-Saëns en 1921 ?",
        "champs": [
          {
            "label": "Mort à",
            "reponses": [
              "alger"
            ]
          },
          {
            "label": "d'une",
            "reponses": [
              "pneumonie",
              "une pneumonie"
            ]
          }
        ]
      },
      {
        "question": "Quels sont les trois métiers / rôles musicaux qu'exerçait Camille Saint-Saëns ?",
        "options": [
          "Pianiste, organiste et compositeur",
          "Violoncelliste, chef d'orchestre et chanteur",
          "Flûtiste, violoniste et éditeur"
        ],
        "correct": 0
      },
      {
        "question": "À quelle époque musicale Camille Saint-Saëns appartient-il ?",
        "options": [
          "Époque baroque",
          "Époque classique",
          "Époque post-romantique"
        ],
        "correct": 2
      },
      {
        "question": "Combien d'opéras Camille Saint-Saëns a-t-il écrits au total ? ______ opéras.",
        "reponses": [
          "12",
          "douze"
        ]
      },
      {
        "question": "Quel est le titre de l'opéra le plus connu composé par Camille Saint-Saëns ?",
        "options": [
          "Carmen",
          "Samson et Dalila",
          "La Flûte enchantée"
        ],
        "correct": 1
      },
      {
        "question": "En 1908, quelle place particulière occupe Saint-Saëns dans l'histoire du cinéma (7ᵉ art) ?",
        "options": [
          "Il est le premier à avoir réalisé un film muet.",
          "Il est le tout premier compositeur de renom à composer une musique spécialement pour un film.",
          "Il a inventé l'enregistrement du son sur bobine."
        ],
        "correct": 1
      },
      {
        "question": "Quel est le titre du film de 1908 dont Saint-Saëns a composé la musique ? L'______ du duc de Guise.",
        "reponses": [
          "assassinat",
          "l'assassinat"
        ]
      },
      {
        "question": "Comment appelle-t-on l'ensemble des 4 paramètres du son ?",
        "options": [
          "La carte d'identité du son",
          "La vitesse de la musique",
          "Le solfège rythmique"
        ],
        "correct": 0
      },
      {
        "question": "Le timbre se définit comme la sonorité spécifique de chaque ______ ou ______.",
        "libre": true,
        "champs": [
          {
            "label": "Réponse 1",
            "reponses": [
              "voix"
            ]
          },
          {
            "label": "Réponse 2",
            "reponses": [
              "instrument"
            ]
          }
        ]
      },
      {
        "question": "De quoi dépend la hauteur d'une note dans l'échelle musicale ?",
        "options": [
          "Du volume des enceintes",
          "Du nombre de vibrations",
          "De la durée de la note"
        ],
        "correct": 1
      },
      {
        "question": "Quelles sont les trois catégories de hauteur d'un son ?",
        "libre": true,
        "champs": [
          {
            "label": "Catégorie 1",
            "reponses": [
              "aigu",
              "aiguë"
            ]
          },
          {
            "label": "Catégorie 2",
            "reponses": [
              "médium"
            ]
          },
          {
            "label": "Catégorie 3",
            "reponses": [
              "grave"
            ]
          }
        ]
      },
      {
        "question": "Quelle est la définition exacte de la nuance en musique ?",
        "options": [
          "La durée pendant laquelle on entend un son.",
          "Le volume sonore de la musique.",
          "La couleur de l'instrument joué."
        ],
        "correct": 1
      },
      {
        "question": "La durée est le laps de temps pendant lequel on entend un son. Donne les trois exemples de durée du cours.",
        "libre": true,
        "champs": [
          {
            "label": "Durée 1",
            "reponses": [
              "lent"
            ]
          },
          {
            "label": "Durée 2",
            "reponses": [
              "modéré"
            ]
          },
          {
            "label": "Durée 3",
            "reponses": [
              "rapide"
            ]
          }
        ]
      },
      {
        "question": "Nuances en italien : donne le terme en italien et la traduction en français de pp, p et mp.",
        "champs": [
          {
            "label": "pp : terme italien",
            "reponses": [
              "pianissimo"
            ]
          },
          {
            "label": "pp : traduction",
            "reponses": [
              "très doucement",
              "très doux"
            ]
          },
          {
            "label": "p : terme italien",
            "reponses": [
              "piano"
            ]
          },
          {
            "label": "p : traduction",
            "reponses": [
              "doucement",
              "doux"
            ]
          },
          {
            "label": "mp : terme italien",
            "reponses": [
              "mezzo piano"
            ]
          },
          {
            "label": "mp : traduction",
            "reponses": [
              "assez doux",
              "assez doucement"
            ]
          }
        ]
      },
      {
        "question": "Nuances en italien (suite) : complète pour mf, f et ff.",
        "champs": [
          {
            "label": "mf : terme italien",
            "reponses": [
              "mezzo forte"
            ]
          },
          {
            "label": "mf : traduction",
            "reponses": [
              "assez fort",
              "assez fortement"
            ]
          },
          {
            "label": "f : terme italien",
            "reponses": [
              "forte"
            ]
          },
          {
            "label": "f : traduction",
            "reponses": [
              "fort",
              "fortement"
            ]
          },
          {
            "label": "ff : terme italien",
            "reponses": [
              "fortissimo"
            ]
          },
          {
            "label": "ff : traduction",
            "reponses": [
              "très fort",
              "très fortement"
            ]
          }
        ]
      },
      {
        "question": "Que signifient les variations de nuance indiquées par les symboles < (crescendo) et > (decrescendo) ?",
        "options": [
          "Crescendo = devenir de plus en plus fort ; Decrescendo = devenir de plus en plus doux.",
          "Crescendo = jouer de plus en plus vite ; Decrescendo = jouer de plus en plus lent.",
          "Crescendo = aller vers l'aigu ; Decrescendo = aller vers le grave."
        ],
        "correct": 0
      },
      {
        "question": "Ordonne ces 6 nuances de la plus douce (volume le plus bas) à la plus forte (volume le plus haut) : f, pp, mf, p, ff, mp.",
        "reponses": [
          "pp < p < mp < mf < f < ff",
          "pp p mp mf f ff"
        ]
      },
      {
        "question": "🎧 Le Lion : quel instrument (timbre) est utilisé par Saint-Saëns pour imiter le rugissement du Lion ?",
        "options": [
          "La contrebasse",
          "Le piano",
          "La flûte traversière"
        ],
        "correct": 1
      },
      {
        "question": "🎧 Le Lion : complète les paramètres musicaux de la pièce.",
        "champs": [
          {
            "label": "Hauteur",
            "reponses": [
              "très grave"
            ]
          },
          {
            "label": "Nuance",
            "reponses": [
              "mp < f > mp"
            ]
          },
          {
            "label": "Durée",
            "reponses": [
              "très rapide"
            ]
          },
          {
            "label": "Mode de jeu",
            "reponses": [
              "legato"
            ]
          }
        ]
      },
      {
        "question": "🎧 Les Tortues : quelle est la particularité animale mise en musique dans la pièce des Tortues ?",
        "options": [
          "Le galop rapide",
          "La nage lente",
          "Le rugissement"
        ],
        "correct": 1
      },
      {
        "question": "🎧 Les Tortues : complète les paramètres musicaux.",
        "champs": [
          {
            "label": "Timbre",
            "reponses": [
              "orchestre de cordes",
              "orchestre à cordes",
              "cordes",
              "les cordes"
            ]
          },
          {
            "label": "Hauteur",
            "reponses": [
              "médium/grave",
              "médium et grave",
              "grave/médium"
            ]
          },
          {
            "label": "Nuance",
            "reponses": [
              "mezzo piano",
              "mp"
            ]
          },
          {
            "label": "Durée",
            "reponses": [
              "lent"
            ]
          },
          {
            "label": "Mode de jeu",
            "reponses": [
              "legato"
            ]
          }
        ]
      },
      {
        "question": "🎧 L'Éléphant : quel instrument à cordes (timbre) est choisi pour représenter les pas lourds de l'Éléphant ?",
        "options": [
          "Le violoncelle",
          "La contrebasse",
          "Le violon"
        ],
        "correct": 1
      },
      {
        "question": "🎧 L'Éléphant : complète les paramètres musicaux.",
        "champs": [
          {
            "label": "Hauteur",
            "reponses": [
              "grave"
            ]
          },
          {
            "label": "Nuance",
            "reponses": [
              "mezzo forte",
              "mf"
            ]
          },
          {
            "label": "Durée",
            "reponses": [
              "modéré"
            ]
          },
          {
            "label": "Mode de jeu",
            "reponses": [
              "staccato"
            ]
          }
        ]
      },
      {
        "question": "🎧 Personnages à longues oreilles (les ânes) : quels instruments et quel mode de jeu imitent le braiement de l'âne ?",
        "options": [
          "Deux violons jouant en glissando et legato",
          "Une contrebasse jouant staccato",
          "Une flûte traversière et un piano"
        ],
        "correct": 0
      },
      {
        "question": "🎧 Personnages à longues oreilles (les ânes) : complète l'analyse.",
        "champs": [
          {
            "label": "Particularité : le …",
            "reponses": [
              "braiement",
              "cri"
            ]
          },
          {
            "label": "Hauteur de « Hi »",
            "reponses": [
              "aigu",
              "aiguë"
            ]
          },
          {
            "label": "Hauteur de « Han »",
            "reponses": [
              "grave"
            ]
          },
          {
            "label": "Nuance",
            "reponses": [
              "forte",
              "f"
            ]
          },
          {
            "label": "Durée de « hin »",
            "reponses": [
              "rapide"
            ]
          },
          {
            "label": "Durée de « han »",
            "reponses": [
              "lent"
            ]
          }
        ]
      },
      {
        "question": "🎧 La Volière (les oiseaux) : quels sont les timbres (instruments) employés dans La Volière ?",
        "options": [
          "La flûte traversière et les cordes",
          "Le piano et le violoncelle",
          "La contrebasse seule"
        ],
        "correct": 0
      },
      {
        "question": "🎧 La Volière (les oiseaux) : complète l'analyse.",
        "champs": [
          {
            "label": "Particularité 1 : le …",
            "reponses": [
              "chant"
            ]
          },
          {
            "label": "Particularité 2 : le … des ailes",
            "reponses": [
              "battement"
            ]
          },
          {
            "label": "Hauteur 1",
            "reponses": [
              "aigu",
              "aiguë"
            ]
          },
          {
            "label": "Hauteur 2",
            "reponses": [
              "médium/grave",
              "médium et grave",
              "grave/médium"
            ]
          },
          {
            "label": "Nuance 1",
            "reponses": [
              "mezzo forte",
              "mf"
            ]
          },
          {
            "label": "Nuance 2",
            "reponses": [
              "pianissimo",
              "pp"
            ]
          },
          {
            "label": "Mode de jeu 1",
            "reponses": [
              "legato"
            ]
          },
          {
            "label": "Mode de jeu 2",
            "reponses": [
              "staccato"
            ]
          }
        ]
      },
      {
        "question": "🎧 Le Cygne : quel instrument soliste incarne la grâce du Cygne ?",
        "options": [
          "Le violoncelle",
          "La contrebasse",
          "La flûte traversière"
        ],
        "correct": 0
      },
      {
        "question": "🎧 Le Cygne : complète l'analyse.",
        "champs": [
          {
            "label": "Particularité : la …",
            "reponses": [
              "grâce"
            ]
          },
          {
            "label": "Hauteur",
            "reponses": [
              "médium"
            ]
          },
          {
            "label": "Nuance",
            "reponses": [
              "mezzo forte",
              "mf"
            ]
          },
          {
            "label": "Durée",
            "reponses": [
              "modéré"
            ]
          },
          {
            "label": "Mode de jeu 1",
            "reponses": [
              "legato"
            ],
            "groupe": "modes"
          },
          {
            "label": "Mode de jeu 2",
            "reponses": [
              "vibrato"
            ],
            "groupe": "modes"
          }
        ]
      }
    ]
  },
  {
    "id": "anglais-animaux",
    "emoji": "🐾",
    "matiere": "Anglais",
    "titre": "Anglais : les animaux (vocabulaire)",
    "description": "Traduction français → anglais, pluriels et devinettes « Qui suis-je ? ». Les réponses s'écrivent au clavier.",
    "questions": [
      {
        "question": "Traduis en anglais : un porc-épic",
        "reponses": [
          "a porcupine",
          "porcupine"
        ]
      },
      {
        "question": "Traduis en anglais : un paresseux",
        "reponses": [
          "a sloth",
          "sloth"
        ]
      },
      {
        "question": "Traduis en anglais : un furet",
        "reponses": [
          "a ferret",
          "ferret"
        ]
      },
      {
        "question": "Traduis en anglais : un renne",
        "reponses": [
          "a reindeer",
          "reindeer"
        ]
      },
      {
        "question": "Traduis en anglais : un raton laveur",
        "reponses": [
          "a racoon",
          "racoon",
          "a raccoon",
          "raccoon"
        ]
      },
      {
        "question": "Traduis en anglais : un guépard",
        "reponses": [
          "a cheetah",
          "cheetah"
        ]
      },
      {
        "question": "Traduis en anglais : un chameau",
        "reponses": [
          "a camel",
          "camel"
        ]
      },
      {
        "question": "Traduis en anglais : un ours polaire",
        "reponses": [
          "a polar bear",
          "polar bear"
        ]
      },
      {
        "question": "Traduis en anglais : un yack",
        "reponses": [
          "a yak",
          "yak"
        ]
      },
      {
        "question": "Traduis en anglais : une antilope",
        "reponses": [
          "an antelope",
          "antelope"
        ]
      },
      {
        "question": "Quel est le pluriel du mot « a wolf » ?",
        "reponses": [
          "wolves"
        ]
      },
      {
        "question": "Quel est le pluriel du mot « a fox » ?",
        "reponses": [
          "foxes"
        ]
      },
      {
        "question": "Quel est le pluriel du mot « a sheep » ?",
        "reponses": [
          "sheep"
        ]
      },
      {
        "question": "Comment est écrit le mot « écureuils » sur la liste ?",
        "reponses": [
          "squirrels"
        ]
      },
      {
        "question": "Quel est le pluriel indiqué pour « a buffalo » ?",
        "reponses": [
          "buffalo",
          "buffaloes"
        ]
      },
      {
        "question": "Qui suis-je ? « I am very slow and I live in trees. »",
        "reponses": [
          "a sloth",
          "sloth"
        ]
      },
      {
        "question": "Qui suis-je ? « I have a very long neck and live in the savanna. »",
        "reponses": [
          "a giraffe",
          "giraffe"
        ]
      },
      {
        "question": "Qui suis-je ? « I am the fastest land animal on Earth. »",
        "reponses": [
          "a cheetah",
          "cheetah"
        ]
      },
      {
        "question": "Qui suis-je ? « I live in dry areas and have humps. »",
        "reponses": [
          "a camel",
          "camel"
        ]
      },
      {
        "question": "Qui suis-je ? « I am a pink farm animal. »",
        "reponses": [
          "a pig",
          "pig"
        ]
      }
    ]
  },
  {
    "id": "histoire-revolution",
    "emoji": "👑",
    "matiere": "Histoire",
    "titre": "De 1789 à l'exécution du Roi",
    "description": "La société d'Ancien Régime, les Lumières, 1789 et la fin de la monarchie. 30 questions.",
    "questions": [
      {
        "question": "En combien d'ordres la population était-elle divisée sous l'Ancien Régime ?",
        "options": [
          "2 ordres",
          "3 ordres",
          "4 ordres"
        ],
        "correct": 1
      },
      {
        "question": "Quels sont les noms des trois ordres de la société ?",
        "champs": [
          {
            "label": "Ordre",
            "reponses": [
              "tiers-état",
              "tiers état",
              "le tiers-état",
              "le tiers état"
            ]
          },
          {
            "label": "Ordre",
            "reponses": [
              "noblesse",
              "la noblesse"
            ]
          },
          {
            "label": "Ordre",
            "reponses": [
              "clergé",
              "le clergé",
              "clerge"
            ]
          }
        ],
        "libre": true
      },
      {
        "question": "Quel pourcentage de la population française représentait le Tiers-État ?",
        "options": [
          "50 %",
          "75 %",
          "97 %"
        ],
        "correct": 2
      },
      {
        "question": "Qui faisait partie du Tiers-État ?",
        "champs": [
          {
            "label": "Qui",
            "reponses": [
              "paysans",
              "les paysans",
              "paysan"
            ]
          },
          {
            "label": "Qui",
            "reponses": [
              "artisans",
              "les artisans",
              "artisan"
            ]
          },
          {
            "label": "Qui",
            "reponses": [
              "commerçants",
              "les commerçants",
              "commerçant"
            ]
          }
        ],
        "libre": true
      },
      {
        "question": "Vrai ou Faux : La Noblesse et le Clergé travaillaient dur et payaient tous les impôts.",
        "options": [
          "Vrai",
          "Faux"
        ],
        "correct": 1,
        "explication": "Faux. Ils avaient des privilèges, ne travaillaient pas et ne payaient pas d'impôts."
      },
      {
        "question": "De quoi vivaient la Noblesse et le Clergé ?",
        "options": [
          "Des impôts perçus sur la population",
          "De leur travail dans les champs",
          "Du commerce avec l'étranger"
        ],
        "correct": 0
      },
      {
        "question": "Quel ordre regroupait les prêtres ?",
        "reponses": [
          "le clergé",
          "clergé",
          "clerge"
        ],
        "explication": "Le Clergé représentait 1 % de la population."
      },
      {
        "question": "Qui appelait-on « les Lumières » ?",
        "options": [
          "Les soldats du roi",
          "Des philosophes et des scientifiques",
          "Les paysans du Tiers-État"
        ],
        "correct": 1
      },
      {
        "question": "Que remettaient en cause les Lumières ?",
        "options": [
          "La toute-puissance du roi et les privilèges",
          "La culture du blé",
          "L'armée française"
        ],
        "correct": 0
      },
      {
        "question": "Quels manques dans la société les Lumières dénonçaient-ils ?",
        "champs": [
          {
            "label": "Manque 1",
            "reponses": [
              "d'instruction",
              "instruction",
              "le manque d'instruction",
              "manque d'instruction"
            ],
            "groupe": "m"
          },
          {
            "label": "Manque 2",
            "reponses": [
              "de liberté",
              "liberté",
              "le manque de liberté",
              "manque de liberté"
            ],
            "groupe": "m"
          }
        ],
        "libre": true
      },
      {
        "question": "Pour quelles raisons le royaume de France était-il gravement endetté avant 1789 ?",
        "options": [
          "À cause des guerres et des dépenses excessives de la cour",
          "À cause de mauvaises récoltes et de la famine",
          "À cause de la construction de nouvelles cathédrales"
        ],
        "correct": 0
      },
      {
        "question": "Pourquoi Louis XVI n'a-t-il pas réussi à réformer les impôts ?",
        "options": [
          "Car la noblesse et le clergé ont refusé de perdre leurs privilèges",
          "Car le Tiers-État refusait de payer plus",
          "Car le roi ne voulait pas changer les impôts"
        ],
        "correct": 0
      },
      {
        "question": "Que s'est-il passé en 1788 qui a fait monter le prix du pain ?",
        "options": [
          "De très mauvaises récoltes",
          "Une grande guerre contre l'Angleterre",
          "La construction du château de Versailles"
        ],
        "correct": 0
      },
      {
        "question": "Quelle a été la conséquence de la famine sur le Tiers-État ?",
        "options": [
          "Il souffrait de la faim, ce qui a provoqué des révoltes",
          "Il est parti vivre à l'étranger",
          "Il a obtenu plus de privilèges"
        ],
        "correct": 0
      },
      {
        "question": "Cite trois grandes idées défendues par les Lumières.",
        "champs": [
          {
            "label": "Idée",
            "reponses": [
              "liberté",
              "la liberté"
            ]
          },
          {
            "label": "Idée",
            "reponses": [
              "égalité",
              "l'égalité",
              "egalite"
            ]
          },
          {
            "label": "Idée",
            "reponses": [
              "souveraineté du peuple",
              "la souveraineté du peuple",
              "souveraineté"
            ]
          }
        ],
        "libre": true
      },
      {
        "question": "À quelle date et dans quelle ville Louis XVI réunit-il les États Généraux ?",
        "champs": [
          {
            "label": "Date",
            "reponses": [
              "5 mai 1789",
              "le 5 mai 1789"
            ]
          },
          {
            "label": "Ville",
            "reponses": [
              "versailles",
              "à versailles"
            ]
          }
        ]
      },
      {
        "question": "Que sont les « États Généraux » ?",
        "options": [
          "La réunion des représentants des 3 ordres de la société",
          "Le nom de l'armée du roi",
          "Une grande fête organisée à Versailles"
        ],
        "correct": 0
      },
      {
        "question": "Pourquoi la réunion des États Généraux a-t-elle été un échec ?",
        "options": [
          "Parce que les 3 ordres ne se sont pas entendus sur la façon de réduire la dette",
          "Parce que le roi n'est pas venu",
          "Parce que le Tiers-État n'avait pas été invité"
        ],
        "correct": 0
      },
      {
        "question": "Que s'est-il passé de très important le 14 juillet 1789 ?",
        "options": [
          "La prise de la Bastille par la foule",
          "L'exécution du roi",
          "La fuite du roi à Varennes"
        ],
        "correct": 0
      },
      {
        "question": "Que symbolisait la prison de la Bastille aux yeux du peuple ?",
        "options": [
          "L'autorité royale injuste",
          "La richesse de la noblesse",
          "La puissance de l'armée"
        ],
        "correct": 0
      },
      {
        "question": "Dans la nouvelle organisation du pouvoir, qui élit les électeurs ?",
        "reponses": [
          "les citoyens",
          "citoyens",
          "des citoyens"
        ]
      },
      {
        "question": "Qui l'Assemblée Législative représente-t-elle et quels sont ses deux rôles principaux ?",
        "champs": [
          {
            "label": "Elle est élue par",
            "reponses": [
              "les électeurs",
              "électeurs",
              "des électeurs"
            ]
          },
          {
            "label": "Rôle 1",
            "reponses": [
              "voter les lois",
              "voter des lois",
              "voter la loi"
            ],
            "groupe": "r"
          },
          {
            "label": "Rôle 2",
            "reponses": [
              "décider de la guerre",
              "déclarer la guerre",
              "décider la guerre"
            ],
            "groupe": "r"
          }
        ]
      },
      {
        "question": "Dans ce nouveau système, le pouvoir du Roi est-il absolu ou limité ?",
        "options": [
          "Absolu",
          "Limité"
        ],
        "correct": 1
      },
      {
        "question": "Qui est chargé de rendre la justice dans cette nouvelle organisation politique ?",
        "reponses": [
          "les tribunaux",
          "tribunaux",
          "les tribunals",
          "un tribunal",
          "des tribunaux"
        ]
      },
      {
        "question": "Vrai ou Faux : Le roi Louis XVI était très heureux de partager son pouvoir avec le peuple.",
        "options": [
          "Vrai",
          "Faux"
        ],
        "correct": 1,
        "explication": "Faux. Louis XVI ne supportait pas de perdre son pouvoir."
      },
      {
        "question": "Que tente de faire le roi Louis XVI en juin 1791 ?",
        "options": [
          "Fuir le pays",
          "Déclarer la guerre à l'Angleterre",
          "Réunir de nouveau les États Généraux"
        ],
        "correct": 0
      },
      {
        "question": "Dans quelle ville le roi Louis XVI est-il arrêté lors de sa fuite en juin 1791 ?",
        "reponses": [
          "varennes",
          "à varennes"
        ]
      },
      {
        "question": "Que se passe-t-il pour le roi après son arrestation à Varennes ?",
        "options": [
          "Il se fait emprisonner",
          "Il est libéré aussitôt",
          "Il quitte la France"
        ],
        "correct": 0
      },
      {
        "question": "En quelle année le roi Louis XVI a-t-il été guillotiné ?",
        "reponses": [
          "1793"
        ]
      },
      {
        "question": "Quel grand changement politique l'exécution du roi marque-t-elle en France ?",
        "options": [
          "La fin de la monarchie",
          "Le retour des privilèges",
          "La réunion des États Généraux"
        ],
        "correct": 0
      }
    ]
  },
  {
    "id": "techno-5e-numerique",
    "emoji": "💻",
    "matiere": "Technologie",
    "titre": "Technologie 5ᵉ : sécurité numérique et réseau",
    "description": "Données personnelles et protection, cyberharcèlement, réseau informatique du collège. 40 questions.",
    "questions": [
      {
        "question": "Quelle est la définition d'une donnée personnelle ?",
        "options": [
          "Toute information permettant d'identifier directement ou indirectement une personne physique (nom, photo, adresse, numéro d'élève…)",
          "Uniquement le nom et le prénom d'une personne",
          "Toute information que l'on trouve sur Internet"
        ],
        "correct": 0
      },
      {
        "question": "Parmi les éléments suivants, lesquels sont des données personnelles ? (Nom, adresse IP, couleur préférée, numéro de téléphone, photo de visage)",
        "champs": [
          {
            "label": "Donnée personnelle",
            "reponses": [
              "nom",
              "le nom"
            ]
          },
          {
            "label": "Donnée personnelle",
            "reponses": [
              "adresse ip",
              "l'adresse ip",
              "ip"
            ]
          },
          {
            "label": "Donnée personnelle",
            "reponses": [
              "numéro de téléphone",
              "le numéro de téléphone",
              "téléphone",
              "numéro de telephone"
            ]
          },
          {
            "label": "Donnée personnelle",
            "reponses": [
              "photo de visage",
              "la photo de visage",
              "photo",
              "photo du visage"
            ]
          }
        ],
        "libre": true,
        "explication": "La couleur préférée n'est pas une donnée personnelle."
      },
      {
        "question": "Pourquoi faut-il éviter de publier sa date de naissance complète ou son adresse sur les réseaux sociaux ?",
        "options": [
          "Ces données peuvent être utilisées par des personnes malveillantes pour deviner des mots de passe, usurper une identité ou localiser la personne",
          "Parce que les réseaux sociaux refusent ces informations",
          "Parce que cela fait ralentir l'ordinateur"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce que le phishing (ou hameçonnage) ?",
        "options": [
          "Une technique de fraude qui trompe l'utilisateur avec un faux message (e-mail, SMS) pour lui voler des informations confidentielles",
          "Un logiciel qui protège l'ordinateur contre les virus",
          "Une méthode pour télécharger des fichiers plus vite"
        ],
        "correct": 0
      },
      {
        "question": "Quel est l'objectif principal d'un pirate informatique qui envoie un e-mail de phishing ?",
        "options": [
          "Récupérer des identifiants secrets, voler des données personnelles ou installer un programme malveillant",
          "Faire gagner un cadeau au destinataire",
          "Réparer l'ordinateur du destinataire"
        ],
        "correct": 0
      },
      {
        "question": "Citez deux indices qui permettent de repérer un e-mail de phishing.",
        "options": [
          "Adresse de l'expéditeur bizarre ou non officielle, fautes d'orthographe, sentiment d'urgence ou demande d'informations confidentielles",
          "Un message très court, écrit en majuscules et envoyé le matin",
          "Un message qui contient une pièce jointe de petite taille"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce qu'un mot de passe robuste ou sécurisé ?",
        "options": [
          "Un mot de passe long, difficile à deviner, combinant différents types de caractères et unique à chaque compte",
          "Un mot de passe court et facile à retenir, comme une date de naissance",
          "Un mot de passe identique pour tous ses comptes"
        ],
        "correct": 0
      },
      {
        "question": "Vrai ou Faux : Un bon mot de passe doit contenir au moins 12 caractères avec des majuscules, minuscules, chiffres et caractères spéciaux.",
        "options": [
          "Vrai",
          "Faux"
        ],
        "correct": 0,
        "explication": "Vrai : plus le mot de passe est long et complexe, plus il est difficile à pirater."
      },
      {
        "question": "Pourquoi ne faut-il jamais utiliser le même mot de passe pour tous ses comptes ?",
        "options": [
          "Si un pirate découvre ce mot de passe, il a accès à l'ensemble des comptes de la personne",
          "Parce qu'un site n'accepte jamais deux fois le même mot de passe",
          "Parce qu'on l'oublie plus facilement"
        ],
        "correct": 0
      },
      {
        "question": "Est-il recommandé de partager son mot de passe avec son meilleur ami ? Pourquoi ?",
        "options": [
          "Non : un mot de passe est strictement personnel, même avec un ami une dispute ou une fuite involontaire peut compromettre le compte",
          "Oui : entre amis, il n'y a aucun risque",
          "Oui : cela permet de se souvenir plus facilement du mot de passe"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce qu'un logiciel malveillant (ou malware) ?",
        "options": [
          "Un programme conçu pour perturber, endommager ou infiltrer un système informatique à l'insu de l'utilisateur",
          "Un logiciel de traitement de texte très ancien",
          "Un programme qui accélère l'ordinateur"
        ],
        "correct": 0
      },
      {
        "question": "Quel outil ou logiciel permet de protéger un ordinateur contre les virus et attaques ?",
        "reponses": [
          "antivirus",
          "un antivirus",
          "l'antivirus",
          "logiciel antivirus"
        ],
        "explication": "L'antivirus analyse les fichiers et bloque les programmes dangereux avant qu'ils ne nuisent à l'ordinateur."
      },
      {
        "question": "Que signifie la présence d'un cadenas et du protocole https:// au début d'une adresse web ?",
        "options": [
          "La connexion entre le navigateur et le site web est sécurisée et chiffrée",
          "Le site est gratuit",
          "Le site est réservé aux adultes"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce que l'usurpation d'identité en ligne ?",
        "options": [
          "Se faire passer pour une autre personne en ligne (son nom, sa photo ou son compte) afin de nuire ou de tromper",
          "Changer son pseudo sur un jeu en ligne",
          "Créer un mot de passe très compliqué"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce que l'empreinte numérique (ou trace numérique) sur Internet ?",
        "options": [
          "L'ensemble des traces laissées en ligne lors de la navigation (historique, publications, commentaires, j'aime)",
          "La marque laissée par les doigts sur l'écran",
          "Le nombre de fichiers enregistrés sur l'ordinateur"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est la différence entre une dispute ponctuelle et le cyberharcèlement ?",
        "options": [
          "Le cyberharcèlement se caractérise par la répétition d'actes agressifs ou humiliants via des moyens numériques, dans la durée",
          "Il n'y a aucune différence",
          "Le cyberharcèlement est un acte unique commis une seule fois"
        ],
        "correct": 0
      },
      {
        "question": "Citez trois formes différentes que peut prendre le cyberharcèlement.",
        "options": [
          "Envoi d'insultes répétées, diffusion de fausses rumeurs, création d'un faux profil moqueur, exclusion volontaire d'un groupe de discussion",
          "Envoyer un message d'anniversaire, partager un jeu, féliciter un camarade",
          "Poser une question en classe, rendre un devoir, ranger son cartable"
        ],
        "correct": 0
      },
      {
        "question": "Pourquoi le cyberharcèlement peut-il être particulièrement grave comparé au harcèlement classique dans la cour du collège ?",
        "options": [
          "Les contenus se propagent très vite, restent visibles à tout moment (même à la maison) et touchent un très large public",
          "Parce qu'il ne dure jamais longtemps",
          "Parce que personne ne peut le voir"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est la première réaction à avoir si l'on reçoit des messages insultants répétés en ligne ?",
        "options": [
          "Ne pas répliquer, ne pas surenchérir, et en parler immédiatement à un adulte de confiance",
          "Répondre avec des insultes plus fortes",
          "Supprimer son compte sans en parler à personne"
        ],
        "correct": 0
      },
      {
        "question": "Quel réflexe technique indispensable faut-il avoir immédiatement pour prouver des actes de cyberharcèlement ?",
        "options": [
          "Effectuer des captures d'écran des messages, photos ou commentaires pour conserver les preuves",
          "Éteindre l'ordinateur",
          "Supprimer tous les messages reçus"
        ],
        "correct": 0
      },
      {
        "question": "Quel est le numéro national gratuit et anonyme pour signaler le cyberharcèlement et les violences numériques en France ?",
        "reponses": [
          "3018"
        ],
        "explication": "Le 3018 est gratuit et anonyme : il permet de signaler le cyberharcèlement et de faire supprimer des contenus numériques abusifs."
      },
      {
        "question": "Quel est le numéro d'écoute national pour le harcèlement scolaire ?",
        "reponses": [
          "3020"
        ],
        "explication": "Le 3020 est le numéro vert d'écoute et d'assistance pour le harcèlement scolaire."
      },
      {
        "question": "À quelles personnes ressources au sein du collège peut-on s'adresser en cas de cyberharcèlement ?",
        "options": [
          "Le professeur principal, le CPE, l'infirmière scolaire, un assistant d'éducation (AED), la direction",
          "Uniquement le professeur de sport",
          "Aucune : il faut gérer seul"
        ],
        "correct": 0
      },
      {
        "question": "Vrai ou Faux : Publier la photo d'un camarade sans son autorisation sur les réseaux sociaux est autorisé si c'est pour rigoler.",
        "options": [
          "Vrai",
          "Faux"
        ],
        "correct": 1,
        "explication": "Faux : le droit à l'image interdit de publier ou partager la photo d'une personne sans son autorisation explicite."
      },
      {
        "question": "Le cyberharcèlement est-il reconnu comme un délit puni par la loi ?",
        "options": [
          "Oui, c'est un délit puni par le Code pénal français",
          "Non, ce n'est pas puni par la loi",
          "Seulement s'il a lieu en dehors du collège"
        ],
        "correct": 0
      },
      {
        "question": "Quelles sanctions disciplinaires risque un élève auteur de cyberharcèlement au collège ?",
        "options": [
          "Avertissement, blâme, retenue, exclusion temporaire ou définitive (conseil de discipline)",
          "Aucune sanction",
          "Une récompense pour avoir été actif en ligne"
        ],
        "correct": 0
      },
      {
        "question": "Quelles sanctions pénales peuvent s'appliquer à un mineur reconnu coupable de cyberharcèlement grave ?",
        "options": [
          "Amendes, peines de prison ou travaux d'intérêt général adaptés aux mineurs selon la gravité des faits",
          "Aucune : un mineur ne peut jamais être puni",
          "Uniquement un changement de classe"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce qu'un réseau informatique local (LAN) ?",
        "options": [
          "Un ensemble d'équipements (ordinateurs, serveurs, imprimantes) reliés entre eux sur une zone géographique restreinte, comme le collège",
          "Le réseau qui relie tous les pays du monde",
          "Un seul ordinateur connecté à Internet"
        ],
        "correct": 0
      },
      {
        "question": "Quel est le rôle principal d'un serveur dans le réseau du collège ?",
        "options": [
          "C'est la machine centrale qui stocke les données, gère les accès des utilisateurs et distribue les ressources aux ordinateurs clients",
          "Il imprime les documents",
          "Il sert uniquement d'écran"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce qu'un commutateur (ou switch) et quelle est sa fonction dans une salle de technologie ?",
        "options": [
          "Un équipement qui relie plusieurs appareils en câble réseau et dirige les informations uniquement vers le destinataire concerné",
          "Un interrupteur qui allume les ordinateurs",
          "Un logiciel qui protège contre les virus"
        ],
        "correct": 0
      },
      {
        "question": "Quel équipement permet d'interconnecter le réseau du collège au réseau mondial Internet ?",
        "reponses": [
          "routeur",
          "un routeur",
          "le routeur"
        ],
        "explication": "Le routeur oriente les données entre le réseau local du collège et le réseau externe Internet."
      },
      {
        "question": "Quel est le rôle d'un pare-feu (ou firewall) dans le réseau de l'établissement ?",
        "options": [
          "Un dispositif de sécurité qui filtre le trafic entrant et sortant pour bloquer les accès non autorisés et les sites inappropriés",
          "Il refroidit les ordinateurs",
          "Il augmente la vitesse du Wi-Fi"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est la différence principale entre une liaison filaire (câble Ethernet / RJ45) et une liaison sans fil (Wi-Fi) ?",
        "options": [
          "La connexion filaire offre un meilleur débit, plus de stabilité et plus de sécurité que le Wi-Fi",
          "Le Wi-Fi est toujours plus rapide et plus sûr que le câble",
          "Il n'y a aucune différence"
        ],
        "correct": 0
      },
      {
        "question": "Qu'est-ce qu'une adresse IP et à quoi sert-elle sur le réseau ?",
        "options": [
          "Un numéro d'identification unique attribué à chaque appareil du réseau pour permettre l'acheminement des données",
          "Le nom du propriétaire de l'ordinateur",
          "Le mot de passe du réseau Wi-Fi"
        ],
        "correct": 0
      },
      {
        "question": "Pourquoi chaque élève possède-t-il un identifiant (login) et un mot de passe personnels pour se connecter aux ordinateurs du collège ?",
        "options": [
          "Pour identifier l'utilisateur, lui donner accès à son propre travail et assurer la traçabilité des actions sur le réseau",
          "Pour que tous les élèves partagent les mêmes fichiers",
          "Pour que l'ordinateur démarre plus vite"
        ],
        "correct": 0
      },
      {
        "question": "Où sont enregistrés les fichiers d'un élève lorsqu'il les sauvegarde dans son espace personnel (lecteur réseau ou ENT) ?",
        "options": [
          "Sur le serveur du collège (ou sur le nuage de l'ENT), pas sur le disque dur local de l'ordinateur",
          "Sur le disque dur de l'ordinateur utilisé ce jour-là",
          "Dans l'imprimante"
        ],
        "correct": 0
      },
      {
        "question": "Quel est le rôle d'un serveur d'impression dans le réseau ?",
        "options": [
          "Il gère la file d'attente des documents envoyés par les utilisateurs vers les imprimantes du réseau",
          "Il fabrique les feuilles de papier",
          "Il protège le réseau contre les virus"
        ],
        "correct": 0
      },
      {
        "question": "Vrai ou Faux : Une borne Wi-Fi (point d'accès sans fil) transmet les données sous forme d'ondes radio.",
        "options": [
          "Vrai",
          "Faux"
        ],
        "correct": 0,
        "explication": "Vrai : les bornes d'accès sans fil utilisent les radiofréquences pour communiquer avec les appareils portables."
      },
      {
        "question": "Quel est le nom du câble et de la prise utilisés pour relier un ordinateur fixe à la prise murale du réseau au collège ?",
        "champs": [
          {
            "label": "Câble",
            "reponses": [
              "câble ethernet",
              "ethernet",
              "cable ethernet",
              "un câble ethernet"
            ]
          },
          {
            "label": "Prise",
            "reponses": [
              "rj45",
              "prise rj45",
              "connecteur rj45",
              "la prise rj45"
            ]
          }
        ],
        "explication": "Un câble Ethernet à paires torsadées, équipé de connecteurs RJ45."
      },
      {
        "question": "Quel est l'ordre de passage des données lorsqu'un élève consulte un site web depuis son poste informatique ?",
        "options": [
          "Poste élève → Commutateur → Routeur / Pare-feu → Internet",
          "Internet → Routeur → Commutateur → Poste élève",
          "Poste élève → Internet → Commutateur → Routeur"
        ],
        "correct": 0
      }
    ]
  },
  {
    "id": "pc5-melanges",
    "emoji": "🧪",
    "matiere": "Physique-chimie",
    "titre": "Physique-chimie 5ᵉ (1/4) : corps purs, mélanges, dissolution",
    "description": "Vocabulaire : corps pur, mélanges homogène et hétérogène, solvant, soluté, solution, saturation, gaz dissous, CO₂ et modélisation.",
    "questions": [
      {
        "question": "Qu'est-ce qu'un corps pur ?",
        "options": [
          "Une substance constituée d'une seule sorte de constituants (une seule espèce chimique)",
          "Une substance très propre, sans aucune saleté",
          "Un mélange dans lequel on ne distingue pas les constituants"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est la différence entre un mélange homogène et un mélange hétérogène ?",
        "options": [
          "Homogène : on ne distingue pas les constituants à l'œil nu ; hétérogène : on en distingue au moins deux",
          "Homogène : il contient de l'eau ; hétérogène : il n'en contient pas",
          "Homogène : un seul constituant ; hétérogène : plusieurs constituants"
        ],
        "correct": 0
      },
      {
        "question": "L'eau minérale (sans bulles) est-elle un corps pur ou un mélange ?",
        "options": [
          "Un mélange (homogène) : de l'eau et plusieurs sels minéraux dissous",
          "Un corps pur : c'est simplement de l'eau",
          "Un mélange hétérogène : on voit les sels minéraux"
        ],
        "correct": 0
      },
      {
        "question": "L'eau boueuse est-elle un mélange homogène ou hétérogène ?",
        "options": [
          "Hétérogène : on voit à l'œil nu les particules de terre en suspension",
          "Homogène : la terre est dissoute dans l'eau",
          "Ce n'est pas un mélange, c'est un corps pur"
        ],
        "correct": 0
      },
      {
        "question": "Dans de l'eau sucrée, quel est le nom donné à l'eau ?",
        "reponses": [
          "le solvant",
          "solvant"
        ],
        "explication": "L'eau est le solvant : le liquide qui dissout."
      },
      {
        "question": "Dans cette même eau sucrée, quel est le nom donné au sucre ?",
        "reponses": [
          "le soluté",
          "soluté"
        ],
        "explication": "Le sucre est le soluté : le corps qui est dissous."
      },
      {
        "question": "Comment appelle-t-on le mélange obtenu lorsque le sucre est totalement dissous dans l'eau ?",
        "reponses": [
          "une solution",
          "solution",
          "une solution aqueuse",
          "solution aqueuse"
        ],
        "explication": "C'est une solution (ici, une solution aqueuse)."
      },
      {
        "question": "Que signifie le mot « insoluble » ? Quel exemple convient avec l'eau ?",
        "options": [
          "Qui ne peut pas se dissoudre dans un solvant donné : le sable ou l'huile dans l'eau",
          "Qui se dissout très vite : le sucre dans l'eau",
          "Qui se dissout seulement à chaud : le sel dans l'eau"
        ],
        "correct": 0
      },
      {
        "question": "À quel moment dit-on qu'une solution est « saturée » ?",
        "options": [
          "Quand le solvant ne peut plus dissoudre davantage de soluté (l'excès reste au fond)",
          "Quand tout le soluté est dissous",
          "Quand la solution devient trouble après agitation"
        ],
        "correct": 0
      },
      {
        "question": "Les gaz peuvent-ils se dissoudre dans l'eau ?",
        "options": [
          "Oui",
          "Non"
        ],
        "correct": 0,
        "explication": "Oui, les gaz sont solubles dans l'eau (exemple : le CO₂ des boissons gazeuses)."
      },
      {
        "question": "Quel est le nom du gaz dissous présent dans toutes les boissons gazeuses ?",
        "reponses": [
          "le dioxyde de carbone",
          "dioxyde de carbone",
          "du dioxyde de carbone",
          "CO2",
          "CO₂",
          "gaz carbonique"
        ],
        "explication": "C'est le dioxyde de carbone (CO₂)."
      },
      {
        "question": "Quelle est la conséquence de la présence de dioxyde de carbone (CO₂) dans l'atmosphère sur le climat ?",
        "options": [
          "C'est un gaz à effet de serre : il retient la chaleur et contribue au réchauffement climatique",
          "Il refroidit la planète en bloquant les rayons du Soleil",
          "Il n'a aucun effet sur le climat"
        ],
        "correct": 0
      },
      {
        "question": "Quel rôle jouent les océans vis-à-vis du CO₂ atmosphérique ?",
        "options": [
          "Ils absorbent (dissolvent) une partie du CO₂ de l'atmosphère, ce qui limite le réchauffement",
          "Ils produisent tout le CO₂ de l'atmosphère",
          "Ils n'échangent aucun gaz avec l'atmosphère"
        ],
        "correct": 0
      },
      {
        "question": "On représente les molécules par des symboles (ronds, triangles…). À quoi reconnaît-on le schéma d'un corps pur ?",
        "options": [
          "Tous les symboles dessinés dans le récipient sont identiques",
          "Les symboles sont rangés en lignes bien droites",
          "Il y a autant de ronds que de triangles"
        ],
        "correct": 0
      },
      {
        "question": "Comment reconnaît-on le schéma d'un mélange homogène par rapport à celui d'un mélange hétérogène ?",
        "options": [
          "Homogène : symboles différents bien mélangés partout ; hétérogène : symboles regroupés par zones distinctes",
          "Homogène : un seul type de symbole ; hétérogène : deux types de symboles",
          "Homogène : symboles tous au fond ; hétérogène : symboles tous en surface"
        ],
        "correct": 0,
        "explication": "Exemple de mélange hétérogène : tous les triangles en bas et tous les ronds au-dessus."
      }
    ]
  },
  {
    "id": "pc5-conversions",
    "emoji": "📏",
    "matiere": "Physique-chimie",
    "titre": "Physique-chimie 5ᵉ (2/4) : conversions, verrerie, proportionnalité",
    "description": "Verrerie, incertitude de mesure, équivalences de volumes, conversions de masses et de volumes, proportionnalité.",
    "questions": [
      {
        "question": "Quel instrument de verrerie utilise-t-on pour mesurer précisément un volume de liquide ?",
        "options": [
          "L'éprouvette graduée",
          "Le bécher",
          "L'erlenmeyer"
        ],
        "correct": 0,
        "explication": "On peut aussi utiliser une fiole jaugée ou une pipette jaugée."
      },
      {
        "question": "Quels récipients servent à contenir ou mélanger des liquides, mais pas à faire des mesures précises ?",
        "options": [
          "Le bécher et l'erlenmeyer (ou le tube à essais)",
          "L'éprouvette graduée et la pipette jaugée",
          "La fiole jaugée et l'éprouvette graduée"
        ],
        "correct": 0
      },
      {
        "question": "Pourquoi toute mesure en physique-chimie s'accompagne-t-elle d'une « marge d'erreur » (incertitude) ?",
        "options": [
          "Les instruments ont une précision limitée et l'œil peut faire une petite erreur de lecture",
          "Parce que les élèves font toujours des erreurs de calcul",
          "Parce que les liquides changent de volume quand on les regarde"
        ],
        "correct": 0
      },
      {
        "question": "Combien de litres (L) y a-t-il dans 1 m³ ?",
        "reponses": [
          "1000",
          "1000 L",
          "1000 litres"
        ],
        "explication": "1 m³ = 1 000 L."
      },
      {
        "question": "À quel volume en litres (L) correspond 1 dm³ ?",
        "reponses": [
          "1",
          "1 L",
          "1 litre"
        ],
        "explication": "1 dm³ = 1 L."
      },
      {
        "question": "À quel volume en millilitres (mL) correspond 1 cm³ ?",
        "reponses": [
          "1",
          "1 mL",
          "1 millilitre"
        ],
        "explication": "1 cm³ = 1 mL."
      },
      {
        "question": "Convertis 250 g en kilogrammes (kg).",
        "reponses": [
          "0,25",
          "0,25 kg"
        ],
        "explication": "250 g = 0,25 kg."
      },
      {
        "question": "Convertis 0,045 kg en grammes (g).",
        "reponses": [
          "45",
          "45 g"
        ],
        "explication": "0,045 kg = 45 g."
      },
      {
        "question": "Convertis 1,5 L en millilitres (mL).",
        "reponses": [
          "1500",
          "1500 mL"
        ],
        "explication": "1,5 L = 1 500 mL."
      },
      {
        "question": "Convertis 350 mL en litres (L).",
        "reponses": [
          "0,35",
          "0,35 L"
        ],
        "explication": "350 mL = 0,35 L."
      },
      {
        "question": "Convertis 2,5 m³ en litres (L).",
        "reponses": [
          "2500",
          "2500 L"
        ],
        "explication": "2,5 m³ = 2 500 L."
      },
      {
        "question": "Convertis 400 L en mètres cubes (m³).",
        "reponses": [
          "0,4",
          "0,4 m³",
          "0,4 m3"
        ],
        "explication": "400 L = 0,4 m³."
      },
      {
        "question": "Un paquet de 4 stylos coûte 6 €. Quel est le coefficient de proportionnalité pour passer du nombre de stylos au prix ?",
        "reponses": [
          "1,5",
          "1,50"
        ],
        "explication": "6 ÷ 4 = 1,5 : le coefficient est 1,5 (un stylo coûte 1,50 €)."
      },
      {
        "question": "La masse d'un liquide est proportionnelle à son volume : 2 L pèsent 1,6 kg. Combien pèsent 5 L de ce liquide ?",
        "reponses": [
          "4",
          "4 kg"
        ],
        "explication": "Pour 1 L : 1,6 ÷ 2 = 0,8 kg. Pour 5 L : 5 × 0,8 = 4 kg."
      },
      {
        "question": "10 g de sel se dissolvent dans 50 mL d'eau, et 25 g dans 125 mL. Est-ce une situation de proportionnalité ?",
        "options": [
          "Oui : 10 ÷ 50 = 0,2 et 25 ÷ 125 = 0,2, les quotients sont égaux",
          "Non : 25 n'est pas le double de 10",
          "Non : 10 ÷ 50 = 5 et 25 ÷ 125 = 4"
        ],
        "correct": 0
      }
    ]
  },
  {
    "id": "pc5-solubilite",
    "emoji": "🧂",
    "matiere": "Physique-chimie",
    "titre": "Physique-chimie 5ᵉ (3/4) : la solubilité et les calculs",
    "description": "Définition et unité de la solubilité, calculs s = m ÷ V, saturation, influence de la température, conservation de la masse.",
    "questions": [
      {
        "question": "Quelle est la définition de la « solubilité » d'un soluté dans un solvant ?",
        "options": [
          "La masse maximale de soluté que l'on peut dissoudre dans 1 L de solvant, à une température donnée",
          "La masse de solvant nécessaire pour dissoudre 1 g de soluté",
          "Le volume de la solution obtenue après la dissolution"
        ],
        "correct": 0
      },
      {
        "question": "Quelle est l'unité usuelle de la solubilité au collège ?",
        "reponses": [
          "g/L",
          "gramme par litre",
          "grammes par litre"
        ],
        "explication": "Le gramme par litre (g/L)."
      },
      {
        "question": "Quelle formule donne la solubilité s à partir de la masse maximale dissoute m et du volume de solvant V ?",
        "options": [
          "s = m ÷ V (m en grammes, V en litres)",
          "s = m × V",
          "s = V ÷ m"
        ],
        "correct": 0
      },
      {
        "question": "On peut dissoudre au maximum 72 g de sel dans 0,2 L d'eau. Quelle est la solubilité du sel dans l'eau (en g/L) ?",
        "reponses": [
          "360",
          "360 g/L"
        ],
        "explication": "s = 72 ÷ 0,2 = 360 g/L."
      },
      {
        "question": "On dissout au maximum 100 g de sucre dans 50 mL d'eau. Calcule la solubilité du sucre en g/L.",
        "reponses": [
          "2000",
          "2000 g/L"
        ],
        "explication": "50 mL = 0,05 L, donc s = 100 ÷ 0,05 = 2 000 g/L."
      },
      {
        "question": "La saturation est atteinte avec 64 g de sulfate de cuivre dans 200 mL d'eau. Calcule sa solubilité en g/L.",
        "reponses": [
          "320",
          "320 g/L"
        ],
        "explication": "200 mL = 0,2 L, donc s = 64 ÷ 0,2 = 320 g/L."
      },
      {
        "question": "La solubilité du sel à 20 °C est de 360 g/L. Peut-on dissoudre totalement 400 g de sel dans 1 L d'eau ?",
        "options": [
          "Non : 400 g dépasse les 360 g possibles, il restera 40 g au fond",
          "Oui : il suffit de bien mélanger",
          "Oui : 400 g est inférieur à 1 000 g"
        ],
        "correct": 0
      },
      {
        "question": "Solubilité du sel : 360 g/L. Quelle masse maximale de sel peut-on dissoudre dans 0,5 L d'eau (en g) ?",
        "reponses": [
          "180",
          "180 g"
        ],
        "explication": "m = s × V = 360 × 0,5 = 180 g."
      },
      {
        "question": "Solubilité du sel : 360 g/L. On verse 80 g de sel dans 250 mL d'eau. La solution est-elle saturée ?",
        "options": [
          "Non : dans 0,25 L on peut dissoudre jusqu'à 90 g, et 80 < 90",
          "Oui : 80 g, c'est trop pour 250 mL d'eau",
          "Oui : une solution salée est toujours saturée"
        ],
        "correct": 0
      },
      {
        "question": "On verse 100 g de sel dans 250 mL d'eau (solubilité : 360 g/L). Quelle masse se dissout, et quelle masse reste au fond ?",
        "champs": [
          {
            "label": "Masse dissoute (g)",
            "reponses": [
              "90",
              "90 g"
            ]
          },
          {
            "label": "Masse restée au fond (g)",
            "reponses": [
              "10",
              "10 g"
            ]
          }
        ],
        "explication": "Dans 0,25 L on peut dissoudre au maximum 360 × 0,25 = 90 g : 90 g se dissolvent et 100 − 90 = 10 g restent au fond."
      },
      {
        "question": "À 20 °C, la solubilité du sucre est de 2 000 g/L et celle du sel de 360 g/L. Quel soluté est le plus soluble dans l'eau ?",
        "reponses": [
          "le sucre",
          "sucre"
        ],
        "explication": "Le sucre : on peut en dissoudre une masse bien plus grande dans 1 L d'eau (2 000 g contre 360 g)."
      },
      {
        "question": "En général, comment évolue la solubilité d'un solide dans l'eau quand la température de l'eau augmente ?",
        "options": [
          "Elle augmente",
          "Elle diminue",
          "Elle reste la même"
        ],
        "correct": 0,
        "explication": "On dissout plus facilement le sucre dans du thé chaud que dans de l'eau froide."
      },
      {
        "question": "Comment évolue la solubilité d'un gaz (comme le CO₂) dans l'eau quand la température augmente ?",
        "options": [
          "Elle diminue",
          "Elle augmente",
          "Elle reste la même"
        ],
        "correct": 0,
        "explication": "Une boisson gazeuse chaude perd ses bulles plus vite."
      },
      {
        "question": "On dissout 15 g de sucre dans 100 g d'eau. Quelle est la masse totale de la solution (en g) ?",
        "reponses": [
          "115",
          "115 g"
        ],
        "explication": "La masse se conserve lors d'une dissolution : 100 + 15 = 115 g."
      },
      {
        "question": "1 L d'eau a une masse de 1 000 g. On y dissout 50 g de sel. Quelle est la masse de la solution obtenue (en g) ?",
        "reponses": [
          "1050",
          "1050 g"
        ],
        "explication": "La masse se conserve : 1 000 + 50 = 1 050 g."
      }
    ]
  },
  {
    "id": "pc5-graphiques",
    "emoji": "📈",
    "matiere": "Physique-chimie",
    "titre": "Physique-chimie 5ᵉ (4/4) : graphiques et analyse de données",
    "description": "Méthode du graphique (axes, titre, points, tracé, échelle), description d'une évolution, lecture d'un tableau, modélisation.",
    "questions": [
      {
        "question": "Que doit-on obligatoirement dessiner à l'extrémité de chacun des deux axes d'un graphique ?",
        "options": [
          "Une flèche",
          "Un point",
          "Une croix"
        ],
        "correct": 0
      },
      {
        "question": "Quelles sont les deux informations à écrire au bout de chaque axe ?",
        "champs": [
          {
            "label": "Information",
            "reponses": [
              "la grandeur",
              "grandeur",
              "le nom de la grandeur",
              "la grandeur mesurée",
              "grandeur mesurée"
            ]
          },
          {
            "label": "Information",
            "reponses": [
              "l'unité",
              "unité",
              "son unité",
              "l'unité entre parenthèses",
              "unite"
            ]
          }
        ],
        "libre": true,
        "explication": "La grandeur mesurée et son unité (entre parenthèses)."
      },
      {
        "question": "On demande « l'évolution de la solubilité en fonction de la température ». Quelle grandeur place-t-on sur l'axe vertical (ordonnées) ?",
        "reponses": [
          "la solubilité",
          "solubilité"
        ],
        "explication": "La grandeur citée en premier (« évolution de … ») va toujours sur l'axe vertical."
      },
      {
        "question": "Sur quel axe place-t-on alors la température ?",
        "options": [
          "Sur l'axe horizontal (abscisses)",
          "Sur l'axe vertical (ordonnées)",
          "Sur les deux axes"
        ],
        "correct": 0,
        "explication": "La grandeur qui suit « en fonction de … » va sur l'axe horizontal."
      },
      {
        "question": "Quelle est la formulation attendue pour le titre d'un graphique ?",
        "options": [
          "« Graphique représentant l'évolution de [grandeur verticale] en fonction de [grandeur horizontale] »",
          "« Graphique de [grandeur horizontale] et de [grandeur verticale] »",
          "« Tableau des mesures »"
        ],
        "correct": 0
      },
      {
        "question": "Sous quelle forme place-t-on les points sur le papier millimétré ?",
        "options": [
          "De petites croix droites « + »",
          "De gros points ronds",
          "Des croix penchées « x »"
        ],
        "correct": 0
      },
      {
        "question": "Comment relie-t-on les points entre eux, et pourquoi pas à la règle ?",
        "options": [
          "À main levée, en une courbe lisse : les phénomènes physiques évoluent de façon continue",
          "À la règle, segment par segment : c'est plus précis",
          "On ne les relie jamais"
        ],
        "correct": 0
      },
      {
        "question": "L'axe horizontal mesure 10 cm et la température va de 0 °C à 100 °C. Quelle échelle simple choisir ? 1 cm représente … °C",
        "reponses": [
          "10",
          "10 °C",
          "1 cm pour 10 °C",
          "1 cm représente 10 °C"
        ],
        "explication": "1 cm représente 10 °C."
      },
      {
        "question": "Quels sont les trois mots-clés possibles pour décrire l'évolution d'une grandeur ?",
        "champs": [
          {
            "label": "Mot-clé",
            "reponses": [
              "augmente",
              "elle augmente",
              "augmenter"
            ]
          },
          {
            "label": "Mot-clé",
            "reponses": [
              "diminue",
              "elle diminue",
              "diminuer"
            ]
          },
          {
            "label": "Mot-clé",
            "reponses": [
              "reste constante",
              "constante",
              "reste constant",
              "stagne",
              "ne varie pas"
            ]
          }
        ],
        "libre": true,
        "explication": "La grandeur augmente, diminue, ou reste constante (stagne)."
      },
      {
        "question": "Solubilité d'un gaz : 2,3 g/L à 10 °C ; 1,7 g/L à 20 °C ; 1,3 g/L à 30 °C. Quelle phrase répond à « Comment varie la solubilité de ce gaz en fonction de la température ? »",
        "options": [
          "Lorsque la température augmente (de 10 °C à 30 °C), la solubilité de ce gaz diminue (de 2,3 g/L à 1,3 g/L).",
          "Lorsque la température augmente, la solubilité de ce gaz augmente.",
          "La solubilité de ce gaz vaut 1,7 g/L."
        ],
        "correct": 0,
        "explication": "Il est toujours apprécié de citer les valeurs extrêmes du tableau."
      },
      {
        "question": "D'après ce tableau (2,3 g/L à 10 °C ; 1,7 g/L à 20 °C ; 1,3 g/L à 30 °C), quelle est la solubilité du gaz à 20 °C ? N'oublie pas l'unité.",
        "reponses": [
          "1,7 g/L",
          "1,7 gramme par litre",
          "1,7 grammes par litre"
        ],
        "explication": "1,7 g/L (une valeur sans unité est incomplète)."
      },
      {
        "question": "D'après ce même tableau, à quelle température la solubilité est-elle égale à 1,3 g/L ?",
        "reponses": [
          "30 °C",
          "30°C",
          "30 degrés",
          "30"
        ],
        "explication": "À 30 °C."
      },
      {
        "question": "Sur un graphique, la courbe est un trait parfaitement horizontal. Comment décrit-on l'évolution de la grandeur ?",
        "options": [
          "« La grandeur reste constante (elle ne varie pas) lorsque [grandeur horizontale] augmente. »",
          "« La grandeur augmente régulièrement. »",
          "« La grandeur diminue jusqu'à zéro. »"
        ],
        "correct": 0
      },
      {
        "question": "Tu dessines un bécher d'eau (ronds bleus) où l'on a dissous du dioxyde de carbone (triangles rouges). Comment places-tu les symboles ?",
        "options": [
          "Ronds bleus et triangles rouges répartis uniformément dans tout le liquide (mélange homogène)",
          "Tous les triangles rouges en haut, au-dessus de l'eau",
          "Tous les triangles rouges au fond du bécher"
        ],
        "correct": 0
      },
      {
        "question": "Tu ajoutes trop de sel (carrés verts) : la solution est saturée. Où dessines-tu les carrés verts ?",
        "options": [
          "Une partie mélangée uniformément au liquide (sel dissous), le surplus entassé au fond (dépôt non dissous)",
          "Tous les carrés au fond du bécher",
          "Tous les carrés répartis dans le liquide, aucun au fond"
        ],
        "correct": 0
      }
    ]
  }
];
