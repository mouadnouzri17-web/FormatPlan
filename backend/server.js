// ============================================================
// PlanAdmin Backend v2.2 — Fichier unique consolidé
// Node.js + Express + MongoDB (Mongoose)
// ============================================================

require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_key_123!";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";


// ─────────────────────────────────────────────────────────────
// 2. MODÈLES MONGOOSE
// ─────────────────────────────────────────────────────────────

// ── User (Auth) ───────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
  displayName: { type: String, default: "" },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  permissions: {
    canImportExcel: { type: Boolean, default: true },
    canViewDocs: { type: Boolean, default: true },
    allowedDocTypes: { type: [String], default: [] } // <── AJOUTEZ CETTE LIGNE
  }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);




async function initAdmin() {
  const adminExists = await User.findOne({ username: "admin" });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("Admin123!", 10);
    await User.create({
      username: "admin",
      password: hashedPassword,
      role: "admin",
      displayName: "Administrateur"
    });
    console.log("✅ Compte admin créé : admin / Admin123!");
  }
}

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/planadmin")
  .then(() => {
    console.log("✅  MongoDB connecté");
    initAdmin();
  })
  .catch((err) => { console.error("❌  MongoDB erreur :", err.message); process.exit(1); });

// ── Workspace ─────────────────────────────────────────────────
const VacanceSchema = new mongoose.Schema({
  id:    { type: String, default: () => Math.random().toString(36).slice(2, 9) },
  label: { type: String, default: "" },
  start: { type: String, default: "" },
  end:   { type: String, default: "" },
}, { _id: false });

const WorkspaceSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  owner:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  description:  { type: String, default: "" },
  startDate:    { type: String, default: "" },
  endDate:      { type: String, default: "" },
  annee:        { type: Number, default: () => new Date().getFullYear() },
  site:         { type: String, default: "" },
  budget:       { type: Number, default: 0 },
  couleur:      { type: String, default: "#0f7ddb" },
  archived:     { type: Boolean, default: false },
  workingDays:  { type: [Number], default: [1, 2, 3, 4, 5] },
  skipHolidays: { type: Boolean, default: true },
  vacances:     { type: [VacanceSchema], default: [] },
  hasExportBase: { type: Boolean, default: false }, // <── AJOUTER CECI
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

// ── Candidat ──────────────────────────────────────────────────
const CandidatSchema = new mongoose.Schema({
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  nom:          { type: String, required: true, trim: true },
  prenom:       { type: String, default: "", trim: true },
  matricule:    { type: String, default: "", trim: true },
  poste:        { type: String, default: "" },
  departement:  { type: String, default: "" },
  theme:        { type: String, required: true, trim: true, index: true },
  heures:       { type: Number, default: 0 },
  jours:        { type: Number, default: 0 },
  groupe:       { type: Number, default: 1 },
  statut:       { type: String, enum: ["Reçu", "Convoqué", "Présent", "Absent", "Annulé"], default: "Reçu" },
  dateDebut:    { type: String, default: "" },
  dateFin:      { type: String, default: "" },
  halfDay:      { type: Boolean, default: false },
  slot:         { type: String, default: null },
  domaine:      { type: String, default: "" },
  objectif:     { type: String, default: "" },
  contenu:      { type: String, default: "" },
  niveau:       { type: String, default: "" },
  publicCible:  { type: String, default: "" },
  cabinet:      { type: String, default: "" },
  cnss:         { type: String, default: "" },
  lieu:         { type: String, default: "" },
  nbrEspace:    { type: Number, default: 1 },
  cout:         { type: String, default: "" },
  formateur:    { type: String, default: "" },
  contact:      { type: String, default: "" },
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

// ── GanttSnapshot ─────────────────────────────────────────────
// Une seule entrée par workspace.
// Stocke uniquement les champs nécessaires au Gantt + détection de conflits.
// Taille typique : 500 candidats × ~200 o = ~100 Ko (limite MongoDB = 16 Mo).
const GanttTaskSchema = new mongoose.Schema({
  id:      { type: String, required: true },
  group:   { type: String, default: "" },
  groupe:  { type: String, default: "1" },
  start:   { type: String, default: "" },
  end:     { type: String, default: "" },
  halfDay: { type: Boolean, default: false },
  slot:    { type: String, default: null },
}, { _id: false });

const GanttCandidatSchema = new mongoose.Schema({
  nom:       { type: String, default: "" },
  prenom:    { type: String, default: "" },
  matricule: { type: String, default: "" },
  theme:     { type: String, default: "" },
  groupe:    { type: String, default: "1" },
  dateDebut: { type: String, default: "" },
  dateFin:   { type: String, default: "" },
  lieu:      { type: String, default: "" },
  cabinet:   { type: String, default: "" },
  nbrEspace: { type: Number, default: 1 },
  statut:    { type: String, default: "Reçu" },
}, { _id: false });

const GanttSnapshotSchema = new mongoose.Schema({
  workspaceId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Workspace",
    required: true,
    unique:   true,
    index:    true,
  },
  tasks:     { type: [GanttTaskSchema],     default: [] },
  candidats: { type: [GanttCandidatSchema], default: [] },
  savedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

const GanttSnapshot = mongoose.model("GanttSnapshot", GanttSnapshotSchema);

// ── ExportBase (Stockage de la base fusionnée et configuration export) ──
const ExportBaseSchema = new mongoose.Schema({
  workspaceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Workspace", 
    required: true, 
    unique: true, 
    index: true 
  },
  exportedAt:  { type: Date, default: Date.now },
  rows:        { type: [mongoose.Schema.Types.Mixed], default: [] },
  columnOrder: { type: [String], default: [] }, // Sauvegarde de l'ordre des colonnes
}, { timestamps: true });

const ExportBase = mongoose.model("ExportBase", ExportBaseSchema);

// ─────────────────────────────────────────────────────────────
// 3. APP EXPRESS
// ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'https://sparkling-empathy-production-05b3.up.railway.app', 'https://m2s-formaplan.vercel.app/'],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─────────────────────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────────────────────
const normIntitule = (s) => (s || "").trim().toLowerCase();

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
    nbrEspace:   candidat.nbrEspace   || Number(b.nbrEspace) || 1,
  };
}

// Normalise les tasks pour GanttSnapshot (champs slim uniquement)
function normGanttTask(t) {
  return {
    id:      String(t.id || ""),
    group:   String(t.group  || t.name?.split(" — ")[0] || ""),
    groupe:  String(t.groupe || "1"),
    start:   String(t.start  || ""),
    end:     String(t.end    || ""),
    halfDay: Boolean(t.halfDay),
    slot:    t.slot || null,
  };
}

// Normalise les candidats pour GanttSnapshot (champs conflits uniquement)
function normGanttCandidat(c) {
  return {
    nom:       String(c.nom       || "").trim(),
    prenom:    String(c.prenom    || "").trim(),
    matricule: String(c.matricule || "").trim(),
    theme:     String(c.theme     || "").trim(),
    groupe:    String(c.groupe    || "1"),
    dateDebut: String(c.dateDebut || c.start || ""),
    dateFin:   String(c.dateFin   || c.end   || ""),
    lieu:      String(c.lieu    || c.extraData?.lieu    || "").trim(),
    cabinet:   String(c.cabinet || c.extraData?.cabinet || "").trim(),
    nbrEspace: Number(c.nbrEspace || c.extraData?.nbrEspace || 1),
    statut:    String(c.statut  || "Reçu"),
  };
}

const errHandler = (err, req, res, next) => {
  let status = 500, message = err.message || "Erreur serveur";
  if (err.name === "ValidationError")
    { status = 400; message = Object.values(err.errors).map(e => e.message).join(", "); }
  if (err.code === 11000)
    { status = 409; message = `Doublon sur le champ "${Object.keys(err.keyValue || {})[0] || "?"}"`; }
  if (err.name === "CastError" && err.kind === "ObjectId")
    { status = 400; message = "Identifiant invalide"; }
  res.status(status).json({ success: false, message });
};

// ─────────────────────────────────────────────────────────────
// 5. AUTHENTIFICATION & HEALTH
// ─────────────────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Accès refusé. Token manquant." });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token invalide ou expiré." });
    req.user = user;
    next();
  });
};

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Identifiant et mot de passe requis" });
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role: "user",
      displayName: displayName || username,
    });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, parentId: user.parentId, permissions: user.permissions },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.status(201).json({ token, user: { id: user._id, username: user.username, role: user.role, displayName: user.displayName, parentId: user.parentId, permissions: user.permissions } });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Utilisateur non trouvé" });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Mot de passe incorrect" });
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, parentId: user.parentId, permissions: user.permissions }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token, user: { id: user._id, username: user.username, role: user.role, displayName: user.displayName, parentId: user.parentId, permissions: user.permissions } });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/auth/logout", authenticateToken, (req, res) => {
  res.json({ success: true, message: "Déconnexion réussie" });
});

app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: "Mot de passe mis à jour" });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.put("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const { displayName, password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    if (displayName) user.displayName = displayName.trim();
    if (password) user.password = await bcrypt.hash(password, 10);
    
    await user.save();
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, parentId: user.parentId, permissions: user.permissions }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({ success: true, token, user: { id: user._id, username: user.username, role: user.role, displayName: user.displayName, parentId: user.parentId, permissions: user.permissions } });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/auth/subusers", authenticateToken, async (req, res) => {
  try {
    const subusers = await User.find({ parentId: req.user.id }).select("-password");
    res.json(subusers);
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/auth/subusers", authenticateToken, async (req, res) => {
  if (req.user.parentId) return res.status(403).json({ error: "Accès refusé" });
  try {
    const { username, password, displayName, permissions } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Nom d'utilisateur déjà pris" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ 
      username, 
      password: hashedPassword, 
      displayName, 
      parentId: req.user.id,
      permissions: permissions || { canImportExcel: true, canViewDocs: true }
    });
    const { password: _, ...userWithoutPass } = user.toObject();
    res.status(201).json({ success: true, user: userWithoutPass });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.put("/api/auth/subusers/:id", authenticateToken, async (req, res) => {
  try {
    const { displayName, password, permissions } = req.body;
    const user = await User.findOne({ _id: req.params.id, parentId: req.user.id });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    if (displayName) user.displayName = displayName.trim();
    if (password) user.password = await bcrypt.hash(password, 10);
    if (permissions) user.permissions = { ...user.permissions, ...permissions };
    
    await user.save();
    const { password: _, ...userWithoutPass } = user.toObject();
    res.json({ success: true, user: userWithoutPass });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.delete("/api/auth/subusers/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, parentId: req.user.id });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post("/api/auth/users", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès non autorisé" });
  try {
    const { username, password, role, displayName } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Nom d'utilisateur déjà pris" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, role: role || "user", displayName });
    res.status(201).json({ success: true, user: { id: user._id, username: user.username, role: user.role, displayName: user.displayName } });
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/auth/users", authenticateToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Accès non autorisé" });
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.2.0", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// 6. ROUTES — WORKSPACES
// ─────────────────────────────────────────────────────────────

app.use("/api/workspaces", authenticateToken);
app.use("/api/tasks", authenticateToken);

app.param('wsId', async (req, res, next, wsId) => {
  if (wsId !== "import" && req.user && req.user.role !== "admin") {
    try {
      const ownerId = req.user.parentId || req.user.id;
      const ws = await Workspace.findOne({ _id: wsId, owner: ownerId });
      if (!ws) return res.status(403).json({ success: false, message: "Accès refusé à cet espace de travail" });
    } catch (e) {
      return res.status(400).json({ success: false, message: "ID Workspace invalide" });
    }
  }
  next();
});

app.get("/api/workspaces", async (req, res, next) => {
  try {
    const filter = {};
    if (req.user && req.user.role !== "admin") {
      filter.owner = req.user.parentId || req.user.id;
    }
    if (req.query.archived === "true")  filter.archived = true;
    if (req.query.archived === "false") filter.archived = false;
    const data = await Workspace.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

app.get("/api/workspaces/:id", async (req, res, next) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user && req.user.role !== "admin") {
      filter.owner = req.user.parentId || req.user.id;
    }
    const ws = await Workspace.findOne(filter);
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable ou accès refusé" });
    res.json({ success: true, data: ws });
  } catch (e) { next(e); }
});

app.post("/api/workspaces", async (req, res, next) => {
  try {
    const ownerId = req.user ? (req.user.parentId || req.user.id) : undefined;
    const payload = { ...req.body, owner: ownerId };
    const ws = await Workspace.create(payload);
    res.status(201).json({ success: true, data: ws });
  } catch (e) { next(e); }
});

app.put("/api/workspaces/:id", async (req, res, next) => {
  try {
    const { company, name, startDate, endDate, workingDays, skipHolidays, vacances, ...rest } = req.body;
    const update = { ...rest };
    if (company)              update.name         = company;
    if (name)                 update.name         = name;
    if (startDate !== undefined) update.startDate = startDate;
    if (endDate   !== undefined) update.endDate   = endDate;
    if (workingDays  !== undefined) update.workingDays  = workingDays;
    if (skipHolidays !== undefined) update.skipHolidays = skipHolidays;
    if (vacances     !== undefined) update.vacances     = vacances;

    const ws = await Workspace.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    const wsObj = ws.toObject();
    wsObj.company = wsObj.name;
    wsObj.id      = wsObj._id;
    res.json({ success: true, data: wsObj });
  } catch (e) { next(e); }
});

app.patch("/api/workspaces/:id/settings", async (req, res, next) => {
  try {
    const { workingDays, skipHolidays, vacances } = req.body;
    const update = {};
    if (workingDays  !== undefined) update.workingDays  = workingDays;
    if (skipHolidays !== undefined) update.skipHolidays = skipHolidays;
    if (vacances     !== undefined) update.vacances     = vacances;
    if (Object.keys(update).length === 0)
      return res.status(400).json({ success: false, message: "Aucun paramètre à mettre à jour" });
    const ws = await Workspace.findByIdAndUpdate(
      req.params.id, { $set: update }, { new: true, runValidators: true }
    );
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    const wsObj = ws.toObject();
    wsObj.company = wsObj.name;
    wsObj.id      = wsObj._id;
    res.json({ success: true, data: wsObj });
  } catch (e) { next(e); }
});

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
      GanttSnapshot.findOneAndDelete({ workspaceId: wsId }),
      ExportBase.findOneAndDelete({ workspaceId: wsId }),
    ]);
    res.json({ success: true, message: "Workspace et toutes ses données supprimés" });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 7. ROUTES — FORMATIONS (Base 2)
// ─────────────────────────────────────────────────────────────

app.get("/api/workspaces/:wsId/formations", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.search) filter.intitule = { $regex: req.query.search, $options: "i" };
    const data = await Formation.find(filter).sort({ intitule: 1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

app.get("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    const candidats = await Candidat.find({
      workspaceId: req.params.wsId,
      theme: { $regex: `^${f.intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).select("nom prenom matricule groupe statut dateDebut dateFin");
    res.json({ success: true, data: { ...f.toObject(), candidats } });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/formations", async (req, res, next) => {
  try {
    const f = await Formation.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: f });
  } catch (e) { next(e); }
});

app.put("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true, runValidators: true }
    );
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    const esc = f.intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await Candidat.updateMany(
      { workspaceId: req.params.wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
      { domaine: f.domaine, objectif: f.objectif, contenu: f.contenu, niveau: f.niveau, publicCible: f.publicCible }
    );
    res.json({ success: true, data: f });
  } catch (e) { next(e); }
});

app.delete("/api/workspaces/:wsId/formations/:id", async (req, res, next) => {
  try {
    const f = await Formation.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!f) return res.status(404).json({ success: false, message: "Formation introuvable" });
    res.json({ success: true, message: "Formation supprimée" });
  } catch (e) { next(e); }
});

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
          { workspaceId: wsId, intitule, domaine: f.domaine || "", objectif: f.objectif || "",
            contenu: f.contenu || "", duree: f.duree || "", niveau: f.niveau || "",
            publicCible: f.publicCible || f.public || "", prerequis: f.prerequis || "",
            extraData: f.extraData || {}, batchId, fileName },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
        const esc = intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await Candidat.updateMany(
          { workspaceId: wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
          { domaine: f.domaine || "", objectif: f.objectif || "", contenu: f.contenu || "",
            niveau: f.niveau || "", publicCible: f.publicCible || f.public || "" }
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

app.get("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    const candidats = await Candidat.find({
      workspaceId: req.params.wsId,
      theme: { $regex: `^${c.intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).select("nom prenom matricule groupe statut dateDebut dateFin theme");
    res.json({ success: true, data: { ...c.toObject(), candidats } });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/cabinets", async (req, res, next) => {
  try {
    const c = await Cabinet.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: c });
  } catch (e) { next(e); }
});

app.put("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.params.wsId },
      req.body, { new: true, runValidators: true }
    );
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    const esc = c.intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await Candidat.updateMany(
      { workspaceId: req.params.wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
      { cabinet: c.cabinet, cnss: c.cnss, lieu: c.lieu, cout: c.cout,
        formateur: c.formateur, contact: c.contact }
    );
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

app.delete("/api/workspaces/:wsId/cabinets/:id", async (req, res, next) => {
  try {
    const c = await Cabinet.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Cabinet introuvable" });
    res.json({ success: true, message: "Cabinet supprimé" });
  } catch (e) { next(e); }
});

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
          { workspaceId: wsId, intitule, cabinet: cab.cabinet.trim(), cnss: cab.cnss || "",
            lieu: cab.lieu || "", cout: cab.cout || "", contact: cab.contact || "",
            formateur: cab.formateur || "", extraData: cab.extraData || {}, batchId, fileName },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
        const esc = intitule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        await Candidat.updateMany(
          { workspaceId: wsId, theme: { $regex: `^${esc}$`, $options: "i" } },
          { cabinet: cab.cabinet || "", cnss: cab.cnss || "", lieu: cab.lieu || "",
            cout: cab.cout || "", formateur: cab.formateur || "", contact: cab.contact || "" }
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
// 9. ROUTES — CANDIDATS
// ─────────────────────────────────────────────────────────────

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
        themes:   byTheme.length,
        groupes:  byTheme.reduce((s, t) => s + t.groupes.length, 0),
        withCabinet,
      },
    });
  } catch (e) { next(e); }
});

app.get("/api/workspaces/:wsId/candidats/:id", async (req, res, next) => {
  try {
    const c = await Candidat.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Candidat introuvable" });
    res.json({ success: true, data: c });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/candidats", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { formIdx, cabIdx } = await loadReferentiels(wsId);
    const enriched = applyEnrichissement({ ...req.body, workspaceId: wsId }, formIdx, cabIdx);
    const c = await Candidat.create(enriched);
    res.status(201).json({ success: true, data: c });
  } catch (e) { next(e); }
});

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

app.delete("/api/workspaces/:wsId/candidats/:id", async (req, res, next) => {
  try {
    const c = await Candidat.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!c) return res.status(404).json({ success: false, message: "Candidat introuvable" });
    res.json({ success: true, message: "Candidat supprimé" });
  } catch (e) { next(e); }
});

app.delete("/api/workspaces/:wsId/candidats", async (req, res, next) => {
  try {
    const result = await Candidat.deleteMany({ workspaceId: req.params.wsId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/candidats/import", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", candidats = [] } = req.body;
    const wsId = req.params.wsId;
    if (!candidats.length)
      return res.status(400).json({ success: false, message: "Aucun candidat fourni" });
    const { formIdx, cabIdx } = await loadReferentiels(wsId);
    const docs = candidats.map((c) => {
      const enriched = applyEnrichissement(c, formIdx, cabIdx);
      return {
        workspaceId: wsId,
        nom:         (enriched.nom       || "").trim(),
        prenom:      (enriched.prenom    || "").trim(),
        matricule:   (enriched.matricule || "").trim(),
        poste:       enriched.poste       || "",
        departement: enriched.departement || "",
        theme:       (enriched.theme     || "").trim(),
        heures:      Number(enriched.heures) || 0,
        jours:       Number(enriched.jours)  || 0,
        groupe:      Number(enriched.groupe) || 1,
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
        nbrEspace:   enriched.nbrEspace   || 1,
        cout:        enriched.cout        || "",
        formateur:   enriched.formateur   || "",
        contact:     enriched.contact     || "",
        extraData:   enriched.extraData   || {},
        batchId, fileName,
        importedAt: new Date(),
      };
    });
    let inserted = 0, errCount = 0;
    const BATCH = 500;
    for (let i = 0; i < docs.length; i += BATCH) {
      try {
        const result = await Candidat.insertMany(docs.slice(i, i + BATCH), { ordered: false });
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

app.get("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.group) filter.group = { $regex: req.query.group, $options: "i" };
    const data = await Task.find(filter).sort({ start: 1, group: 1 });
const cleanData = data.map(t => {
  const obj = t.toObject();
  obj.groupe = String(obj.groupe); // Force string pour la cohérence frontend
  return obj;
});
res.json({ success: true, data: cleanData });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const t = await Task.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: t });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/tasks/bulk", async (req, res, next) => {
  try {
    const { tasks = [] } = req.body;
    const wsId = req.params.wsId;
    if (!tasks.length) return res.json({ success: true, inserted: 0 });
    const groups = [...new Set(tasks.map((t) => t.group))];
    await Task.deleteMany({ workspaceId: wsId, group: { $in: groups } });
    const docs = tasks.map((t) => ({ ...t, workspaceId: wsId }));
    const inserted = await Task.insertMany(docs, { ordered: false });
    res.status(201).json({ success: true, inserted: inserted.length });
  } catch (e) { next(e); }
});

app.patch("/api/tasks/:id/dates", async (req, res, next) => {
  try {
    const { start, end } = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, { start, end }, { new: true });
    if (!task) return res.status(404).json({ success: false, message: "Tâche introuvable" });
    await Promise.all([
      Candidat.updateMany(
        { workspaceId: task.workspaceId, theme: task.group, groupe: task.groupe },
        { dateDebut: start, dateFin: end }
      ),
      Document.updateMany(
        { workspaceId: task.workspaceId, theme: task.group, groupe: task.groupe },
        { dateDoc: start }
      ),
    ]);
    res.json({ success: true, data: task });
  } catch (e) { next(e); }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ success: false, message: "Tâche introuvable" });
    await Promise.all([
      Candidat.updateMany(
        { workspaceId: task.workspaceId, theme: task.group, groupe: task.groupe },
        { dateDebut: task.start, dateFin: task.end }
      ),
      Document.updateMany(
        { workspaceId: task.workspaceId, theme: task.group, groupe: task.groupe },
        { dateDoc: task.start }
      ),
    ]);
    res.json({ success: true, data: task });
  } catch (e) { next(e); }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const t = await Task.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: "Tâche introuvable" });
    res.json({ success: true, message: "Tâche supprimée" });
  } catch (e) { next(e); }
});

app.delete("/api/workspaces/:wsId/tasks/:id", async (req, res, next) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    res.json({ success: true });
  } catch (e) { next(e); }
});

app.delete("/api/workspaces/:wsId/tasks", async (req, res, next) => {
  try {
    const result = await Task.deleteMany({ workspaceId: req.params.wsId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 11. ROUTES — DOCUMENTS
// ─────────────────────────────────────────────────────────────

app.get("/api/workspaces/:wsId/documents", async (req, res, next) => {
  try {
    const filter = { workspaceId: req.params.wsId };
    if (req.query.type)   filter.type   = req.query.type;
    if (req.query.statut) filter.statut = req.query.statut;
    const data = await Document.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// AJOUTER CETTE ROUTE : Supprimer TOUS les documents d'un workspace
app.delete("/api/workspaces/:wsId/documents", async (req, res, next) => {
  try {
    const result = await Document.deleteMany({ workspaceId: req.params.wsId });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (e) { next(e); }
});

app.get("/api/workspaces/:wsId/documents/:id", async (req, res, next) => {
  try {
    const d = await Document.findOne({ _id: req.params.id, workspaceId: req.params.wsId });
    if (!d) return res.status(404).json({ success: false, message: "Document introuvable" });
    res.json({ success: true, data: d });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/documents", async (req, res, next) => {
  try {
    const d = await Document.create({ ...req.body, workspaceId: req.params.wsId });
    res.status(201).json({ success: true, data: d });
  } catch (e) { next(e); }
});

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

app.delete("/api/workspaces/:wsId/documents/:id", async (req, res, next) => {
  try {
    await Document.findOneAndDelete({ _id: req.params.id, workspaceId: req.params.wsId });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 12. ROUTES — GANTT SNAPSHOT
// ─────────────────────────────────────────────────────────────

// GET — charge le snapshot complet (tasks + candidats)
app.get("/api/workspaces/:wsId/gantt", async (req, res, next) => {
  try {
    const snap = await GanttSnapshot.findOne({ workspaceId: req.params.wsId }).lean();
    if (!snap) {
      return res.json({ success: true, data: { tasks: [], candidats: [], savedAt: null } });
    }
    res.json({
      success: true,
      data: {
        tasks:     snap.tasks     || [],
        candidats: snap.candidats || [],
        savedAt:   snap.savedAt   || snap.updatedAt,
      },
    });
  } catch (e) { next(e); }
});

// POST — sauvegarde complète depuis MultiBaseImportWizard.confirm()
app.post("/api/workspaces/:wsId/gantt", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { tasks = [], candidats = [] } = req.body;

    const slimTasks  = tasks.map(normGanttTask);
    const slimCands  = candidats.map(normGanttCandidat);

    const snap = await GanttSnapshot.findOneAndUpdate(
      { workspaceId: wsId },
      { workspaceId: wsId, tasks: slimTasks, candidats: slimCands, savedAt: new Date() },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(201).json({
      success:    true,
      savedAt:    snap.savedAt,
      totalTasks: slimTasks.length,
      totalCands: slimCands.length,
      message:    `Snapshot Gantt sauvegardé — ${slimTasks.length} tâches · ${slimCands.length} candidats`,
    });
  } catch (e) { next(e); }
});

// PATCH /tasks — mise à jour des tasks seules (après édition formulaire)
app.patch("/api/workspaces/:wsId/gantt/tasks", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { tasks = [] } = req.body;

    const slimTasks = tasks.map(normGanttTask);

    const snap = await GanttSnapshot.findOneAndUpdate(
      { workspaceId: wsId },
      { $set: { tasks: slimTasks, savedAt: new Date() } },
      { new: true, upsert: true }
    );

    res.json({ success: true, savedAt: snap.savedAt, totalTasks: slimTasks.length });
  } catch (e) { next(e); }
});

// PATCH /group-dates — drag Gantt : met à jour tasks + candidats dans snapshot ET collections
app.patch("/api/workspaces/:wsId/gantt/group-dates", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { theme, groupe, start, end } = req.body;

    if (!theme || !start || !end)
      return res.status(400).json({ success: false, message: "theme, start, end requis" });

    const snap = await GanttSnapshot.findOne({ workspaceId: wsId });
    if (!snap)
      return res.status(404).json({ success: false, message: "Snapshot introuvable — lancez d'abord un import" });

    const grpStr = String(groupe || "1");
    const grpNum = Number(groupe) || 1;

    // Patch tasks dans le snapshot
    snap.tasks = snap.tasks.map(t =>
      t.group === theme && String(t.groupe) === grpStr
        ? { ...t.toObject(), start, end }
        : t
    );

    // Patch candidats dans le snapshot
    snap.candidats = snap.candidats.map(c =>
      c.theme === theme && String(c.groupe) === grpStr
        ? { ...c.toObject(), dateDebut: start, dateFin: end }
        : c
    );

    snap.savedAt = new Date();
    snap.markModified("tasks");
    snap.markModified("candidats");
    await snap.save();

    // Synchro parallèle dans les collections Task, Candidat, Document
    await Promise.all([
      Task.updateMany(
        { workspaceId: wsId, group: theme, groupe: grpNum },
        { start, end }
      ),
      Candidat.updateMany(
        { workspaceId: wsId, theme, groupe: grpNum },
        { dateDebut: start, dateFin: end }
      ),
      Document.updateMany(
        { workspaceId: wsId, theme, groupe: grpNum },
        { dateDoc: start }
      ),
    ]);

    res.json({
      success: true,
      savedAt: snap.savedAt,
      patched: { theme, groupe: grpStr, start, end },
    });
  } catch (e) { next(e); }
});

// DELETE — supprime le snapshot (ex: réimport complet)
app.delete("/api/workspaces/:wsId/gantt", async (req, res, next) => {
  try {
    await GanttSnapshot.findOneAndDelete({ workspaceId: req.params.wsId });
    res.json({ success: true, message: "Snapshot Gantt supprimé" });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 12.5 ROUTES — EXPORT BASE (Base fusionnée Excel)
// ─────────────────────────────────────────────────────────────

// GET — Récupérer la base et l'ordre
app.get("/api/workspaces/:wsId/export-base", async (req, res, next) => {
  try {
    const data = await ExportBase.findOne({ workspaceId: req.params.wsId }).lean();
    if (!data) return res.json({ success: true, data: { rows: [], columnOrder: [], exportedAt: null } });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// PATCH — Sauvegarder les données et mettre à jour le drapeau sur le Workspace
app.patch("/api/workspaces/:wsId/export-base", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { rows, columnOrder } = req.body.exportBase || {};

    // 1. On enregistre la base fusionnée
    await ExportBase.findOneAndUpdate(
      { workspaceId: wsId },
      { $set: { rows, columnOrder, exportedAt: new Date() } },
      { upsert: true }
    );

    // 2. IMPORTANT : On met à jour le Workspace et on RÉCUPÈRE l'objet complet
    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      wsId, 
      { hasExportBase: true }, 
      { new: true } // Indispensable pour renvoyer la nouvelle version
    );

    // 3. On renvoie le WORKSPACE (c'est ce que App.js attend pour se mettre à jour)
    res.json({ success: true, data: updatedWorkspace });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 13. ROUTES — MULTI-IMPORT
// ─────────────────────────────────────────────────────────────

app.post("/api/workspaces/:wsId/multi-import/init", async (req, res, next) => {
  try {
    const wsId = req.params.wsId;
    const { batchId = "", clearFormations = false, clearCabinets = false } = req.body;
    const ws = await Workspace.findById(wsId);
    if (!ws) return res.status(404).json({ success: false, message: "Workspace introuvable" });
    const [cRes, tRes, dRes, fRes, bRes] = await Promise.all([
      Candidat.deleteMany({ workspaceId: wsId }),
      Task.deleteMany({ workspaceId: wsId }),
      Document.deleteMany({ workspaceId: wsId }),
      clearFormations ? Formation.deleteMany({ workspaceId: wsId }) : Promise.resolve({ deletedCount: 0 }),
      clearCabinets   ? Cabinet.deleteMany({ workspaceId: wsId })   : Promise.resolve({ deletedCount: 0 }),
    ]);
    res.json({
      success: true, batchId,
      cleared: {
        candidats:  cRes.deletedCount,
        tasks:      tRes.deletedCount,
        documents:  dRes.deletedCount,
        formations: clearFormations ? fRes.deletedCount : "conservées",
        cabinets:   clearCabinets   ? bRes.deletedCount : "conservés",
      },
      message: "Workspace prêt pour l'import",
    });
  } catch (e) { next(e); }
});

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
          { workspaceId: wsId, intitule, domaine: f.domaine || "", objectif: f.objectif || "",
            contenu: f.contenu || "", duree: f.duree || "", niveau: f.niveau || "",
            publicCible: f.publicCible || f.public || "", prerequis: f.prerequis || "",
            extraData: f.extraData || {}, batchId, fileName },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
      } catch (e) { errors.push({ intitule: f.intitule, error: e.message }); }
    }
    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} formations importées`,
      ...(errors.length && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

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
          { workspaceId: wsId, intitule, cabinet: (cab.cabinet || intitule).trim(),
            cnss: cab.cnss || "", lieu: cab.lieu || "", cout: cab.cout || "",
            contact: cab.contact || "", formateur: cab.formateur || "",
            extraData: cab.extraData || {}, batchId, fileName },
          { upsert: true, new: true, runValidators: true }
        );
        upserted++;
      } catch (e) { errors.push({ intitule: cab.intitule, error: e.message }); }
    }
    res.status(201).json({
      success: true, upserted, errors: errors.length,
      message: `${upserted} cabinets importés`,
      ...(errors.length && { errorDetails: errors }),
    });
  } catch (e) { next(e); }
});

app.post("/api/workspaces/:wsId/multi-import/candidats", async (req, res, next) => {
  try {
    const { batchId = "", fileName = "", candidats = [] } = req.body;
    const wsId = req.params.wsId;
    if (!candidats.length)
      return res.status(400).json({ success: false, message: "Aucun candidat fourni" });
    const { formIdx, cabIdx } = await loadReferentiels(wsId);
    const BATCH = 500;
    let inserted = 0, errCount = 0;
    for (let i = 0; i < candidats.length; i += BATCH) {
      const chunk = candidats.slice(i, i + BATCH).map((c) => {
        const enriched = applyEnrichissement(c, formIdx, cabIdx);
        return {
          workspaceId: wsId,
          nom:         (enriched.nom       || "").trim(),
          prenom:      (enriched.prenom    || "").trim(),
          matricule:   (enriched.matricule || "").trim(),
          poste:       enriched.poste       || "",
          departement: enriched.departement || "",
          theme:       (enriched.theme     || "").trim(),
          heures:      Number(enriched.heures) || 0,
          jours:       Number(enriched.jours)  || 0,
          groupe:      Number(enriched.groupe) || 1,
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
          nbrEspace:   enriched.nbrEspace   || 1,
          cout:        enriched.cout        || "",
          formateur:   enriched.formateur   || "",
          contact:     enriched.contact     || "",
          extraData:   enriched.extraData   || {},
          batchId, fileName, importedAt: new Date(),
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

app.get("/api/workspaces/:wsId/multi-import/status/:batchId", async (req, res, next) => {
  try {
    const { wsId, batchId } = req.params;
    const [candidats, formations, cabinets, tasks, documents, snap] = await Promise.all([
      Candidat.countDocuments({ workspaceId: wsId, batchId }),
      Formation.countDocuments({ workspaceId: wsId, batchId }),
      Cabinet.countDocuments({ workspaceId: wsId, batchId }),
      Task.countDocuments({ workspaceId: wsId }),
      Document.countDocuments({ workspaceId: wsId }),
      GanttSnapshot.findOne({ workspaceId: wsId }).select("savedAt totalTasks totalCands").lean(),
    ]);
    res.json({
      success: true, batchId,
      data: {
        candidats, formations, cabinets, tasks, documents,
        ganttSnapshot: snap ? { savedAt: snap.savedAt } : null,
      },
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────
// 14. 404 + ERREURS
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} introuvable` });
});
app.use(errHandler);

// ─────────────────────────────────────────────────────────────
// 15. DÉMARRAGE
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  PlanAdmin Backend v2.2 — http://localhost:${PORT}/api`);
  console.log(`\n📋  Endpoints :`);
  console.log(`   GET  POST            /api/workspaces`);
  console.log(`   GET  PUT  DELETE     /api/workspaces/:id`);
  console.log(`   PATCH                /api/workspaces/:id/settings`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST  DELETE    /api/workspaces/:wsId/candidats`);
  console.log(`   GET  PUT   DELETE    /api/workspaces/:wsId/candidats/:id`);
  console.log(`   POST                 /api/workspaces/:wsId/candidats/import`);
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
  console.log(`   PUT  DELETE          /api/tasks/:id`);
  console.log(`   PATCH                /api/tasks/:id/dates`);
  console.log(`   ──────────────────────────────────────────────`);
  console.log(`   GET  POST  DELETE    /api/workspaces/:wsId/gantt          ← NOUVEAU`);
  console.log(`   PATCH                /api/workspaces/:wsId/gantt/tasks    ← NOUVEAU`);
  console.log(`   PATCH                /api/workspaces/:wsId/gantt/group-dates ← NOUVEAU`);
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