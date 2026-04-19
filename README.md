# ELECTROBOY 80 — Plateforme Backend

## Architecture

```
electroboy80-backend/
├── server.js          ← Backend Node.js + Express (API REST)
├── admin.html         ← Dashboard Admin (prototype)
├── portal.html        ← Portail Fans & Partenaires (prototype)
├── package.json
├── electroboy80.db    ← SQLite (créé automatiquement)
└── uploads/           ← Fichiers uploadés (créé automatiquement)
```

## Rôles

| Rôle      | Accès                                                      |
|-----------|------------------------------------------------------------|
| `admin`   | Tout : contenu, événements, users, RS, stats               |
| `fan`     | Feed public + exclusif, événements, alertes concerts       |
| `partner` | Stats, kit presse, co-événements, soumettre des offres     |

## Installation

```bash
npm install
npm start
# Dev avec hot-reload :
npm run dev
```

Serveur sur **http://localhost:3001**

Admin par défaut : `admin@electroboy80.fr` / `admin1234`

---

## API Endpoints

### Auth
```
POST /api/auth/register    { name, email, password, role }
POST /api/auth/login       { email, password } → { token, user }
GET  /api/auth/me          → profil utilisateur connecté
```

### Contenu
```
GET    /api/content               → liste (filtré par rôle)
POST   /api/content               → créer (admin, multipart/form-data)
PATCH  /api/content/:id           → modifier (admin)
DELETE /api/content/:id           → supprimer (admin)
POST   /api/content/:id/publish   → publier sur RS (admin)
POST   /api/content/:id/react     → like/unlike
GET    /api/content/:id/reactions → compteurs réactions
```

### Événements
```
GET    /api/events          → liste des concerts
POST   /api/events          → créer (admin)
PATCH  /api/events/:id      → modifier (admin)
DELETE /api/events/:id      → supprimer (admin)
```

### Utilisateurs
```
GET    /api/users           → liste (admin)
PATCH  /api/users/:id       → modifier statut/accès (admin)
DELETE /api/users/:id       → supprimer (admin)
```

### Stats & RS
```
GET  /api/stats             → tableau de bord stats (admin)
GET  /api/social/log        → historique publications RS (admin)
GET  /api/scheduled         → posts programmés (admin)
DELETE /api/scheduled/:id   → annuler programmation (admin)
```

### Messages
```
GET   /api/messages         → tous les messages (admin)
POST  /api/messages         → envoyer un message (public)
PATCH /api/messages/:id/read → marquer lu (admin)
```

---

## Connexion Réseaux Sociaux

Dans `server.js`, les fonctions dans `socialPublishers` sont des stubs.
Pour les activer, remplacer chaque stub par l'appel API correspondant :

### Facebook
```js
// Nécessite : Facebook Page Access Token
// https://developers.facebook.com/docs/graph-api/reference/page/feed
const FB_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
const PAGE_ID  = process.env.FACEBOOK_PAGE_ID;
await fetch(`https://graph.facebook.com/${PAGE_ID}/feed`, {
  method: 'POST',
  body: JSON.stringify({ message: content.body, access_token: FB_TOKEN })
});
```

### Instagram
```js
// Nécessite : Instagram Graph API (via Facebook Business)
// 1. Upload media
// 2. Publier via /media_publish
const IG_ID    = process.env.INSTAGRAM_ACCOUNT_ID;
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
```

### Variables d'environnement
```env
JWT_SECRET=change_me_in_production
PORT=3001
FACEBOOK_PAGE_TOKEN=xxx
FACEBOOK_PAGE_ID=xxx
INSTAGRAM_ACCOUNT_ID=xxx
INSTAGRAM_ACCESS_TOKEN=xxx
TIKTOK_CLIENT_KEY=xxx
TIKTOK_CLIENT_SECRET=xxx
```

---

## Déploiement (Railway / Render)

```bash
# Sur Railway ou Render :
# 1. Push le dossier sur GitHub
# 2. Connecter le repo au service
# 3. Définir les variables d'env
# 4. Start command : node server.js
```

Pour la base de données en production, migrer vers **PostgreSQL** ou **PlanetScale**
en remplaçant `better-sqlite3` par `pg` ou `mysql2`.
