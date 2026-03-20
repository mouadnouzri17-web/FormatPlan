const express = require("express");
const router  = express.Router();
const Document = require("../models/Document");

// ── GET /api/workspaces/:wsId/documents
router.get("/workspaces/:wsId/documents", async (req, res) => {
  try {
    const { type, statut, search } = req.query;
    const filter = { workspace: req.params.wsId };
    if (type)   filter.type   = type;
    if (statut) filter.statut = statut;
    if (search) filter.nom = new RegExp(search, "i");

    const documents = await Document.find(filter).sort({ createdAt: -1 });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces/:wsId/documents
router.post("/workspaces/:wsId/documents", async (req, res) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "nom est requis" });

    const doc = await Document.create({ workspace: req.params.wsId, ...req.body });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/documents/:id
router.put("/documents/:id", async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: "Document non trouvé" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/documents/:id
router.delete("/documents/:id", async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document non trouvé" });
    res.json({ message: "Document supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
