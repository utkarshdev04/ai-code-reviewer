import mongoose from "mongoose";

const IssueSchema = new mongoose.Schema({
  title: String,
  severity: {
    type: String,
    enum: ["critical", "warning", "info", "ok"],
  },
  description: String,
  line: Number,
  suggestion: String,
  code: String,
});

const FileResultSchema = new mongoose.Schema({
  path: String,
  issues: [IssueSchema],
});

const ReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  repoUrl: {
    type: String,
    required: true,
  },
  owner: {
    type: String,
    required: true,
  },
  repo: {
    type: String,
    required: true,
  },
  totalFiles: {
    type: Number,
    default: 0,
  },
  totalIssues: {
    type: Number,
    default: 0,
  },
  criticalCount: {
    type: Number,
    default: 0,
  },
  results: [FileResultSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Review = mongoose.model("Review", ReviewSchema);

export default Review;