# Déployer le site JISR — guide pas à pas

Le site est prêt (dossier `jisr-site`). Il ne reste que la mise en ligne. Tout est gratuit sauf l'achat du nom de domaine `jisr.ma`.

## 1. Mettre le code sur GitHub

1. Sur [github.com](https://github.com), créez un nouveau dépôt (par ex. `jisr-site`), **vide** (ne cochez ni README ni .gitignore, ils existent déjà dans le projet).
2. Dans le dossier du projet sur votre ordinateur, lancez :
   ```
   git init
   git add .
   git commit -m "Site JISR - version initiale"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/jisr-site.git
   git push -u origin main
   ```

## 2. Connecter le site à Netlify

1. Sur [app.netlify.com](https://app.netlify.com), cliquez sur **Add new site → Import an existing project**.
2. Choisissez GitHub, puis sélectionnez le dépôt `jisr-site`.
3. Netlify détecte automatiquement la configuration (`netlify.toml`) : build command `npm run build`, dossier publié `_site`. Cliquez sur **Deploy**.
4. Après 1-2 minutes, le site est en ligne sur une adresse du type `https://nom-aleatoire.netlify.app`.

## 3. Activer la publication d'articles depuis le navigateur (Decap CMS)

1. Dans Netlify : **Site configuration → Identity → Enable Identity**.
2. Toujours dans Identity : **Registration** → passez sur **Invite only** (pour que seules les personnes que vous invitez puissent publier).
3. Dans Identity → **Services**, activez **Git Gateway** (bouton "Enable Git Gateway"). C'est ce qui permet à l'interface de publication d'écrire directement dans votre dépôt GitHub sans que vous ayez à gérer de token.
4. Toujours dans Identity, cliquez sur **Invite users**, entrez votre email (freelance.zaid@gmail.com) et éventuellement celui des autres personnes autorisées à publier. Vous recevrez un email d'invitation.
5. Ouvrez le lien reçu par email : il vous amène sur le site, un mot de passe vous est demandé.
6. Rendez-vous ensuite sur `https://votre-site.netlify.app/admin/`, connectez-vous : vous arrivez sur l'interface de publication (3 collections : Articles FR / EN / AR). C'est ici que vous rédigerez vos futurs articles, sans toucher au code.

## 4. Connecter le nom de domaine jisr.ma

1. Achetez le domaine chez un registrar de votre choix (OVH, Gandi, ou un registrar marocain agréé). Les `.ma` ont parfois des règles d'enregistrement particulières (justificatifs, registrar agréé) — vérifiez les conditions exactes au moment de l'achat, elles évoluent.
2. Dans Netlify : **Site configuration → Domain management → Add a domain** → entrez `jisr.ma`.
3. Netlify vous donne soit des enregistrements DNS à ajouter chez votre registrar (A record + CNAME pour www), soit la possibilité d'utiliser les DNS Netlify directement (le plus simple : vous changez les "nameservers" chez le registrar pour ceux fournis par Netlify).
4. Une fois le DNS propagé (de quelques minutes à 24h), Netlify génère automatiquement un certificat HTTPS gratuit (Let's Encrypt). Le site sera accessible sur `https://jisr.ma`.

## 5. Écrire un nouvel article

1. Allez sur `https://jisr.ma/admin/` (ou l'adresse netlify.app en attendant le domaine).
2. Connectez-vous.
3. Choisissez la collection correspondant à la langue (Articles Français / English / عربي).
4. Cliquez sur **New Article**, remplissez titre, date, description courte, contenu.
5. Cliquez sur **Publish** : l'article est automatiquement ajouté au site en 1-2 minutes (Netlify reconstruit le site à chaque publication).

## Notes

- Le formulaire de la page "Rejoindre" et "Contact" utilise Netlify Forms (gratuit jusqu'à 100 soumissions/mois) : les réponses arrivent dans **Site configuration → Forms** sur Netlify, avec option d'être notifié par email (Forms → Settings → Form notifications).
- Le plan gratuit Netlify inclut : hébergement, HTTPS, 100 Go de bande passante/mois, Identity jusqu'à 1000 utilisateurs, Forms 100 soumissions/mois — largement suffisant pour démarrer.
- Pour ajouter d'autres personnes autorisées à publier, répétez l'étape "Invite users" dans Identity.
