/**
 * Prediction Service
 * Handles ML predictions for stock trends
 * Calls Python ML service for predictions
 */

const axios = require('axios');

const ML_SERVICE_URL = `http://${process.env.ML_HOST || 'localhost'}:${process.env.ML_PORT || 5000}`;

/**
 * Get prediction for a symbol
 * Returns trend (UP/DOWN) and confidence score
 * @param {string} symbol - Stock symbol
 * @param {Object} options - Optional parameters
 * @returns {Object} - { trend: 'UP'|'DOWN', confidence: number }
 */
async function getPrediction(symbol, options = {}) {
    const { useMLService = true, modelType = 'lstm' } = options;

    // Try to call ML service first
    if (useMLService) {
        try {
            // Call the simple /predict endpoint
            const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
                symbol
            }, {
                timeout: 5000 // 5 second timeout
            });

            // Return the simple response directly: { trend, confidence }
            return {
                trend: response.data.trend,
                confidence: response.data.confidence
            };
        } catch (error) {
            console.warn('ML service unavailable, using mock prediction:', error.message);
            // Fall through to mock prediction
        }
    }

    // Fallback: Return mock prediction
    return generateMockPrediction(symbol);
}

/**
 * Transform ML service response to our format
 * @param {Object} mlData - Response from ML service
 * @returns {Object} - { trend: 'UP'|'DOWN', confidence: number }
 */
function transformMLResponse(mlData) {
    // If the ML service returns predictions array, determine trend from last values
    if (mlData.predictions && Array.isArray(mlData.predictions)) {
        const predictions = mlData.predictions;
        const midPoint = Math.floor(predictions.length / 2);
        const firstHalf = predictions.slice(0, midPoint);
        const secondHalf = predictions.slice(midPoint);

        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const trend = secondAvg > firstAvg ? 'UP' : 'DOWN';
        const confidence = Math.min(Math.abs((secondAvg - firstAvg) / firstAvg * 100), 99);

        return {
            trend,
            confidence: Math.round(confidence * 100) / 100
        };
    }

    // Fallback
    return {
        trend: Math.random() > 0.5 ? 'UP' : 'DOWN',
        confidence: Math.round((50 + Math.random() * 40) * 100) / 100
    };
}

/**
 * Generate a mock prediction for demo purposes
 * Uses symbol hash to make it deterministic per symbol
 * @param {string} symbol - Stock symbol
 * @returns {Object} - { trend: 'UP'|'DOWN', confidence: number }
 */
function generateMockPrediction(symbol) {
    // Use symbol to create deterministic randomness
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = Math.sin(hash) * 10000;
    const normalized = random - Math.floor(random);

    // Bias toward UP slightly (55/45)
    const trend = normalized > 0.45 ? 'UP' : 'DOWN';

    // Confidence between 55% and 95%
    const confidence = 55 + (normalized * 40);

    return {
        trend,
        confidence: Math.round(confidence * 100) / 100
    };
}

/**
 * Get trading suggestion based on prediction
 * @param {string} symbol - Stock symbol
 * @param {Object} prediction - Optional prediction object
 * @param {number} currentPosition - Current position in the symbol
 * @returns {Object} - { action: 'BUY'|'SELL'|'HOLD', reason: string }
 */
async function getSuggestion(symbol, prediction = null, currentPosition = 0) {
    // Get prediction if not provided
    const pred = prediction || await getPrediction(symbol);

    let action;
    let reason;

    if (pred.trend === 'UP' && pred.confidence > 70) {
        if (currentPosition > 0) {
            action = 'HOLD';
            reason = `Strong UP trend (${pred.confidence}%) but already holding position`;
        } else {
            action = 'BUY';
            reason = `Strong UP trend predicted with ${pred.confidence}% confidence`;
        }
    } else if (pred.trend === 'DOWN' && pred.confidence > 70) {
        if (currentPosition > 0) {
            action = 'SELL';
            reason = `Strong DOWN trend predicted with ${pred.confidence}% confidence - consider closing position`;
        } else {
            action = 'HOLD';
            reason = `Strong DOWN trend (${pred.confidence}%) but no position to sell`;
        }
    } else {
        action = 'HOLD';
        reason = `Unclear trend (${pred.trend}, ${pred.confidence}% confidence) - holding position`;
    }

    return {
        symbol,
        action,
        reason,
        prediction: pred
    };
}

module.exports = {
    getPrediction,
    getSuggestion
};
