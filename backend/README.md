# PlanAdmin — Backend Express.js + MongoDB

## 🚀 Installation

```bash
cd planadmin-backend
npm install

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec votre URI MongoDB

# Démarrer en développement
npm run dev

# Démarrer en production
npm start
```

---

## ⚙️ Variables d'environnement (`.env`)

| Variable       | Défaut                                    | Description                  |
|----------------|-------------------------------------------|------------------------------|
| `MONGODB_URI`  | `mongodb://localhost:27017/planadmin`     | URI de connexion MongoDB     |
| `PORT`         | `5000`                                    | Port du serveur              |
| `FRONTEND_URL` | `*`                                       | URL autorisée pour le CORS   |

---

## 📡 Endpoints API

### Workspaces
| Méthode | Route                      | Description                        |
|---------|----------------------------|------------------------------------|
| GET     | `/api/workspaces`          | Liste tous les workspaces          |
| POST    | `/api/workspaces`          | Créer un workspace                 |
| GET     | `/api/workspaces/:id`      | Détail + stats d'un workspace      |
| PUT     | `/api/workspaces/:id`      | Modifier un workspace              |
| DELETE  | `/api/workspaces/:id`      | Supprimer workspace + ses données  |

### Tâches (Gantt)
| Méthode | Route                                | Description                       |
|---------|--------------------------------------|-----------------------------------|
| GET     | `/api/workspaces/:wsId/tasks`        | Lister les tâches                 |
| POST    | `/api/workspaces/:wsId/tasks`        | Créer une tâche                   |
| POST    | `/api/workspaces/:wsId/tasks/bulk`   | Insertion groupée (import)        |
| PUT     | `/api/tasks/:id`                     | Modifier une tâche                |
| PATCH   | `/api/tasks/:id/dates`               | Mettre à jour les dates (Gantt)   |
| DELETE  | `/api/tasks/:id`                     | Supprimer une tâche               |
| DELETE  | `/api/workspaces/:wsId/tasks`        | Vider toutes les tâches           |

### Candidats
| Méthode | Route                                          | Description                         |
|---------|------------------------------------------------|-------------------------------------|
| GET     | `/api/workspaces/:wsId/candidats`              | Lister + filtrer les candidats      |
| POST    | `/api/workspaces/:wsId/candidats`              | Créer un candidat manuellement      |
| POST    | `/api/workspaces/:wsId/candidats/import`       | **Import massif depuis Excel**      |
| GET     | `/api/workspaces/:wsId/candidats/themes`       | Stats par thème/groupe              |
| PUT     | `/api/candidats/:id`                           | Modifier un candidat                |
| PATCH   | `/api/candidats/:id/statut`                    | Changer le statut rapidement        |
| DELETE  | `/api/candidats/:id`                           | Supprimer un candidat               |
| DELETE  | `/api/workspaces/:wsId/candidats/batch/:id`    | Supprimer un batch d'import         |

### Documents
| Méthode | Route                               | Description              |
|---------|-------------------------------------|--------------------------|
| GET     | `/api/workspaces/:wsId/documents`   | Lister les documents     |
| POST    | `/api/workspaces/:wsId/documents`   | Créer un document        |
| PUT     | `/api/documents/:id`                | Modifier un document     |
| DELETE  | `/api/documents/:id`                | Supprimer un document    |

### Historique des imports Excel
| Méthode | Route                                        | Description                          |
|---------|----------------------------------------------|--------------------------------------|
| GET     | `/api/workspaces/:wsId/imports`              | Liste des imports (sans rawRows)     |
| GET     | `/api/workspaces/:wsId/imports/:batchId`     | Détail complet d'un import           |

---

## 📦 Requêtes utiles (exemples curl)

### Créer un workspace
```bash
curl -X POST http://localhost:5000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"company":"TechCorp Maroc","startDate":"2026-02-01","endDate":"2026-04-30"}'
```

### Importer des candidats depuis Excel (côté frontend)
```javascript
// Corps de la requête POST /api/workspaces/:wsId/candidats/import
{
  "batchId": "abc123",
  "fileName": "stagiaires_2026.xlsx",
  "mapping": { "nom": 0, "prenom": 1, "theme": 3, "heures": 5 },
  "headers": ["Nom", "Prénom", "CIN", "Formation", "Société", "Heures"],
  "rawRows": [["Benali", "Yasmine", "AB123", "React", "ACME", "75"], ...],
  "themeConf": [{ "theme": "React", "jours": 10, "perGroup": "12" }],
  "candidats": [
    {
      "nom": "Benali",
      "prenom": "Yasmine",
      "theme": "React JS",
      "jours": 10,
      "groupe": 1,
      "dateDebut": "2026-02-03",
      "dateFin": "2026-02-14",
      "statut": "Reçu",
      "extraData": { "CIN": "AB123456", "Société": "ACME", "Ville": "Casablanca" }
    }
  ]
}
```

### Filtrer les candidats
```bash
# Par thème
GET /api/workspaces/:wsId/candidats?theme=React%20JS

# Par groupe
GET /api/workspaces/:wsId/candidats?groupe=2

# Recherche texte
GET /api/workspaces/:wsId/candidats?search=benali

# Pagination
GET /api/workspaces/:wsId/candidats?page=1&limit=50
```

---

## 🗄️ Structure des collections MongoDB

### `workspaces`
```
{ company, startDate, endDate, createdAt, updatedAt }
```

### `tasks`
```
{ workspace (ref), name, group, start, end, order, createdAt }
```

### `candidats`
```
{ workspace (ref), nom, prenom, poste, statut, email, telephone,
  theme, jours, groupe, dateDebut, dateFin, heures,
  extraData (Map), importBatch, createdAt }
```
> `extraData` stocke toutes les colonnes Excel supplémentaires

### `documents`
```
{ workspace (ref), nom, type, statut, dateDoc, lien, notes, createdAt }
```

### `excelimports`
```
{ workspace (ref), batchId, fileName, mapping, headers,
  rawRows (données brutes complètes), themeConf, stats, createdAt }
```

---

## 🔄 Intégration avec le frontend React

Remplacer les appels `window.storage` par des appels `fetch` :

```javascript
const API = "http://localhost:5000/api";

// Charger les candidats
const res = await fetch(`${API}/workspaces/${wsId}/candidats`);
const { data } = await res.json();

// Importer un batch Excel
await fetch(`${API}/workspaces/${wsId}/candidats/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ batchId, fileName, mapping, headers, rawRows, themeConf, candidats }),
});

// Mettre à jour les dates après drag & drop Gantt
await fetch(`${API}/tasks/${taskId}/dates`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ start: "2026-02-03", end: "2026-02-14" }),
});
```
