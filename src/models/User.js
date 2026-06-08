import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verificationCode: { type: String },
  profile: {
    title: String,
    location: String,
    phone: String,
    linkedin: String,
    github: String,
    portfolio: String,
    bio: String,
    skills: {
      technical: [String],
      soft: [String],
      tools: [String],
    },
    experience: [{
      company: String,
      role: String,
      duration: String,
      location: String,
      bullets: [String],
    }],
    education: [{
      institution: String,
      degree: String,
      year: String,
    }],
    projects: [{
      name: String,
      description: String,
      technologies: [String],
      url: String,
    }],
  },
  preferences: {
    targetRole: String,
    targetLocation: String,
    dailyCap: { type: Number, default: 50 },
  },
  smtp: {
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 587 },
    user: String,
    pass: String,
    configured: { type: Boolean, default: false },
  },
  onboardingComplete: { type: Boolean, default: false },
  credits: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

UserSchema.index({ email: 1 });
UserSchema.index({ verified: 1 });

export default mongoose.models.User || mongoose.model('User', UserSchema);
