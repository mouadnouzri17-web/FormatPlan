const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    company:   { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate:   { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
