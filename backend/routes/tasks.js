const express = require("express");
const router  = express.Router();
const Task = require("../models/Task");

// ── GET /api/workspaces/:wsId/tasks
router.get("/workspaces/:wsId/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({ workspace: req.params.wsId }).sort({ order: 1, createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces/:wsId/tasks
router.post("/workspaces/:wsId/tasks", async (req, res) => {
  try {
    const { name, group, start, end, order } = req.body;
    if (!name || !start || !end)
      return res.status(400).json({ error: "name, start et end sont requis" });

    const task = await Task.create({
      workspace: req.params.wsId,
      name, group: group || "Général", start, end,
      order: order ?? 0,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/workspaces/:wsId/tasks/bulk  — insertion groupée (import)
router.post("/workspaces/:wsId/tasks/bulk", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0)
      return res.status(400).json({ error: "tasks[] est requis et ne doit pas être vide" });

    const docs = tasks.map((t, i) => ({
      workspace: req.params.wsId,
      name:  t.name,
      group: t.group || "Général",
      start: t.start,
      end:   t.end,
      order: t.order ?? i,
    }));

    const inserted = await Task.insertMany(docs, { ordered: false });
    res.status(201).json({ inserted: inserted.length, tasks: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/tasks/:id
router.put("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ error: "Tâche non trouvée" });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/tasks/:id/dates  — mise à jour rapide des dates (drag & drop Gantt)
router.patch("/tasks/:id/dates", async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end) return res.status(400).json({ error: "start et end requis" });

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { start, end },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: "Tâche non trouvée" });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Tâche non trouvée" });
    res.json({ message: "Tâche supprimée" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/workspaces/:wsId/tasks  — vider toutes les tâches d'un workspace
router.delete("/workspaces/:wsId/tasks", async (req, res) => {
  try {
    const result = await Task.deleteMany({ workspace: req.params.wsId });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
