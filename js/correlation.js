// Correlation Analysis for Food Logger
// Analyzes temporal patterns to find which items correlate with chosen symptoms/consequences

function populateCorrelationSelect() {
  console.log('[populateCorrelationSelect] called');
  const select = document.getElementById('correlationItemSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose an item or category --</option>';

  // Add items from processedTable
  const uniqueItems = [...new Set(processedTable.map(e => e.text))].sort();
  uniqueItems.forEach(item => {
    const option = document.createElement('option');
    option.value = `item:${item}`;
    option.textContent = `🍎 ${item}`;
    select.appendChild(option);
  });

  // Add categories
  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = `category:${cat.key}`;
      option.textContent = `🏷️ ${cat.name}`;
      select.appendChild(option);
    });
  }
}

function analyzeCorrelation() {
  console.log('[analyzeCorrelation] called');
  const select = document.getElementById('correlationItemSelect');
  const timeframeInput = document.getElementById('correlationTimeframe');
  const resultsDiv = document.getElementById('correlationResults');
  
  if (!select.value) {
    resultsDiv.innerHTML = '<p style="color:#666;">Please select an item or category to analyze.</p>';
    return;
  }

  const [type, value] = select.value.split(':');
  let targetItem = value;
  let targetType = type;
  const timeframeHours = Math.max(1, Math.min(720, parseInt(timeframeInput.value) || 24));

  console.log('[analyzeCorrelation] analyzing', targetType, ':', targetItem, 'with', timeframeHours, 'hour lookback');

  // Get all raw entries sorted by time
  getAllRaw(rawEntries => {
    const results = performCorrelationAnalysis(rawEntries, targetType, targetItem, timeframeHours);
    displayCorrelationResults(results, targetType, targetItem, timeframeHours);
  });
}

function performCorrelationAnalysis(rawEntries, targetType, targetValue, timeframeHours = 24) {
  console.log('[performCorrelationAnalysis] analyzing', rawEntries.length, 'entries with', timeframeHours, 'hour lookback');

  // Sort entries by time
  const sorted = [...rawEntries].sort((a, b) => new Date(a.time) - new Date(b.time));

  // Parse all entries into flat list with individual items
  const allItems = [];
  sorted.forEach(entry => {
    const items = entry.text.split(',').map(s => s.trim()).filter(Boolean);
    items.forEach(text => {
      allItems.push({
        text: text.charAt(0).toUpperCase() + text.slice(1),
        time: new Date(entry.time),
        rawTime: entry.time
      });
    });
  });

  // Find all occurrences of target item/category
  const targetOccurrences = [];
  if (targetType === 'item') {
    allItems.forEach((item, idx) => {
      if (normalizeText(item.text) === normalizeText(targetValue)) {
        targetOccurrences.push({ index: idx, item, allItems });
      }
    });
  } else if (targetType === 'category') {
    const categoryKey = parseInt(targetValue);
    const category = categories.find(c => c.key === categoryKey);
    if (category && category.items) {
      allItems.forEach((item, idx) => {
        if (category.items.some(ci => normalizeText(ci) === normalizeText(item.text))) {
          targetOccurrences.push({ index: idx, item, allItems });
        }
      });
    }
  }

  console.log('[performCorrelationAnalysis] found', targetOccurrences.length, 'target occurrences');

  // For each target occurrence, analyze preceding and following items
  const correlationMap = {}; // item -> { positive: count, negative: count, neutral: count }

  const lookbackMs = timeframeHours * 60 * 60 * 1000;
  const thresholdHours = Math.min(3, timeframeHours / 2); // 3 hours or half the timeframe, whichever is smaller
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  targetOccurrences.forEach(occurrence => {
    const { index, item, allItems } = occurrence;
    const timeOfTarget = item.time;

    // Look at preceding items (items before target, potential causes)
    for (let i = index - 1; i >= 0; i--) {
      const precedingItem = allItems[i];
      const timeDiff = timeOfTarget - precedingItem.time;

      // Only consider items in lookback window
      if (timeDiff > lookbackMs) break;

      const precedingText = precedingItem.text;
      if (!correlationMap[precedingText]) {
        correlationMap[precedingText] = { positive: 0, negative: 0, neutral: 0, occurrences: [] };
      }

      const minutesDiff = timeDiff / (60 * 1000);
      
      // If item is within threshold time before target, mark as potential cause (positive)
      if (timeDiff <= thresholdMs) {
        correlationMap[precedingText].positive++;
        correlationMap[precedingText].occurrences.push({
          time: precedingItem.time,
          minutesBefore: Math.round(minutesDiff),
          type: 'positive'
        });
      } else {
        // If between threshold and full lookback, mark as weak correlation (neutral)
        correlationMap[precedingText].neutral++;
        correlationMap[precedingText].occurrences.push({
          time: precedingItem.time,
          minutesBefore: Math.round(minutesDiff),
          type: 'neutral'
        });
      }
    }

    // Look at following items (items after target) to detect false positive
    const followingItems = [];
    for (let i = index + 1; i < allItems.length; i++) {
      const followingItem = allItems[i];
      const timeDiff = followingItem.time - timeOfTarget;
      
      // Only look ahead same timeframe as lookback
      if (timeDiff > lookbackMs) break;
      followingItems.push({ item: followingItem, timeDiff });
    }

    // Mark items eaten after symptom as negative correlation (didn't cause it)
    followingItems.forEach(fItem => {
      const itemText = fItem.item.text;
      if (!correlationMap[itemText]) {
        correlationMap[itemText] = { positive: 0, negative: 0, neutral: 0, occurrences: [] };
      }
      
      // If same food was eaten after symptom without helping/worsening, it's negative
      const minutesAfter = fItem.timeDiff / (60 * 1000);
      if (minutesAfter <= thresholdMs) {
        correlationMap[itemText].negative++;
        correlationMap[itemText].occurrences.push({
          time: fItem.item.time,
          minutesAfter: Math.round(minutesAfter),
          type: 'negative'
        });
      }
    });
  });

  // Calculate correlation strength for each item
  const correlationScores = [];
  Object.entries(correlationMap).forEach(([itemName, counts]) => {
    const total = counts.positive + counts.negative + counts.neutral;
    const positiveRatio = counts.positive / total;
    const negativeRatio = counts.negative / total;
    const score = positiveRatio - negativeRatio; // -1 to 1, positive = likely cause

    correlationScores.push({
      item: itemName,
      positiveCount: counts.positive,
      negativeCount: counts.negative,
      neutralCount: counts.neutral,
      total,
      score,
      occurrences: counts.occurrences
    });
  });

  // Sort by correlation score (strongest positive first)
  correlationScores.sort((a, b) => b.score - a.score);

  return {
    targetOccurrences: targetOccurrences.length,
    correlations: correlationScores,
    timeframeHours
  };
}

function displayCorrelationResults(results, targetType, targetValue, timeframeHours) {
  console.log('[displayCorrelationResults] showing results');
  const resultsDiv = document.getElementById('correlationResults');

  if (results.targetOccurrences === 0) {
    resultsDiv.innerHTML = '<p style="color:#999;">No occurrences found for this item/category.</p>';
    return;
  }

  const displayName = targetType === 'category' 
    ? categories.find(c => c.key === parseInt(targetValue))?.name || targetValue
    : targetValue;

  // Format timeframe display
  let timeframeDisplay = '';
  if (timeframeHours < 24) {
    timeframeDisplay = timeframeHours === 1 ? '1 hour' : `${timeframeHours} hours`;
  } else if (timeframeHours % 24 === 0) {
    const days = timeframeHours / 24;
    timeframeDisplay = days === 1 ? '1 day' : `${days} days`;
  } else {
    const days = Math.floor(timeframeHours / 24);
    const hours = timeframeHours % 24;
    timeframeDisplay = `${days}d ${hours}h`;
  }

  let html = `
    <div style="background:#f5f5f5;padding:1em;border-radius:0.5em;margin-bottom:1em;">
      <h3 style="margin:0 0 0.5em 0;">📊 Analysis Results</h3>
      <p style="margin:0.25em 0;color:#666;"><strong>Target:</strong> ${displayName}</p>
      <p style="margin:0.25em 0;color:#666;"><strong>Occurrences analyzed:</strong> ${results.targetOccurrences}</p>
      <p style="margin:0.25em 0;color:#666;"><strong>Lookback timeframe:</strong> ${timeframeDisplay}</p>
    </div>
  `;

  if (results.correlations.length === 0) {
    html += '<p style="color:#999;">No preceding items found within the selected timeframe.</p>';
    resultsDiv.innerHTML = html;
    return;
  }

  html += '<div style="display:flex;flex-direction:column;gap:1em;">';

  results.correlations.forEach(corr => {
    const scorePercent = ((corr.score + 1) / 2 * 100).toFixed(0); // normalize -1..1 to 0..100
    const scoreColor = corr.score > 0.2 ? '#4CAF50' : corr.score < -0.2 ? '#f44336' : '#FFC107';
    const scoreLabel = corr.score > 0.2 ? 'Likely cause' : corr.score < -0.2 ? 'Unlikely cause' : 'Neutral';

    // Create a bar chart visualization
    const maxCount = Math.max(...results.correlations.map(c => c.total));
    const barWidth = Math.max(80, (corr.total / maxCount) * 200);

    html += `
      <div style="border:1px solid #ddd;padding:1em;border-radius:0.5em;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5em;">
          <h4 style="margin:0;">🍎 ${corr.item}</h4>
          <span style="background:${scoreColor};color:white;padding:0.25em 0.75em;border-radius:0.25em;font-size:0.85em;font-weight:bold;">
            ${scoreLabel} (${scorePercent}%)
          </span>
        </div>
        
        <div style="display:flex;gap:0.5em;margin-bottom:0.75em;font-size:0.85em;">
          <div style="flex:1;">
            <div style="background:#4CAF50;height:6px;width:${(corr.positiveCount/corr.total)*100}%;border-radius:3px;margin-bottom:0.25em;"></div>
            <div style="color:#666;">✓ Positive: ${corr.positiveCount}</div>
          </div>
          <div style="flex:1;">
            <div style="background:#FFC107;height:6px;width:${(corr.neutralCount/corr.total)*100}%;border-radius:3px;margin-bottom:0.25em;"></div>
            <div style="color:#666;">~ Neutral: ${corr.neutralCount}</div>
          </div>
          <div style="flex:1;">
            <div style="background:#f44336;height:6px;width:${(corr.negativeCount/corr.total)*100}%;border-radius:3px;margin-bottom:0.25em;"></div>
            <div style="color:#666;">✗ Negative: ${corr.negativeCount}</div>
          </div>
        </div>

        <details style="font-size:0.85em;color:#666;">
          <summary style="cursor:pointer;font-weight:bold;margin-bottom:0.5em;">View occurrences (${corr.total})</summary>
          <div style="margin-top:0.5em;padding-left:1em;border-left:2px solid #ddd;">
            ${corr.occurrences.map(occ => {
              const timeStr = occ.time.toLocaleString();
              const timing = occ.minutesBefore !== undefined 
                ? `${occ.minutesBefore} min before`
                : `${occ.minutesAfter} min after`;
              
              let bgColor, textColor, icon;
              if (occ.type === 'positive') {
                bgColor = '#4CAF50';
                textColor = '#fff';
                icon = '✓';
              } else if (occ.type === 'negative') {
                bgColor = '#f44336';
                textColor = '#fff';
                icon = '✗';
              } else {
                bgColor = '#FFC107';
                textColor = '#000';
                icon = '~';
              }
              
              return `<div style="margin-bottom:0.5em;padding:0.5em;background:${bgColor};color:${textColor};border-radius:0.25em;display:flex;align-items:center;gap:0.5em;">
                <span style="font-weight:bold;font-size:1.1em;">${icon}</span>
                <span>${timeStr} (${timing})</span>
              </div>`;
            }).join('')}
          </div>
        </details>
      </div>
    `;
  });

  html += '</div>';
  resultsDiv.innerHTML = html;
}

// Update select dropdown when data changes
function onRefreshUpdateCorrelationSelect() {
  console.log('[onRefreshUpdateCorrelationSelect] called');
  populateCorrelationSelect();
}
