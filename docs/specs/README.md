# Specs de features

Une feature sans spec ne se code pas. Une spec par feature, nommée `NNN-nom-de-la-feature.md`.

Sections attendues (`../03-application/08-organisation-multi-agents.md`) :

- **Contexte** — persona + pain point (réf. `../02-produit/01-pain-points-opportunites.md`), priorité backlog (réf. `../02-produit/06-backlog-priorise-planning.md`).
- **Règles métier** — exhaustives, cas limites inclus : c'est la section que l'agent back transforme en tests.
- **Critères d'acceptation** — liste vérifiable, chaque agent coche les siens.
- **Hors scope** — explicite, pour empêcher la dérive.
- **Choix non couverts par les docs** — tableau *sujet / choix retenu / pourquoi*. Un lot ne s'arrête jamais faute d'arbitrage : on prend l'option la plus simple et on l'inscrit ici.

Les choix de ce dernier tableau qui méritent une vraie décision produit sont repris dans `../02-produit/09-decisions-metier-en-attente.md`, pour ne pas rester enterrés dans une spec que personne ne relit.

Le lot correspondant est défini dans `../03-application/09-decoupage-execution-opus.md`.
