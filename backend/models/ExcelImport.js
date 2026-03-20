const mongoose = require("mongoose");

// Stocke l'historique complet de chaque import Excel
// Utile pour re-générer, auditer ou reconstruire des données
const excelImportSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    batchId:   { type: String, required: true, unique: true }, // uid du batch
    fileName:  { type: String, default: "" },
    // Mapping utilisé lors de l'import { nom: 0, prenom: 1, theme: 3, heures: 5 }
    mapping:   { type: Map, of: Number, default: {} },
    // Tous les en-têtes de colonnes du fichier source
    headers:   [{ type: String }],
    // Toutes les lignes brutes (tableau de tableaux de strings)
    rawRows:   { type: mongoose.Schema.Types.Mixed, default: [] },
    // Configuration des groupes utilisée
    themeConf: { type: mongoose.Schema.Types.Mixed, default: [] },
    // Résumé de l'import
    stats: {
      totalCandidats: { type: Number, default: 0 },
      totalThemes:    { type: Number, default: 0 },
      totalGroupes:   { type: Number, default: 0 },
      conflicts:      { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExcelImport", excelImportSchema);
