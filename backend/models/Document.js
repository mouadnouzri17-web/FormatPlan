const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    nom:     { type: String, required: true, trim: true },
    type:    {
      type: String,
      enum: ["Contrat", "Rapport", "CV", "Facture", "Présentation", "Émargement", "Autre"],
      default: "Autre",
    },
    statut:  {
      type: String,
      enum: ["Reçu", "En attente", "Validé", "Rejeté"],
      default: "Reçu",
    },
    dateDoc: { type: String, default: "" }, // "YYYY-MM-DD"
    lien:    { type: String, default: "" },
    notes:   { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
