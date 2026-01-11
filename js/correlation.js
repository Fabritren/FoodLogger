// Correlation Analysis for Food Logger
// Analyzes temporal patterns to find which items correlate with chosen symptoms/consequences

function populateCorrelationSelect() {
  console.log('[populateCorrelationSelect] called');
  const select = document.getElementById('correlationItemSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose an item or category --</option>';

  // Add categories
  if (categories && categories.length > 0) {
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = `category:${cat.key}`;
      option.textContent = `🏷️ ${cat.name}`;
      select.appendChild(option);
    });
  }

  // Add items from processedTable
  const uniqueItems = [...new Set(processedTable.map(e => e.text))].sort();
  uniqueItems.forEach(item => {
    const option = document.createElement('option');
    option.value = `item:${item}`;
    option.textContent = `🍎 ${item}`;
    select.appendChild(option);
  });
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

  // Build correlation map using "closest target" approach
  // For each non-target item, correlate it only to its closest target occurrence
  const correlationMap = {}; // item -> { positive: count, negative: count, neutral: count, occurrences: [] }

  const lookbackMs = timeframeHours * 60 * 60 * 1000;
  const thresholdHours = Math.min(3, timeframeHours / 2);
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  // Extract all non-target items with their times
  const targetIndices = new Set(targetOccurrences.map(t => t.index));
  const nonTargetItems = allItems
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => !targetIndices.has(idx));

  // For each non-target item, find closest target and score relative to it
  nonTargetItems.forEach(({ item, idx }) => {
    // Find closest target occurrence (by time distance)
    let closestTarget = null;
    let minTimeDiff = Infinity;

    targetOccurrences.forEach(target => {
      const timeDiff = Math.abs(target.item.time - item.time);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestTarget = target;
      }
    });

    if (!closestTarget || minTimeDiff > lookbackMs) {
      return; // Item is outside lookback window for all targets
    }

    const itemText = item.text;
    if (!correlationMap[itemText]) {
      correlationMap[itemText] = { positive: 0, negative: 0, neutral: 0, occurrences: [] };
    }

    const timeDiff = closestTarget.item.time - item.time; // positive if item is before target
    const minutesDiff = timeDiff / (60 * 1000);

    // Determine correlation type based on timing relative to closest target
    if (timeDiff > 0 && timeDiff <= thresholdMs) {
      // Item appears before target within threshold → likely cause
      correlationMap[itemText].positive++;
      correlationMap[itemText].occurrences.push({
        time: item.time,
        minutesBefore: Math.round(minutesDiff),
        type: 'positive'
      });
    } else if (timeDiff > thresholdMs && timeDiff <= lookbackMs) {
      // Item appears before target but beyond threshold → weak correlation
      correlationMap[itemText].neutral++;
      correlationMap[itemText].occurrences.push({
        time: item.time,
        minutesBefore: Math.round(minutesDiff),
        type: 'neutral'
      });
    } else if (timeDiff < 0 && Math.abs(timeDiff) <= thresholdMs) {
      // Item appears after target within threshold → ate after, cannot cause
      correlationMap[itemText].negative++;
      correlationMap[itemText].occurrences.push({
        time: item.time,
        minutesAfter: Math.round(Math.abs(minutesDiff)),
        type: 'negative'
      });
    } else if (timeDiff < 0 && Math.abs(timeDiff) <= lookbackMs) {
      // Item appears after target beyond threshold → still cannot cause, mark negative
      correlationMap[itemText].negative++;
      correlationMap[itemText].occurrences.push({
        time: item.time,
        minutesAfter: Math.round(Math.abs(minutesDiff)),
        type: 'negative'
      });
    }
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
                ? `${formatTimingDifference(occ.minutesBefore)} before`
                : `${formatTimingDifference(occ.minutesAfter)} after`;
              
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

function formatTimingDifference(minutes) {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = Math.floor(minutes % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} min`);

  return parts.length > 0 ? parts.join(' ') : '0 min';
}

function syncTimeframeInputs(source) {
  const slider = document.getElementById('correlationTimeframeSlider');
  const input = document.getElementById('correlationTimeframe');
  
  if (source === 'slider') {
    input.value = slider.value;
  } else {
    // Clamp input to valid range
    let value = parseInt(input.value) || 24;
    value = Math.max(1, Math.min(720, value));
    input.value = value;
    slider.value = value;
  }
}