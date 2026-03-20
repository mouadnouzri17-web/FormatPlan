const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name:  { type: String, required: true, trim: true },
    group: { type: String, default: "Général", trim: true },
    start: { type: String, required: true }, // "YYYY-MM-DD"
    end:   { type: String, required: true }, // "YYYY-MM-DD"
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
