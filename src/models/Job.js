import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  
  // Job Post Details
  title: { type: String, required: true },
  company: { type: String, required: true },
  role: { type: String },
  location: { type: String },
  salary: { type: String },
  url: { type: String },
  description: { type: String },

  // Workflow Status
  status: { 
    type: String, 
    enum: ['pending', 'applied', 'failed', 'interviewing', 'rejected', 'offered'],
    default: 'pending',
    index: true
  },
  source: { type: String, enum: ['autopilot', 'direct-apply', 'manual'], default: 'manual' },

  // Engine Communication Details
  appliedEmail: { type: String },
  emailContext: {
    subject: { type: String },
    bodyText: { type: String },
    bodyHtml: { type: String },
    sentAt: { type: Date }
  },
  
  // Resume Context
  resumeContext: {
    resumeId: { type: String },
    resumeUrl: { type: String }, // The cloudinary URL attached
  },

  // Telemetry & Tracking
  trackingId: { type: String, index: true },
  emailOpened: { type: Boolean, default: false },
  emailOpenCount: { type: Number, default: 0 },
  emailOpenedAt: { type: Date },
  linkClicks: { type: Number, default: 0 },

  // History Log
  timeline: [{
    event: { type: String },
    description: { type: String },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed }
  }],

  dateApplied: { type: String }, // YYYY-MM-DD for easy filtering
}, {
  timestamps: true,
  strict: false // Allow dynamic fields if we expand later
});

// Create compound indexes for performance
JobSchema.index({ userId: 1, status: 1 });
JobSchema.index({ userId: 1, dateApplied: -1 });

export default mongoose.models.Job || mongoose.model('Job', JobSchema);
