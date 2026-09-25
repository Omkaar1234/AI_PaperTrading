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
            // Call the ML service /predict endpoint
            const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
                symbol
            }, {
                timeout: 10000 // 10 second timeout for 21D ML inference
            });

            if (response.data.status === 'unavailable') {
                return {
                    symbol,
                    status: 'unavailable',
                    supported: false,
                    message: response.data.message || 'Prediction is not currently supported for this asset.',
                    trend: 'NEUTRAL',
                    signal: 'NEUTRAL',
                    confidence: 0
                };
            }

            // Return full response preserving backward compatibility
            return {
                ...response.data,
                trend: response.data.trend || response.data.signal || 'HOLD',
                signal: response.data.signal || response.data.trend || 'NEUTRAL',
                confidence: typeof response.data.confidence === 'number' ? response.data.confidence : 50,
                supported: response.data.supported !== false
            };
        } catch (error) {
            console.warn('ML service error for symbol:', symbol, error.message);
            return {
                symbol,
                status: 'unavailable',
                supported: false,
                message: 'The current prediction model does not support this asset yet.',
                trend: 'NEUTRAL',
                signal: 'NEUTRAL',
                confidence: 0
            };
        }
    }

    return {
        symbol,
        status: 'unavailable',
        supported: false,
        message: 'The current prediction model does not support this asset yet.',
        trend: 'NEUTRAL',
        signal: 'NEUTRAL',
        confidence: 0
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

/**
 * Get ML V2.1 5-trading-day movement prediction
 * @param {string} symbol - Stock or crypto symbol
 * @param {Object} options - { assetType }
 * @returns {Object} - V2 prediction response
 */
async function getPredictionV2(symbol, options = {}) {
    const { assetType = 'stocks' } = options;
    const response = await axios.post(`${ML_SERVICE_URL}/api/v2/predict`, {
        symbol,
        assetType
    }, {
        timeout: 10000
    });
    return response.data;
}

module.exports = {
    getPrediction,
    getSuggestion,
    getPredictionV2
};
