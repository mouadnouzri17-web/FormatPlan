const mongoose = require("mongoose");

const candidatSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    // Infos de base
    nom:       { type: String, required: true, trim: true },
    prenom:    { type: String, required: true, trim: true },
    matricule: { type: String, default: "" },
    poste:     { type: String, default: "", trim: true },
    statut:    {
      type: String,
      enum:["Reçu", "En cours", "Retenu", "Refusé"],
      default: "Reçu",
    },
    notes:     { type: String, default: "" },

    // Données formation (import Excel)
    theme:     { type: String, default: "", trim: true },
    jours:     { type: Number, default: 0 },
    groupe:    { type: Number, default: 1 },
    dateDebut: { type: String, default: "" }, // "YYYY-MM-DD"
    dateFin:   { type: String, default: "" }, // "YYYY-MM-DD"
    heures:    { type: Number, default: 0 },

    // Toutes les colonnes Excel supplémentaires stockées ici
    // ex: { "CIN": "AB123456", "Société": "ACME", "Ville": "Casablanca" }
    extraData: {
      type: Map,
      of: String,
      default: {},
    },

    // Import batch reference (pour retrouver tous les candidats d'un même import)
    importBatch: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index composé pour filtrer par theme+groupe rapidement
candidatSchema.index({ workspace: 1, theme: 1, groupe: 1 });
candidatSchema.index({ workspace: 1, statut: 1 });

module.exports = mongoose.model("Candidat", candidatSchema);