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
      "texte": "Écouter les extraits sonores (Padlet / Digipad)"
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
  }
];
