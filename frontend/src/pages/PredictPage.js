import React from 'react';
import PredictionCard from '../components/PredictionCard';

function PredictPage({ trading }) {
  return (
    <div className="page prediction-main">
      <PredictionCard
        analyzing={trading.analyzing}
        analyzeAsset={trading.analyzeAsset}
        prediction={trading.prediction}
        selectedAsset={trading.selectedAsset}
        suggestion={trading.suggestion}
        watchlist={trading.watchlist}
        watchlistDetails={trading.watchlistDetails}
        selectAsset={trading.selectAsset}
        resolveAsset={trading.resolveAsset}
        lookupSymbols={trading.lookupSymbols}
        fetchSymbols={trading.fetchSymbols}
      />
    </div>
  );
}

export default PredictPage;
