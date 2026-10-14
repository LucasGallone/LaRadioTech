---
title: "Scanner la bande FM à distance depuis son navigateur Internet : C'est possible !"
description: "Zoom sur le projet FM-DX Webserver, pouvant être une alternative intéressante pour la surveillance FM à bas prix."
author: "Lucas Gallone"
date: 14/10/2026
image: /img/img-principale-article-serveurs-dx
tags: ["FM", "Diffusion", "Surveillance"]
---

Imaginez-vous en train d’écouter et même de scanner la bande FM d’une ville à 6000 kilomètres de chez vous, sur votre canapé, dans les transports en commun… Tout cela est bien possible grâce à l’invention du développeur tchèque Marek Farkaš, sans aucun logiciel à installer ! Explications.

## Présentation du projet

Ce concept n’est pas du tout récent pour la plupart des passionnés de radio FM : Les serveurs d’écoute à distance existent depuis de nombreuses années. Cependant, la grande majorité nécessitait jusque-là l'installation d’un logiciel, et surtout, il fallait obligatoirement se trouver devant son ordinateur pour scanner la FM à distance.

Créé au début de l’année 2024, le projet open source (libre) “FM-DX Webserver” permet à n’importe quel utilisateur de se connecter à un récepteur FM compatible sans passer par un quelconque logiciel. Tout se déroule directement dans un navigateur web. Les serveurs disposent d’une interface à la fois adaptée pour les PC, tablettes et smartphones.

La carte des serveurs, accessible directement [en cliquant ici](https://servers.fmdx.org/), comporte actuellement 550 récepteurs (En date du 14/10/2026), répartis sur tous les continents du globe, même en Afrique !

![La carte des serveurs est bien garnie. De quoi passer des heures à écouter la FM du Monde entier !](/img/carte-serveurs-fmdx.jpg)

## Exemple avec un serveur aux USA

Prenons-en un au hasard… Nous atterrissons en Californie, à San Rafael plus précisément. En cliquant sur le point sur la carte, une description du récepteur s’affiche et même le contact du propriétaire. Il suffit de cliquer sur “Connect” pour y accéder.

![Avant d'accéder à un serveur, on peut trouver une description, des détails techniques et le contact du propriétaire.](/img/carte-serveurs-fmdx2.jpg)

À peine arrivons-nous sur l’interface du serveur que nous tombons sur le 96.5 MHz de KOIT, une célèbre radio de San Francisco. On peut apercevoir ses informations RDS de manière détaillée : Code PI, PS, Radiotexte, PTY…

![Un serveur situé en Californie.](/img/exemple-serveur-fmdx-usa.jpg)

En bas à droite, se trouve une petite case permettant de voir très précisément où se situe l’émetteur : Dans quelle ville, à quelle distance du récepteur, sa puissance PAR (Puissance Apparente Rayonnée), mais aussi sa polarisation (en l’occurrence, ici, la polarisation est mixte).

Tout en haut, une liste de plugins, sélectionnés par le propriétaire du serveur, se présente… Car oui, tout serveur est personnalisable : Plugins, fond d’écran. Le propriétaire peut le configurer selon ses envies.

On y trouve, entre autres, mon décodeur RDS avancé, “RDSExpert”, qui détecte un service TMC (Traffic Message Channel) sur cette station.

![Décodage du service TMC (Traffic Message Channel) avec RDSExpert - Affichage détaillé des événéments trafic détectés](/img/exemple-serveur-fmdx-usa3.jpg)

---

![L'installation d'un serveur FM hébergé en République Tchèque | Photo : © Marek Farkaš](/img/installation-dx-rep-tcheque.png)

Au départ, et comme son nom l’indique, ce projet a été pensé pour les DXers (Les passionnés de réceptions à longue distance). L’idée était de permettre à ces passionnés de surveiller les conditions de propagation Troposphérique et Sporadique E, et éventuellement, de recevoir des stations FM de leur pays… depuis un autre !

La petite communauté a vite grandi. En quelques mois, le nombre de serveurs a considérablement augmenté. Si bien que les usages se sont démocratisés : Certains serveurs ont été conçus pour permettre purement et simplement aux utilisateurs de faire un tour sur la bande FM locale de telle ou telle ville, faire des relevés RDS, etc…

Mais, et c’est le point que je souhaite particulièrement mettre en avant dans cet article : Certains serveurs servent à la surveillance d’émetteurs !

## Une alternative de surveillance pour les stations de radio, à moindre prix

Les systèmes de surveillance professionnels peuvent être onéreux pour les petites stations, principalement les associatives. Lorsqu’une radio dispose de plusieurs émetteurs, non reçus depuis les studios, une surveillance en continu devient indispensable. Ce concept de serveur est une alternative bénéfique, à moins de 100 euros, pour un technicien ou un directeur de station. Il faudra, tout de même, des connaissances en informatique et réseau pour mettre un tel système en place de manière sécurisée. Un article sera éventuellement élaboré prochainement à ce sujet, puisque j’ai reçu plusieurs sollicitations de professionnels, intéressés par ce concept.

Il n’existe encore pas, à ce jour, la possibilité d’envoyer des alertes par mail en cas de panne d’un émetteur ou l’absence de modulation (plus d’audio) via ces serveurs. Un plugin de surveillance existe avec l’envoi d’alertes via différents supports, comme Telegram, mais pas par mail, un moyen largement apprécié par les techniciens radio.
Cependant, via son interface HTML, un serveur de ce type fera parfaitement l’affaire pour une radio désireuse de vérifier sa diffusion et son RDS à distance, contrôler son signal, etc… Le tout, même depuis un smartphone ! L’obligation d’être derrière un ordinateur en permanence pour surveiller une diffusion est donc aujourd’hui révolue.

![Photo d'illustration | Crédit : Marília Castelli (sur Unsplash)](/img/illustration-autoradio.jpg)

Plusieurs récepteurs sont compatibles pour l’élaboration d’un serveur, mais je recommanderais tout de même le TEF6686 ou TEF6687. Ces deux types de récepteurs sont les plus sélectifs. La résistance aux intermodulations sur site d’émission est impressionnante. Je peux personnellement en attester puisque j’ai installé un récepteur de ce type avec contrôle à distance sur un site d’émission avec 2 radios diffusées à 500W.
L’antenne de réception se trouve sur le pylône, en dessous des antennes d’émission, et pourtant, la réception d’autres stations (parfois à près de 100 kilomètres !) est totalement possible, sans intermodulations causées par nos deux stations, là où beaucoup de récepteurs auraient du mal à les filtrer.

## Quelques bonnes pratiques d’usage sur les serveurs

La plupart des serveurs reposent sur l’idéologie “Premier arrivé, premier servi”.

• Puisque les serveurs sont partagés, vérifiez toujours le nombre d’utilisateurs connectés en haut à droite de l’écran (compteur à côté de l’icône en forme de personne). Si vous remarquez que quelqu’un d’autre est présent, attendez patiemment votre tour, ou bien faites savoir dans le tchat (en anglais de préférence) que vous souhaitez scanner et attendez une réponse du premier arrivé.

• Prenez connaissance de la description du serveur sur lequel vous vous trouvez. Certains propriétaires encadrent parfois l’utilisation exclusivement pour la chasse aux ondes (“DX”). L’écoute prolongée d’une radio n’est donc pas préconisée.

• Pensez à bien fermer la page ou l’onglet du serveur en question à la fin de votre écoute, sinon vous pourriez accidentellement bloquer l’utilisation pour d’autres utilisateurs qui pourraient croire que vous êtes actuellement à l’écoute !

• Ne restez pas indéfiniment sur une fréquence en particulier, le but est surtout de scanner et faire le tour de la bande FM.

## Et pour ceux qui souhaiteraient en installer un dès maintenant…

![](/img/repo-github-fmdx.jpg)

Vous êtes locuteur de la langue de Shakespeare, vous avez l’habitude de GitHub, et l’informatique ne vous fait pas peur ? Prenez donc quelque chose à boire ou à grignoter, et consultez les instructions disponibles sur la page GitHub du projet, [en cliquant ici.](https://github.com/NoobishSVK/fm-dx-webserver)

Et bonne nouvelle, tous les systèmes d'exploitation sont pris en charge : Windows, Linux et MacOS.

## Récepteurs officiellement pris en charge

**TEF6686 / 6687**
Compatibilité native. Excellente sélectivité et sensibilité à la réception.
Un guide pour l’achat de récepteurs TEF (en anglais) est disponible [en cliquant ici](https://fmdx.org/projects/guide/receivers.php).

**XDR (F1HD / S10HDiP)**
Non suffisamment testé de mon côté pour donner mon avis personnel, mais certaines fonctionnalités, présentes avec un TEF, peuvent ne pas être disponibles.

**SDR (RTL-SDR / Airspy)**
Pratique pour faire un serveur simple, mais montrera ses limites quant à la sélectivité et la sensibilité qui seront incomparables avec celles d’un TEF.

**Si47XX (Si4735 / Si4732)**
Récepteurs peu chers pour l’écoute locale ou la surveillance d’un émetteur. Un bon compromis, mais là aussi, il ne faudra pas s’attendre à la sélectivité et la sensibilité d’un récepteur TEF.

Ces récepteurs sont disponibles à l'achat sur Internet, principalement sur la plateforme AliExpress.

---

Je compte faire un tutoriel d’installation en français très prochainement. En attendant… bonne écoute et bon scan ! Avec plus de 500 serveurs, vous êtes servis. ;)
