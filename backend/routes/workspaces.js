const express = require("express");
const router  = express.Router();
const Workspace = require("../models/Workspace");
const Task      = require("../models/Task");
const Candidat  = require("../models/Candidat");
const Document  = require("../models/Document");

// ── GET /api/workspaces  — liste tous les workspaces
router.get("/", async (req, res) => {
  try {
    const workspaces = await Workspace.find().sort({ createdAt: -1 });
    res.json(workspaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces  — créer un workspace
router.post("/", async (req, res) => {
  try {
    const { company, startDate, endDate } = req.body;
    if (!company || !startDate || !endDate)
      return res.status(400).json({ error: "company, startDate et endDate sont requis" });

    const ws = await Workspace.create({ company, startDate, endDate });
    res.status(201).json(ws);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workspaces/:id  — détail d'un workspace avec stats
router.get("/:id", async (req, res) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ error: "Workspace non trouvé" });

    // Stats agrégées
    const [taskCount, candidatCount, docCount] = await Promise.all([
      Task.countDocuments({ workspace: ws._id }),
      Candidat.countDocuments({ workspace: ws._id }),
      Document.countDocuments({ workspace: ws._id }),
    ]);

    res.json({ ...ws.toObject(), stats: { tasks: taskCount, candidats: candidatCount, documents: docCount } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/workspaces/:id  — modifier un workspace
router.put("/:id", async (req, res) => {
  try {
    const ws = await Workspace.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!ws) return res.status(404).json({ error: "Workspace non trouvé" });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/workspaces/:id  — supprimer workspace + toutes ses données
router.delete("/:id", async (req, res) => {
  try {
    const ws = await Workspace.findByIdAndDelete(req.params.id);
    if (!ws) return res.status(404).json({ error: "Workspace non trouvé" });

    // Cascade delete
    await Promise.all([
      Task.deleteMany({ workspace: ws._id }),
      Candidat.deleteMany({ workspace: ws._id }),
      Document.deleteMany({ workspace: ws._id }),
    ]);

    res.json({ message: "Workspace et toutes ses données supprimés" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
