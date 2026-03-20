// ============================================================
// PlanAdmin Backend v2.0 — Fichier unique consolidé
// Node.js + Express + MongoDB (Mongoose)
//
// Installation :
//   npm install express mongoose cors dotenv uuid
//   node server.js
//
// Variables d'environnement (.env) :
//   PORT=5000
//   MONGO_URI=mongodb://localhost:27017/planadmin
// ============================================================

require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");

// ─────────────────────────────────────────────────────────────
// 1. CONNEXION MONGODB
// ─────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/planadmin")
  .then(() => console.log("✅  MongoDB connecté"))
  .catch((err) => { console.error("❌  MongoDB erreur :", err.message); process.exit(1); });

// ─────────────────────────────────────────────────────────────
// 2. MODÈLES MONGOOSE
// ─────────────────────────────────────────────────────────────

// ── Workspace ─────────────────────────────────────────────────
const WorkspaceSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  description:  { type: String, default: "" },
  startDate:    { type: String, default: "" },   // "YYYY-MM-DD"
  endDate:      { type: String, default: "" },
  annee:        { type: Number, default: () => new Date().getFullYear() },
  site:         { type: String, default: "" },
  budget:       { type: Number, default: 0 },
  couleur:      { type: String, default: "#0f7ddb" },
  archived:     { type: Boolean, default: false },
  workingDays:  { type: [Number], default: [1, 2, 3, 4, 5] },
  skipHolidays: { type: Boolean, default: true },
  vacances:     { type: [String], default: [] },
}, { timestamps: true });

const Workspace = mongoose.model("Workspace", WorkspaceSchema);

// ── Formation (Base 2) ────────────────────────────────────────
const FormationSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  intitule:     { type: String, required: true, trim: true, index: true },
  domaine:      { type: String, default: "" },
  objectif:     { type: String, default: "" },
  contenu:      { type: String, default: "" },
  duree:        { type: String, default: "" },
  niveau:       { type: String, default: "" },
  publicCible:  { type: String, default: "" },
  prerequis:    { type: String, default: "" },
  extraData:    { type: Map, of: String, default: {} },
  batchId:      { type: String, default: "" },
  fileName:     { type: String, default: "" },
}, { timestamps: true });

FormationSchema.index({ workspaceId: 1, intitule: 1 }, { unique: true });
const Formation = mongoose.model("Formation", FormationSchema);

// ── Cabinet (Base 3) ──────────────────────────────────────────
const CabinetSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  intitule:     { type: String, required: true, trim: true, index: true },
  cabinet:      { type: String, required: true, trim: true },
  cnss:         { type: String, default: "" },
  lieu:         { type: String, default: "" },
  cout:         { type: String, default: "" },
  contact:      { type: String, default: "" },
  formateur:    { type: String, default: "" },
  extraData:    { type: Map, of: String, default: {} },
  batchId:      { type: String, default: "" },
  fileName:     { type: String, default: "" },
}, { timestamps: true });

CabinetSchema.index({ workspaceId: 1, intitule: 1 }, { unique: true });
const Cabinet = mongoose.model("Cabinet", CabinetSchema);

// ── Candidat (Base 1 + enrichi) ───────────────────────────────
const CandidatSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  // Identité
  nom:          { type: String, required: true, trim: true },
  prenom:       { type: String, default: "", trim: true },
  matricule:    { type: String, default: "", trim: true },
  poste:        { type: String, default: "" },
  departement:  { type: String, default: "" },
  // Formation
  theme:        { type: String, required: true, trim: true, index: true },
  heures:       { type: Number, default: 0 },
  jours:        { type: Number, default: 0 },
  // Groupe & planification
  groupe:       { type: Number, default: 1 },
  statut:       { type: String, enum: ["Reçu", "Convoqué", "Présent", "Absent", "Annulé"], default: "Reçu" },
  dateDebut:    { type: String, default: "" },
  dateFin:      { type: String, default: "" },
  halfDay:      { type: Boolean, default: false },
  slot:         { type: String, default: null },
  // Enrichissement Base 2
  domaine:      { type: String, default: "" },
  objectif:     { type: String, default: "" },
  contenu:      { type: String, default: "" },
  niveau:       { type: String, default: "" },
  publicCible:  { type: String, default: "" },
  // Enrichissement Base 3
  cabinet:      { type: String, default: "" },
  cnss:         { type: String, default: "" },
  lieu:         { type: String, default: "" },
  cout:         { type: String, default: "" },
  formateur:    { type: String, default: "" },
  contact:      { type: String, default: "" },
  // Extra
  extraData:    { type: Map, of: String, default: {} },
  batchId:      { type: String, default: "", index: true },
  fileName:     { type: String, default: "" },
  importedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

CandidatSchema.index({ workspaceId: 1, theme: 1 });
CandidatSchema.index({ workspaceId: 1, groupe: 1 });
CandidatSchema.index({ workspaceId: 1, nom: 1, prenom: 1 });
const Candidat = mongoose.model("Candidat", CandidatSchema);

// ── Task (Gantt) ──────────────────────────────────────────────
const TaskSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  name:         { type: String, required: true },
  group:        { type: String, required: true, index: true },
  groupe:       { type: mongoose.Schema.Types.Mixed, default: 1 },
  start:        { type: String, default: "" },
  end:          { type: String, default: "" },
  halfDay:      { type: Boolean, default: false },
  slot:         { type: String, default: null },
  color:        { type: String, default: "" },
}, { timestamps: true });

const Task = mongoose.model("Task", TaskSchema);

// ── Document ──────────────────────────────────────────────────
const DocumentSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  nom:          { type: String, required: true },
  type:         { type: String, default: "Autre" },
  statut:       { type: String, enum: ["En attente", "En cours", "Complété", "Archivé"], default: "En attente" },
  dateDoc:      { type: String, default: "" },
  notes:        { type: String, default: "" },
  url:          { type: String, default: "" },
  theme:        { type: String, default: "" },
  groupe:       { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

const Document = mongoose.model("Document", DocumentSchema);

// ─────────────────────────────────────────────────────────────
// 3. APP EXPRESS
// ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: "*", methods: ["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─────────────────────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────────────────────
const normIntitule = (s) => (s || "").trim().toLowerCase();

/** Pré-charge Formation et Cabinet par workspace et retourne les indexes */
async function loadReferentiels(wsId) {
  const [formations, cabinets] = await Promise.all([
    Formation.find({ workspaceId: wsId }).lean(),
    Cabinet.find({ workspaceId: wsId }).lean(),
  ]);
  const formIdx = {};
  formations.forEach((f) => { formIdx[normIntitule(f.intitule)] = f; });
  const cabIdx = {};
  cabinets.forEach((c) => { cabIdx[normIntitule(c.intitule)] = c; });
  return { formIdx, cabIdx };
}

/** Enrichit les champs d'un candidat depuis les référentiels */
function applyEnrichissement(candidat, formIdx, cabIdx) {
  const key = normIntitule(candidat.theme);
  const f = formIdx[key] || {};
  const b = cabIdx[key]  || {};
  return {
    ...candidat,
    domaine:     candidat.domaine     || f.domaine     || "",
    objectif:    candidat.objectif    || f.objectif    || "",
    contenu:     candidat.contenu     || f.contenu     || "",
    niveau:      candidat.niveau      || f.niveau      || "",
    publicCible: candidat.publicCible || f.publicCible || "",
    cabinet:     candidat.cabinet     || b.cabinet     || "",
    cnss:        candidat.cnss        || b.cnss        || "",
    lieu:        candidat.lieu        || b.lieu        || "",
    cout:        candidat.cout        || b.cout        || "",
    formateur:   candidat.formateur   || b.formateur   || "",
    contact:     candidat.contact     || b.contact     || "",
  };
}

/** Middleware erreurs */
const errHandler = (err, req, res, next) => {
  let status = 500, message = err.message || "Erreur serveur";
  if (err.name === "ValidationError") { status = 400; message = Object.values(err.errors).map(e => e.message).join(", "); }
  if (err.code === 11000) { status = 409; message = `Doublon sur le champ "${Object.keys(err.keyValue || {})[0] || "?"}"`; }
  if (err.name === "CastError" && err.kind === "ObjectId") { status = 400; message = "Identifiant invalide"; }
  res.status(status).json({ success: false, message });
};

// ─────────────────────────────────────────────────────────────
// 5. ROUTES — HEALTH
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.0.0", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// 6. ROUTES — WORKSPACES
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces
app.get("/api/workspaces", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.archived === "true")  filter.archived = true;
    if (req.query.archived === "false") filter.archived = false;
    const data = await Workspace.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:id
app.get("/api/workspaces/:id", async (req, res, next) => {
  try {
    const ws = await Workspace.findById(req.params.id);
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    res.json({ success: true, data: ws });
  } catch (e) { next(e); }
});

// POST /api/workspaces
app.post("/api/workspaces", async (req, res, next) => {
  try {
    const ws = await Workspace.create(req.body);
    res.status(201).json({ success: true, data: ws });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:id
app.put("/api/workspaces/:id", async (req, res, next) => {
  try {
    const ws = await Workspace.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    res.json({ success: true, data: ws });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:id — cascade
app.delete("/api/workspaces/:id", async (req, res, next) => {
  try {
    const ws = await Workspace.findByIdAndDelete(req.params.id);
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    const wsId = req.params.id;
    await Promise.all([
      Candidat.deleteMany({ workspaceId: wsId }),
      Task.deleteMany({ workspaceId: wsId }),
      Document.deleteMany({ workspaceId: wsId }),
      Formation.deleteMany({ workspaceId: wsId }),
      Cabinet.deleteMany({ workspaceId: wsId }),
    ]);
    res.json({ success: true, message: "Workspace et toutes ses données supprimés" });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 7. ROUTES — FORMATIONS (Base 2)
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces/:wsId/formations
app.get("/api/workspaces/:wsId/formations", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.search) filter.intitule = { $regex: req.query.search, $options: "i" };
    const data = await Formation.find(filter).sort({ intitule: 1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:wsId/formations/:id
app.get("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    const candidats = await Candidat.find({
      workspaceId: req.params.wsId,
      theme: { $regex: `^${f.intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
    }).select("nom prenom matricule groupe statut dateDebut dateFin");
    res.json({ success: true, data: { ...f.toObject(), candidats } });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/formations
app.post("/api/workspaces/:wsId/formations", async (req, res, next) => {
  try {
    const f = await Formation.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: f });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:wsId/formations/:id
app.put("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true, runValidators: true }
    );
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    // Propager aux candidats concernés
    const esc = f.intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await Candidat.updateMany(
      { workspaceId: req.params.wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
      { domaine: f.domaine, objectif: f.objectif, contenu: f.contenu, niveau: f.niveau, publicCible: f.publicCible }
    );
    res.json({ success: true, data: f });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/formations/:id
app.delete("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    res.json({ success: true, message: "Formation supprimée" });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/formations/import
app.post("/api/workspaces/:wsId/formations/import", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", formations = [] } = req.body;
    const wsId = req.params.wsId;
    if (!formations.length) return res.status(400).json({ success: false, message: "Aucune formation fournie" });

    let upserted = 0;
    const errors = [];

    for (const f of formations) {
      if (!f.intitule?.trim()) continue;
      try {
        const intitule = f.intitule.trim();
        await Formation.findOneAndUpdate(
          { workspaceId: wsId, intitule },
          {
            workspaceId, intitule,
            domaine:     f.domaine     || "",
            objectif:    f.objectif    || "",
            contenu:     f.contenu     || "",
            duree:       f.duree       || "",
            niveau:      f.niveau      || "",
            publicCible: f.publicCible || f.public || "",
            prerequis:   f.prerequis   || "",
            extraData:   f.extraData   || {},
            batchId, fileName,
          },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
        // Propager aux candidats existants
        const esc = intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await Candidat.updateMany(
          { workspaceId: wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
          { domaine: f.domaine || "", objectif: f.objectif || "", contenu: f.contenu || "", niveau: f.niveau || "", publicCible: f.publicCible || f.public || "" }
        );
      } catch (e) { errors.push({ intitule: f.intitule, error: e.message }); }
    }

    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} formations importées/mises à jour`,
      ...(errors.length > 0 && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 8. ROUTES — CABINETS (Base 3)
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces/:wsId/cabinets
app.get("/api/workspaces/:wsId/cabinets", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.search) {
      const re = { $regex: req.query.search, $options: "i" };
      filter.$or = [{ intitule: re }, { cabinet: re }, { lieu: re }];
    }
    const data = await Cabinet.find(filter).sort({ cabinet: 1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:wsId/cabinets/:id
app.get("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    const candidats = await Candidat.find({
      workspaceId: req.params.wsId,
      theme: { $regex: `^${c.intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
    }).select("nom prenom matricule groupe statut dateDebut dateFin theme");
    res.json({ success: true, data: { ...c.toObject(), candidats } });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/cabinets
app.post("/api/workspaces/:wsId/cabinets", async (req, res, next) => {
  try {
    const c = await Cabinet.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: c });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:wsId/cabinets/:id
app.put("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    const esc = c.intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await Candidat.updateMany(
      { workspaceId: req.params.wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
      { cabinet: c.cabinet, cnss: c.cnss, lieu: c.lieu, cout: c.cout, formateur: c.formateur, contact: c.contact }
    );
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/cabinets/:id
app.delete("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    res.json({ success: true, message: "Cabinet supprimé" });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/cabinets/import
app.post("/api/workspaces/:wsId/cabinets/import", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", cabinets = [] } = req.body;
    const wsId = req.params.wsId;
    if (!cabinets.length) return res.status(400).json({ success: false, message: "Aucun cabinet fourni" });

    let upserted = 0;
    const errors = [];

    for (const cab of cabinets) {
      if (!cab.intitule?.trim() || !cab.cabinet?.trim()) continue;
      try {
        const intitule = cab.intitule.trim();
        await Cabinet.findOneAndUpdate(
          { workspaceId: wsId, intitule },
          {
            workspaceId, intitule,
            cabinet:   cab.cabinet.trim(),
            cnss:      cab.cnss      || "",
            lieu:      cab.lieu      || "",
            cout:      cab.cout      || "",
            contact:   cab.contact   || "",
            formateur: cab.formateur || "",
            extraData: cab.extraData || {},
            batchId, fileName,
          },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
        const esc = intitule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await Candidat.updateMany(
          { workspaceId: wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
          { cabinet: cab.cabinet || "", cnss: cab.cnss || "", lieu: cab.lieu || "", cout: cab.cout || "", formateur: cab.formateur || "", contact: cab.contact || "" }
        );
      } catch (e) { errors.push({ intitule: cab.intitule, error: e.message }); }
    }

    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} cabinets importés/mis à jour`,
      ...(errors.length > 0 && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 9. ROUTES — CANDIDATS (Base 1)
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces/:wsId/candidats
app.get("/api/workspaces/:wsId/candidats", async (req, res, next) => {
  try {
    const { theme, groupe, statut, search, page = 1, limit = 1000 } = req.query;
    const filter = { workspaceId: req.params.wsId };
    if (theme)  filter.theme  = { $regex: theme, $options: "i" };
    if (groupe) filter.groupe = Number(groupe);
    if (statut) filter.statut = statut;
    if (search) {
      const re = { $regex: search, $options: "i" };
      filter.$or = [{ nom: re }, { prenom: re }, { matricule: re }, { theme: re }];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      Candidat.find(filter).sort({ theme: 1, groupe: 1, nom: 1 }).skip(skip).limit(Number(limit)),
      Candidat.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:wsId/candidats/stats/summary
app.get("/api/workspaces/:wsId/candidats/stats/summary", async (req, res, next) => {
  try {
    const wsOid = new mongoose.Types.ObjectId(req.params.wsId);
    const [total, byStatut, byTheme, withCabinet] = await Promise.all([
      Candidat.countDocuments({ workspaceId: req.params.wsId }),
      Candidat.aggregate([
        { $match: { workspaceId: wsOid } },
        { $group: { _id: "$statut", count: { $sum: 1 } } },
      ]),
      Candidat.aggregate([
        { $match: { workspaceId: wsOid } },
        { $group: { _id: "$theme", count: { $sum: 1 }, groupes: { $addToSet: "$groupe" } } },
        { $sort: { count: -1 } },
      ]),
      Candidat.countDocuments({ workspaceId: req.params.wsId, cabinet: { $ne: "" } }),
    ]);
    res.json({
      success: true,
      data: {
        total,
        byStatut: Object.fromEntries(byStatut.map((s) => [s._id, s.count])),
        themes: byTheme.length,
        groupes: byTheme.reduce((s, t) => s + t.groupes.length, 0),
        withCabinet,
      },
    });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:wsId/candidats/:id
app.get("/api/workspaces/:wsId/candidats/:id", async (req, res, next) => {
  try {
    const c = await Candidat.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Candidat introuvable" });
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/candidats
app.post("/api/workspaces/:wsId/candidats", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { formIdx, cabIdx } = await loadReferentiels(wsId);
    const enriched = applyEnrichissement({ ...req.body, workspaceId: wsId }, formIdx, cabIdx);
    const c = await Candidat.create(enriched);
    res.status(201).json({ success: true, data: c });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:wsId/candidats/:id
app.put("/api/workspaces/:wsId/candidats/:id", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { formIdx, cabIdx } = await loadReferentiels(wsId);
    const enriched = applyEnrichissement(req.body, formIdx, cabIdx);
    const c = await Candidat.findOneAndUpdate(
      { _id: req.params.id, workspaceId: wsId },
      enriched, { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ success: false, message: "Candidat introuvable" });
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/candidats/:id
app.delete("/api/workspaces/:wsId/candidats/:id", async (req, res, next) => {
  try {
    const c = await Candidat.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Candidat introuvable" });
    res.json({ success: true, message: "Candidat supprimé" });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/candidats  (vider tout)
app.delete("/api/workspaces/:wsId/candidats", async (req, res, next) => {
  try {
    const result = await Candidat.deleteMany({ workspaceId: req.params.wsId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/candidats/import  ← IMPORT PRINCIPAL
app.post("/api/workspaces/:wsId/candidats/import", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", candidats = [] } = req.body;
    const wsId = req.params.wsId;

    if (!candidats.length)
      return res.status(400).json({ success: false, message: "Aucun candidat fourni" });

    // Charger les référentiels une seule fois
    const { formIdx, cabIdx } = await loadReferentiels(wsId);

    const docs = candidats.map((c) => {
      const enriched = applyEnrichissement(c, formIdx, cabIdx);
      return {
        workspaceId: wsId,
        nom:         (enriched.nom     || "").trim(),
        prenom:      (enriched.prenom  || "").trim(),
        matricule:   (enriched.matricule || "").trim(),
        poste:       enriched.poste       || "",
        departement: enriched.departement || "",
        theme:       (enriched.theme   || "").trim(),
        heures:      Number(enriched.heures) || 0,
        jours:       Number(enriched.jours)  || 0,
        groupe:      Number(enriched.groupe) || 1,
        statut:      enriched.statut   || "Reçu",
        dateDebut:   enriched.dateDebut || enriched.start || "",
        dateFin:     enriched.dateFin   || enriched.end   || "",
        halfDay:     enriched.halfDay   || false,
        slot:        enriched.slot      || null,
        // Champs enrichis
        domaine:     enriched.domaine     || "",
        objectif:    enriched.objectif    || "",
        contenu:     enriched.contenu     || "",
        niveau:      enriched.niveau      || "",
        publicCible: enriched.publicCible || "",
        cabinet:     enriched.cabinet     || "",
        cnss:        enriched.cnss        || "",
        lieu:        enriched.lieu        || "",
        cout:        enriched.cout        || "",
        formateur:   enriched.formateur   || "",
        contact:     enriched.contact     || "",
        extraData:   enriched.extraData   || {},
        batchId, fileName,
        importedAt:  new Date(),
      };
    });

    let inserted = 0;
    let errCount = 0;
    // Insérer par lots de 500
    const BATCH = 500;
    for (let i = 0; i < docs.length; i += BATCH) {
      try {
        const chunk = docs.slice(i, i + BATCH);
        const result = await Candidat.insertMany(chunk, { ordered: false });
        inserted += result.length;
      } catch (e) {
        if (e.insertedDocs) inserted += e.insertedDocs.length;
        if (e.writeErrors)  errCount  += e.writeErrors.length;
        else if (!e.insertedDocs) errCount++;
      }
    }

    res.status(201).json({
      success: true, inserted, errors: errCount,
      message: `${inserted} candidats importés${errCount > 0 ? `, ${errCount} erreurs` : ""}`,
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 10. ROUTES — TASKS (Gantt)
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces/:wsId/tasks
app.get("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.group) filter.group = { $regex: req.query.group, $options: "i" };
    const data = await Task.find(filter).sort({ start: 1, group: 1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/tasks
app.post("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const t = await Task.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: t });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/tasks/bulk
app.post("/api/workspaces/:wsId/tasks/bulk", async (req, res, next) => {
  try {
    const { tasks = [] } = req.body;
    const wsId = req.params.wsId;
    if (!tasks.length) return res.json({ success: true, inserted: 0 });
    // Supprimer les anciennes tâches des mêmes groupes thématiques
    const groups = [...new Set(tasks.map((t) => t.group))];
    await Task.deleteMany({ workspaceId: wsId, group: { $in: groups } });
    const docs = tasks.map((t) => ({ ...t, workspaceId: wsId }));
    const inserted = await Task.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, inserted: inserted.length });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:wsId/tasks/:id
app.put("/api/workspaces/:wsId/tasks/:id", async (req, res, next) => {
  try {
    const t = await Task.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true, runValidators: true }
    );
    if (!t) return res.status(404).json({ success: false, message: "Tâche introuvable" });
    res.json({ success: true, data: t });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/tasks/:id
app.delete("/api/workspaces/:wsId/tasks/:id", async (req, res, next) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/tasks  (vider tout)
app.delete("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const result = await Task.deleteMany({ workspaceId: req.params.wsId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 11. ROUTES — DOCUMENTS
// ─────────────────────────────────────────────────────────────

// GET /api/workspaces/:wsId/documents
app.get("/api/workspaces/:wsId/documents", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.statut) filter.statut = req.query.statut;
    const data = await Document.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET /api/workspaces/:wsId/documents/:id
app.get("/api/workspaces/:wsId/documents/:id", async (req, res, next) => {
  try {
    const d = await Document.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!d) return res.status(404).json({ success: false, message: "Document introuvable" });
    res.json({ success: true, data: d });
  } catch (e) { next(e); }
});

// POST /api/workspaces/:wsId/documents
app.post("/api/workspaces/:wsId/documents", async (req, res, next) => {
  try {
    const d = await Document.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: d });
  } catch (e) { next(e); }
});

// PUT /api/workspaces/:wsId/documents/:id
app.put("/api/workspaces/:wsId/documents/:id", async (req, res, next) => {
  try {
    const d = await Document.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true }
    );
    if (!d) return res.status(404).json({ success: false, message: "Document introuvable" });
    res.json({ success: true, data: d });
  } catch (e) { next(e); }
});

// DELETE /api/workspaces/:wsId/documents/:id
app.delete("/api/workspaces/:wsId/documents/:id", async (req, res, next) => {
  try {
    await Document.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 12. ROUTES — MULTI-IMPORT (3 bases en une seule transaction)
// ─────────────────────────────────────────────────────────────
//
// Flux complet depuis MultiBaseImportWizard :
//
//  POST /multi-import/init        → vide candidats + tasks existants
//  POST /multi-import/formations  → upsert Base 2
//  POST /multi-import/cabinets    → upsert Base 3
//  POST /multi-import/candidats   → import Base 1 + enrichissement auto
//  POST /multi-import/tasks       → bulk tasks Gantt
//  POST /multi-import/documents   → listes d'émargement
//  GET  /multi-import/status/:batchId → statut d'un import
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/workspaces/:wsId/multi-import/init
 * Initialise l'import : vide les candidats et tâches du workspace.
 * Appeler en premier depuis confirm() du wizard.
 *
 * Body : { batchId: string, clearFormations?: bool, clearCabinets?: bool }
 */
app.post("/api/workspaces/:wsId/multi-import/init", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { batchId = "", clearFormations = false, clearCabinets = false } = req.body;

    // Vérifier que le workspace existe
    const ws = await Workspace.findById(wsId);
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });

    const ops = [
      Candidat.deleteMany({ workspaceId: wsId }),
      Task.deleteMany({ workspaceId: wsId }),
      Document.deleteMany({ workspaceId: wsId }),
    ];
    if (clearFormations) ops.push(Formation.deleteMany({ workspaceId: wsId }));
    if (clearCabinets)   ops.push(Cabinet.deleteMany({ workspaceId: wsId }));

    const [cRes, tRes, dRes] = await Promise.all(ops);

    res.json({
      success: true,
      batchId,
      cleared: {
        candidats:  cRes.deletedCount,
        tasks:      tRes.deletedCount,
        documents:  dRes.deletedCount,
        formations: clearFormations ? (ops[3] ? (await ops[3]).deletedCount : 0) : "conservées",
        cabinets:   clearCabinets   ? (ops[4] ? (await ops[4]).deletedCount : 0) : "conservés",
      },
      message: "Workspace prêt pour l'import",
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/workspaces/:wsId/multi-import/formations
 * Import Base 2 — formations (upsert par intitulé).
 *
 * Body : { batchId, fileName, formations: [{intitule, domaine, objectif, ...}] }
 */
app.post("/api/workspaces/:wsId/multi-import/formations", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", formations = [] } = req.body;
    const wsId = req.params.wsId;

    if (!formations.length)
      return res.json({ success: true, upserted: 0, message: "Aucune formation — étape ignorée" });

    let upserted = 0;
    const errors = [];

    for (const f of formations) {
      if (!f.intitule?.trim()) continue;
      try {
        const intitule = f.intitule.trim();
        await Formation.findOneAndUpdate(
          { workspaceId: wsId, intitule },
          {
            workspaceId, intitule,
            domaine:     f.domaine     || "",
            objectif:    f.objectif    || "",
            contenu:     f.contenu     || "",
            duree:       f.duree       || "",
            niveau:      f.niveau      || "",
            publicCible: f.publicCible || f.public || "",
            prerequis:   f.prerequis   || "",
            extraData:   f.extraData   || {},
            batchId, fileName,
          },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
      } catch (e) {
        errors.push({ intitule: f.intitule, error: e.message });
      }
    }

    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} formations importées`,
      ...(errors.length && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/workspaces/:wsId/multi-import/cabinets
 * Import Base 3 — cabinets (upsert par intitulé).
 *
 * Body : { batchId, fileName, cabinets: [{intitule, cabinet, cnss, lieu, ...}] }
 */
app.post("/api/workspaces/:wsId/multi-import/cabinets", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", cabinets = [] } = req.body;
    const wsId = req.params.wsId;

    if (!cabinets.length)
      return res.json({ success: true, upserted: 0, message: "Aucun cabinet — étape ignorée" });

    let upserted = 0;
    const errors = [];

    for (const cab of cabinets) {
      if (!cab.intitule?.trim()) continue;
      try {
        const intitule = cab.intitule.trim();
        await Cabinet.findOneAndUpdate(
          { workspaceId: wsId, intitule },
          {
            workspaceId, intitule,
            cabinet:   (cab.cabinet || intitule).trim(),
            cnss:      cab.cnss      || "",
            lieu:      cab.lieu      || "",
            cout:      cab.cout      || "",
            contact:   cab.contact   || "",
            formateur: cab.formateur || "",
            extraData: cab.extraData || {},
            batchId, fileName,
          },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
      } catch (e) {
        errors.push({ intitule: cab.intitule, error: e.message });
      }
    }

    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} cabinets importés`,
      ...(errors.length && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/workspaces/:wsId/multi-import/candidats
 * Import Base 1 — candidats avec enrichissement automatique depuis
 * les formations et cabinets déjà importés dans ce workspace.
 *
 * Body : { batchId, fileName, candidats: [...] }
 */
app.post("/api/workspaces/:wsId/multi-import/candidats", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", candidats = [] } = req.body;
    const wsId = req.params.wsId;

    if (!candidats.length)
      return res.status(400).json({ success: false, message: "Aucun candidat fourni" });

    // Charger référentiels une seule fois
    const { formIdx, cabIdx } = await loadReferentiels(wsId);

    const BATCH = 500;
    let inserted = 0, errCount = 0;

    for (let i = 0; i < candidats.length; i += BATCH) {
      const chunk = candidats.slice(i, i + BATCH).map((c) => {
        const enriched = applyEnrichissement(c, formIdx, cabIdx);
        return {
          workspaceId: wsId,
          nom:         (enriched.nom      || "").trim(),
          prenom:      (enriched.prenom   || "").trim(),
          matricule:   (enriched.matricule|| "").trim(),
          poste:       enriched.poste        || "",
          departement: enriched.departement  || "",
          theme:       (enriched.theme    || "").trim(),
          heures:      Number(enriched.heures)  || 0,
          jours:       Number(enriched.jours)   || 0,
          groupe:      Number(enriched.groupe)  || 1,
          statut:      enriched.statut    || "Reçu",
          dateDebut:   enriched.dateDebut || enriched.start || "",
          dateFin:     enriched.dateFin   || enriched.end   || "",
          halfDay:     enriched.halfDay   || false,
          slot:        enriched.slot      || null,
          domaine:     enriched.domaine     || "",
          objectif:    enriched.objectif    || "",
          contenu:     enriched.contenu     || "",
          niveau:      enriched.niveau      || "",
          publicCible: enriched.publicCible || "",
          cabinet:     enriched.cabinet     || "",
          cnss:        enriched.cnss        || "",
          lieu:        enriched.lieu        || "",
          cout:        enriched.cout        || "",
          formateur:   enriched.formateur   || "",
          contact:     enriched.contact     || "",
          extraData:   enriched.extraData   || {},
          batchId, fileName,
          importedAt: new Date(),
        };
      });

      try {
        const result = await Candidat.insertMany(chunk, { ordered: false });
        inserted += result.length;
      } catch (e) {
        if (e.insertedDocs) inserted += e.insertedDocs.length;
        if (e.writeErrors)  errCount += e.writeErrors.length;
        else if (!e.insertedDocs) errCount++;
      }
    }

    res.status(201).json({
      success: true, inserted, errors: errCount,
      message: `${inserted} candidats importés${errCount ? `, ${errCount} erreurs ignorées` : ""}`,
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/workspaces/:wsId/multi-import/tasks
 * Sauvegarde les tâches Gantt générées.
 * Supprime les anciennes tâches des mêmes groupes thématiques avant insertion.
 *
 * Body : { tasks: [{name, group, groupe, start, end, halfDay, slot}] }
 */
app.post("/api/workspaces/:wsId/multi-import/tasks", async (req, res, next) => {
  try {
    const { tasks = [] } = req.body;
    const wsId = req.params.wsId;

    if (!tasks.length) return res.json({ success: true, inserted: 0, message: "Aucune tâche" });

    const groups = [...new Set(tasks.map((t) => t.group).filter(Boolean))];
    await Task.deleteMany({ workspaceId: wsId, group: { $in: groups } });

    const docs = tasks.map((t) => ({ ...t, workspaceId: wsId }));
    const inserted = await Task.insertMany(docs, { ordered: false });

    res.status(201).json({
      success: true, inserted: inserted.length,
      message: `${inserted.length} tâches Gantt sauvegardées`,
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/workspaces/:wsId/multi-import/documents
 * Crée les listes d'émargement automatiques pour chaque groupe.
 *
 * Body : { documents: [{nom, type, statut, dateDoc, notes, theme, groupe}] }
 */
app.post("/api/workspaces/:wsId/multi-import/documents", async (req, res, next) => {
  try {
    const { documents = [] } = req.body;
    const wsId = req.params.wsId;

    if (!documents.length) return res.json({ success: true, inserted: 0, message: "Aucun document" });

    const docs = documents.map((d) => ({ ...d, workspaceId: wsId }));
    const inserted = await Document.insertMany(docs, { ordered: false });

    res.status(201).json({
      success: true, inserted: inserted.length,
      message: `${inserted.length} documents créés`,
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/workspaces/:wsId/multi-import/status/:batchId
 * Retourne le résumé d'un import par son batchId.
 */
app.get("/api/workspaces/:wsId/multi-import/status/:batchId", async (req, res, next) => {
  try {
    const { wsId, batchId } = req.params;
    const [candidats, formations, cabinets, tasks, documents] = await Promise.all([
      Candidat.countDocuments({ workspaceId: wsId, batchId }),
      Formation.countDocuments({ workspaceId: wsId, batchId }),
      Cabinet.countDocuments({ workspaceId: wsId, batchId }),
      Task.countDocuments({ workspaceId: wsId }),
      Document.countDocuments({ workspaceId: wsId }),
    ]);
    res.json({
      success: true,
      batchId,
      data: { candidats, formations, cabinets, tasks, documents },
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 13. 404 + GESTION ERREURS GLOBALE
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} introuvable` });
});
app.use(errHandler);

// ─────────────────────────────────────────────────────────────
// 13. DÉMARRAGE
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  PlanAdmin Backend v2.0 — http://localhost:${PORT}/api`);
  console.log(`\n📋  Endpoints disponibles :`);
  console.log(`   GET  POST            /api/workspaces`);
  console.log(`   GET  PUT  DELETE     /api/workspaces/:id`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST  DELETE    /api/workspaces/:wsId/candidats`);
  console.log(`   GET  PUT   DELETE    /api/workspaces/:wsId/candidats/:id`);
  console.log(`   POST                 /api/workspaces/:wsId/candidats/import`);
  console.log(`   GET                  /api/workspaces/:wsId/candidats/stats/summary`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST            /api/workspaces/:wsId/formations`);
  console.log(`   GET  PUT   DELETE    /api/workspaces/:wsId/formations/:id`);
  console.log(`   POST                 /api/workspaces/:wsId/formations/import`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST            /api/workspaces/:wsId/cabinets`);
  console.log(`   GET  PUT   DELETE    /api/workspaces/:wsId/cabinets/:id`);
  console.log(`   POST                 /api/workspaces/:wsId/cabinets/import`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST  DELETE    /api/workspaces/:wsId/tasks`);
  console.log(`   POST                 /api/workspaces/:wsId/tasks/bulk`);
  console.log(`   PUT  DELETE          /api/workspaces/:wsId/tasks/:id`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/init`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/formations`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/cabinets`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/candidats`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/tasks`);
  console.log(`   POST  /api/workspaces/:wsId/multi-import/documents`);
  console.log(`   GET   /api/workspaces/:wsId/multi-import/status/:batchId`);
});

module.exports = app;