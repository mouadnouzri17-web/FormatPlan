const express = require("express");
const router  = express.Router();
const Candidat    = require("../models/Candidat");
const ExcelImport = require("../models/ExcelImport");

// ── GET /api/workspaces/:wsId/candidats
router.get("/workspaces/:wsId/candidats", async (req, res) => {
  try {
    const { theme, groupe, statut, search, page = 1, limit = 5000 } = req.query;

    const filter = { workspace: req.params.wsId };
    if (theme)  filter.theme  = theme;
    if (groupe) filter.groupe = Number(groupe);
    if (statut) filter.statut = statut;
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or =[{ nom: re }, { prenom: re }, { poste: re }, { theme: re }];
    }

    const [candidats, total] = await Promise.all([
      Candidat.find(filter)
        .sort({ theme: 1, groupe: 1, nom: 1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Candidat.countDocuments(filter),
    ]);

    const result = candidats.map(c => ({
      ...c,
      // ── Récupérer le matricule depuis extraData si absent du champ direct ──
      matricule: c.matricule || (c.extraData && c.extraData.__matricule__) || "",
      extraData: c.extraData ? Object.fromEntries(Object.entries(c.extraData)) : {},
    }));

    res.json({ total, page: Number(page), limit: Number(limit), data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces/:wsId/candidats  — créer un candidat manuellement
router.post("/workspaces/:wsId/candidats", async (req, res) => {
  try {
    const { nom, prenom } = req.body;
    if (!nom || !prenom)
      return res.status(400).json({ error: "nom et prenom sont requis" });

    const candidat = await Candidat.create({ workspace: req.params.wsId, ...req.body });
    res.status(201).json({
      ...candidat.toObject(),
      extraData: Object.fromEntries(candidat.extraData || new Map()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces/:wsId/candidats/import  — import massif depuis Excel
router.post("/workspaces/:wsId/candidats/import", async (req, res) => {
  try {
    const {
      batchId, fileName, mapping, headers,
      rawRows, themeConf, candidats,
    } = req.body;

    if (!Array.isArray(candidats) || candidats.length === 0)
      return res.status(400).json({ error: "candidats[] est requis" });

    // ── 1. Purger les anciens candidats du workspace pour éviter les doublons ──
    await Candidat.deleteMany({ workspace: req.params.wsId });

    // ── 2. Sauvegarder le batch brut Excel pour historique/audit ──
    if (batchId) {
      await ExcelImport.findOneAndUpdate(
        { batchId },
        {
          workspace: req.params.wsId,
          batchId, fileName: fileName || "",
          mapping:   mapping   || {},
          headers:   headers   || [],
          rawRows:   rawRows   ||[],
          themeConf: themeConf ||[],
          stats: {
            totalCandidats: candidats.length,
            totalThemes:[...new Set(candidats.map(c => c.theme).filter(Boolean))].length,
            totalGroupes:[...new Set(candidats.map(c => `${c.theme}||${c.groupe}`))].length,
          },
        },
        { upsert: true, new: true }
      );
    }

    // ── 3. Insérer tous les candidats avec le champ matricule ──
    const docs = candidats.map(c => ({
      workspace:   req.params.wsId,
      nom:         c.nom        || "",
      prenom:      c.prenom     || "",
      matricule:   c.matricule  || "",
      poste:       c.poste      || c.theme || "",
      statut:      c.statut     || "Reçu",
      notes:       c.notes      || "",
      theme:       c.theme      || "",
      jours:       c.jours      || 0,
      groupe:      c.groupe     || 1,
      dateDebut:   c.dateDebut  || c.start || "",
      dateFin:     c.dateFin    || c.end   || "",
      heures:      c.heures     || 0,
      extraData:   c.extraData  || {},
      importBatch: batchId      || "",
    }));

    const inserted = await Candidat.insertMany(docs, { ordered: false });
    res.status(201).json({
      inserted: inserted.length,
      batchId,
      message: `${inserted.length} candidat(s) importé(s) avec succès`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/candidats/:id
router.put("/candidats/:id", async (req, res) => {
  try {
    const candidat = await Candidat.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!candidat) return res.status(404).json({ error: "Candidat non trouvé" });
    res.json({
      ...candidat.toObject(),
      extraData: Object.fromEntries(candidat.extraData || new Map()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/candidats/:id/statut
router.patch("/candidats/:id/statut", async (req, res) => {
  try {
    const { statut } = req.body;
    const allowed =["Reçu", "En cours", "Retenu", "Refusé"];
    if (!allowed.includes(statut))
      return res.status(400).json({ error: `statut doit être parmi : ${allowed.join(", ")}` });

    const candidat = await Candidat.findByIdAndUpdate(req.params.id, { statut }, { new: true });
    if (!candidat) return res.status(404).json({ error: "Candidat non trouvé" });
    res.json({ _id: candidat._id, statut: candidat.statut });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/candidats/:id
router.delete("/candidats/:id", async (req, res) => {
  try {
    const candidat = await Candidat.findByIdAndDelete(req.params.id);
    if (!candidat) return res.status(404).json({ error: "Candidat non trouvé" });
    res.json({ message: "Candidat supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/workspaces/:wsId/candidats  — purger tous les candidats du workspace
router.delete("/workspaces/:wsId/candidats", async (req, res) => {
  try {
    const result = await Candidat.deleteMany({ workspace: req.params.wsId });
    res.json({ deleted: result.deletedCount, message: "Tous les candidats supprimés" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/workspaces/:wsId/candidats/batch/:batchId
router.delete("/workspaces/:wsId/candidats/batch/:batchId", async (req, res) => {
  try {
    const result = await Candidat.deleteMany({
      workspace: req.params.wsId,
      importBatch: req.params.batchId,
    });
    await ExcelImport.findOneAndDelete({ batchId: req.params.batchId });
    res.json({ deleted: result.deletedCount, message: "Batch supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workspaces/:wsId/imports
router.get("/workspaces/:wsId/imports", async (req, res) => {
  try {
    const imports = await ExcelImport.find({ workspace: req.params.wsId })
      .sort({ createdAt: -1 })
      .select("-rawRows");
    res.json(imports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workspaces/:wsId/imports/:batchId
router.get("/workspaces/:wsId/imports/:batchId", async (req, res) => {
  try {
    const imp = await ExcelImport.findOne({
      workspace: req.params.wsId,
      batchId: req.params.batchId,
    });
    if (!imp) return res.status(404).json({ error: "Import non trouvé" });
    res.json(imp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workspaces/:wsId/candidats/themes
router.get("/workspaces/:wsId/candidats/themes", async (req, res) => {
  try {
    const agg = await Candidat.aggregate([
      { $match: { workspace: require("mongoose").Types.ObjectId.createFromHexString(req.params.wsId) } },
      { $group: {
          _id: { theme: "$theme", groupe: "$groupe" },
          count:    { $sum: 1 },
          dateDebut: { $first: "$dateDebut" },
          dateFin:   { $first: "$dateFin" },
          jours:     { $first: "$jours" },
      }},
      { $sort: { "_id.theme": 1, "_id.groupe": 1 } },
    ]);
    res.json(agg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;