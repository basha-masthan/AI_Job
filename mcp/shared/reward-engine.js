import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getTrainingFile(mcpName) {
  ensureDataDir();
  return path.join(DATA_DIR, `mcp_${mcpName}_training.json`);
}

function getRewardsFile(mcpName) {
  ensureDataDir();
  return path.join(DATA_DIR, `mcp_${mcpName}_rewards.json`);
}

export class RewardEngine {
  constructor(mcpName, config = {}) {
    this.mcpName = mcpName;
    this.warmupThreshold = config.warmupThreshold || 20;
    this.decayFactor = config.decayFactor || 0.95;
    this.learningRate = config.learningRate || 0.1;
    this.maxReward = config.maxReward || 10;
    this.minReward = config.minReward || -10;
    this.weights = {};
    this.history = [];
  }

  load() {
    try {
      const file = getTrainingFile(this.mcpName);
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        this.weights = data.weights || {};
        this.history = data.history || [];
      }
    } catch (e) {
      console.warn(`[RewardEngine] Failed to load data for ${this.mcpName}:`, e.message);
    }
  }

  save() {
    try {
      const file = getTrainingFile(this.mcpName);
      fs.writeFileSync(file, JSON.stringify({
        weights: this.weights,
        history: this.history.slice(-1000),
        updatedAt: new Date().toISOString()
      }, null, 2));
    } catch (e) {
      console.error(`[RewardEngine] Failed to save data for ${this.mcpName}:`, e.message);
    }
  }

  recordAction(actionId, actionType, context = {}) {
    const action = {
      id: actionId || `a_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: actionType,
      context,
      timestamp: new Date().toISOString(),
      reward: null,
      recorded: false
    };
    this.history.push(action);
    if (this.history.length > 2000) this.history = this.history.slice(-2000);
    return action;
  }

  recordReward(actionId, baseReward, metadata = {}) {
    const normalizedReward = Math.min(this.maxReward, Math.max(this.minReward, baseReward));
    const action = this.history.find(a => a.id === actionId);
    if (!action) {
      console.warn(`[RewardEngine] Action ${actionId} not found`);
      return null;
    }

    if (action.recorded) {
      console.warn(`[RewardEngine] Action ${actionId} already has reward recorded`);
      return null;
    }

    action.reward = normalizedReward;
    action.metadata = metadata;
    action.recordedAt = new Date().toISOString();

    this._updateWeights(action, normalizedReward);
    this._logReward(actionId, action.type, normalizedReward, metadata);
    this.save();
    return normalizedReward;
  }

  _updateWeights(action, reward) {
    const key = `action:${action.type}`;
    const current = this.weights[key] || { sum: 0, count: 0, avg: 0 };

    current.sum += reward;
    current.count += 1;
    current.avg = current.sum / current.count;

    if (action.context.source) {
      const sourceKey = `source:${action.context.source}`;
      const sourceCurrent = this.weights[sourceKey] || { sum: 0, count: 0, avg: 0 };
      sourceCurrent.sum += reward;
      sourceCurrent.count += 1;
      sourceCurrent.avg = sourceCurrent.sum / sourceCurrent.count;
      this.weights[sourceKey] = sourceCurrent;
    }

    if (action.context.query) {
      const queryKey = `query:${action.context.query.toLowerCase().substring(0, 50)}`;
      const qCurrent = this.weights[queryKey] || { sum: 0, count: 0, avg: 0 };
      qCurrent.sum += reward;
      qCurrent.count += 1;
      qCurrent.avg = qCurrent.avg * this.decayFactor + reward * (1 - this.decayFactor);
      this.weights[queryKey] = qCurrent;
    }

    this.weights[key] = current;
  }

  _logReward(actionId, actionType, reward, metadata) {
    try {
      const file = getRewardsFile(this.mcpName);
      let data = { rewards: [] };
      if (fs.existsSync(file)) {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      }
      data.rewards.push({
        actionId,
        actionType,
        reward,
        metadata,
        timestamp: new Date().toISOString()
      });
      if (data.rewards.length > 1000) data.rewards = data.rewards.slice(-1000);
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`[RewardEngine] Failed to log reward:`, e.message);
    }
  }

  getWeight(key) {
    return this.weights[key] || { sum: 0, count: 0, avg: 0 };
  }

  getTopSources(limit = 10) {
    const sources = [];
    for (const [key, val] of Object.entries(this.weights)) {
      if (key.startsWith('source:')) {
        sources.push({ source: key.replace('source:', ''), ...val });
      }
    }
    sources.sort((a, b) => b.avg - a.avg);
    return sources.slice(0, limit);
  }

  getPerformance() {
    const recorded = this.history.filter(a => a.reward !== null);
    if (recorded.length === 0) {
      return {
        total: this.history.length,
        recorded: 0,
        accuracy: 0,
        avgReward: 0,
        confidence: 0,
        adjustedScore: 0,
        isWarmedUp: false
      };
    }

    const positive = recorded.filter(a => a.reward > 0);
    const negative = recorded.filter(a => a.reward < 0);
    const accuracy = positive.length / recorded.length;
    const avgReward = recorded.reduce((a, b) => a + b.reward, 0) / recorded.length;
    const confidence = Math.min(recorded.length / this.warmupThreshold, 1.0);
    const adjustedScore = avgReward * confidence;

    return {
      total: this.history.length,
      recorded: recorded.length,
      positive: positive.length,
      negative: negative.length,
      accuracy: parseFloat(accuracy.toFixed(3)),
      avgReward: parseFloat(avgReward.toFixed(3)),
      confidence: parseFloat(confidence.toFixed(3)),
      adjustedScore: parseFloat(adjustedScore.toFixed(3)),
      isWarmedUp: recorded.length >= this.warmupThreshold
    };
  }

  suggestImprovements() {
    const perf = this.getPerformance();
    const suggestions = [];

    if (!perf.isWarmedUp) {
      suggestions.push({ priority: 'high', message: `Need ${this.warmupThreshold - perf.recorded} more samples to reach confidence threshold` });
    }

    if (perf.accuracy < 0.5) {
      suggestions.push({ priority: 'high', message: 'Accuracy below 50% — review task definitions and evaluation criteria' });
    }

    if (perf.avgReward < 0) {
      suggestions.push({ priority: 'high', message: 'Average reward is negative — investigate failure patterns in recent rewards' });
    }

    const topSources = this.getTopSources(3);
    if (topSources.length > 0) {
      suggestions.push({ priority: 'low', message: `Top performing sources: ${topSources.map(s => `${s.source}(${s.avg.toFixed(2)})`).join(', ')}` });
    }

    return suggestions;
  }

  autoAdjustReward(actionType, baseReward, context = {}) {
    let adjusted = baseReward;

    const weight = this.weights[`action:${actionType}`];
    if (weight && weight.count >= 5) {
      const bias = weight.avg * this.learningRate;
      adjusted = baseReward + bias;
    }

    if (context.source) {
      const sourceWeight = this.weights[`source:${context.source}`];
      if (sourceWeight && sourceWeight.count >= 3) {
        const sourceBias = sourceWeight.avg * this.learningRate * 0.5;
        adjusted += sourceBias;
      }
    }

    return Math.min(this.maxReward, Math.max(this.minReward, adjusted));
  }

  reset() {
    this.weights = {};
    this.history = [];
    this.save();
  }
}

export function calculateDefaultReward(outcome, thresholds = {}) {
  const {
    perfectThreshold = 0.9,
    goodThreshold = 0.7,
    acceptableThreshold = 0.5,
    perfectReward = 10,
    goodReward = 5,
    acceptableReward = 2,
    failureReward = -5,
    criticalFailureReward = -10
  } = thresholds;

  if (outcome === true || outcome === 'success') return perfectReward;
  if (typeof outcome === 'number') {
    if (outcome >= perfectThreshold) return perfectReward;
    if (outcome >= goodThreshold) return goodReward;
    if (outcome >= acceptableThreshold) return acceptableReward;
    return failureReward;
  }
  if (outcome === false || outcome === 'failure') return failureReward;
  if (outcome === 'critical_failure') return criticalFailureReward;
  return 0;
}
