# Controller Logic (Traffic Light System)

## Overview

The Controller Logic, also known as the Traffic Light System, is a visual feedback mechanism that indicates whether a process is in statistical control. It provides an at-a-glance status indicator based on Statistical Process Control (SPC) principles and advanced violation detection, helping users quickly identify processes that require attention.

## Concept

The traffic light system uses a three-state visual indicator to represent process status:

- 🟢 **Green (In Control)**: Process is stable and predictable
- 🟡 **Yellow (Watch Zone)**: Warning conditions detected - trending or significant changes present
- 🔴 **Red (Out of Control)**: Critical violations or sudden unexpected changes detected

This multi-level status system combines Western Electric Rules, statistical analysis, and trend detection to provide nuanced process assessment beyond simple binary control status.

## Control Criteria

The traffic light system evaluates multiple dimensions to determine process status:

### Red (Critical) Conditions

The process shows **RED** when:

1. **Critical Violations (Rule 1 or Rule 4)**:

   - Point beyond 3σ control limits (Rule 1)
   - 2 of 3 points beyond 2σ (Rule 4)
   - **AND** the violation is sudden/unexpected (not part of gradual trend)
   - **OR** moving in unfavorable direction (opposite to preferred trend)

2. **Sudden Spike Detection**:
   - Change > 2.5× average movement
   - Not part of consistent trend pattern
   - Isolated violation (previous points were in control)

### Yellow (Warning) Conditions

The process shows **YELLOW** when ANY of these conditions are met:

1. **Pattern Violations**:

   - Running point pattern (Rule 2): 8+ points on one side of center line
   - 4 Near Limit Pattern (Rule 3): 3 of 4 in extreme quartiles

2. **Statistical Warnings**:

   - Significant unfavorable change > 2.0× average movement
   - Large favorable movement > 3.0× average movement (potential instability)
   - Approaching unfavorable limit (within 15% of limit range)
   - High variability: standard deviation > 1.5× average movement

3. **Trend-Based Warnings**:

   - Unfavorable consistent trend with significant slope
   - Accelerating change rate > 2.0× recent average
   - Significant deviation from baseline (> 2 standard deviations)
   - Large variance from baseline average (> 2.5× average movement)

4. **Favorable Violations**:
   - Points outside limits but moving in favorable direction with consistent trend
   - May indicate improvement requiring limit recalibration

### Green (In Control) Conditions

The process shows **GREEN** when:

- No critical violations present
- No warning conditions met
- Process variation within expected bounds
- Point-to-point changes consistent with historical patterns

**Note**: Low variation (Rule 5: 15+ points within 1σ) is tracked but doesn't affect color - it's generally informational about process stability.

## Implementation

### Core Logic

The traffic light color is calculated using a sophisticated decision tree that evaluates:

```typescript
// Memoize control indicator color based on statistical analysis
const controlIndicatorColor = useMemo(() => {
  if (chartData.length < 3) return "green"; // Need minimum data for analysis

  const lastPoint = chartData[chartData.length - 1];
  const lastIndex = chartData.length - 1;

  // Use unified effective limits (accounts for trend, locked, or default state)
  const effectiveLimits = /* ... */;

  // Analyze recent data (last 5 points)
  const lookbackWindow = Math.min(5, chartData.length);
  const recentPoints = chartData.slice(-lookbackWindow);

  // Calculate statistical measures:
  // - Standard deviation of recent points
  // - Trend detection (consistent direction)
  // - Rate of change (linear regression slope)
  // - Distance to control limits
  // - Deviation from baseline
  // - Change acceleration

  // Determine metric direction preference
  const isUptrendMetric = submetric.preferredTrend === "uptrend";
  const isDowntrendMetric = submetric.preferredTrend === "downtrend";

  // Check for favorable vs unfavorable movement
  // ...

  // RED: Critical violations
  if (hasCriticalViolation) {
    // Check if sudden spike or part of gradual trend
    // Return red for unexpected/unfavorable violations
    // Return yellow for favorable violations with trend
  }

  // YELLOW: Warning conditions
  if (warningConditions.some(condition => condition)) {
    return "yellow";
  }

  // GREEN: Normal, in-control
  return "green";
}, [chartData, effectiveLimits, xmrData.violations, submetric.preferredTrend, trendActive, trendLines]);
```

### Key Data Structures

**Effective Limits** (State-Aware):

```typescript
const effectiveLimits = useMemo(() => {
  if (trendActive && trendLines) {
    // Use trend limits at last point
    return {
      avgX: trendLines.centreLine[lastIndex]?.value,
      UNPL: trendLines.unpl[lastIndex]?.value,
      LNPL: trendLines.lnpl[lastIndex]?.value,
      // ...
    };
  } else if (isLimitsLocked && lockedLimits) {
    // Use locked limits
    return lockedLimits;
  } else {
    // Use default calculated limits
    return xmrData.limits;
  }
}, [trendActive, trendLines, isLimitsLocked, lockedLimits, xmrData.limits]);
```

**Violation Detection**:

```typescript
const hasCriticalViolation =
  lastPoint.isViolation || // Rule 1: Outside limits
  lastPoint.isTwoOfThreeBeyondTwoSigma; // Rule 4: 2 of 3 beyond 2σ

const hasPatternViolation =
  lastPoint.isRunningPoint || // Rule 2: 8+ on one side
  lastPoint.isFourNearLimit; // Rule 3: 3 of 4 in extreme quartiles

const hasLowVariation = lastPoint.isFifteenWithinOneSigma; // Rule 5
```

## Visual Representation

The traffic light status is displayed prominently in the UI:

### Traffic Light Indicator

Located at the top-right of each submetric card - a colored square indicator:

```
🟢 Green Square - In Control - Stable
🟡 Yellow Square - Watch Zone - Trending or significant change
🔴 Red Square - Out of Control - Sudden violation detected
```

The indicator includes hover tooltip with status explanation:

- **Red**: "Out of Control - Sudden violation detected"
- **Yellow**: "Watch Zone - Trending or significant change"
- **Green**: "In Control - Stable"

### Visual Design

```typescript
<div
  className={`w-8 h-8 rounded-sm shadow-lg ring-4 ${
    controlIndicatorColor === "red"
      ? "bg-red-500 ring-red-200 dark:ring-red-900"
      : controlIndicatorColor === "yellow"
      ? "bg-yellow-500 ring-yellow-200 dark:ring-yellow-900"
      : "bg-green-500 ring-green-200 dark:ring-green-900"
  }`}
/>
```

Features:

- **8×8 pixel square** with rounded corners
- **Ring effect** for enhanced visibility
- **Theme-aware** (light/dark mode support)
- **Shadow** for depth and prominence

## Calculation Details

### Natural Process Limits (NPL)

The natural process limits are calculated using the average moving range:

```
UNPL = Average X + (Average Movement × 2.66)
LNPL = Average X - (Average Movement × 2.66)
```

The constant 2.66 is derived from statistical control theory and represents approximately 3 standard deviations for individual measurements.

### Upper Range Limit (URL)

The upper range limit for the moving range chart:

```
URL = Average Movement × 3.27
```

The constant 3.27 is the control limit factor for moving ranges with n=2.

### Moving Range Calculation

The moving range is the absolute difference between consecutive data points:

```typescript
const ranges = data.map((point, index) => {
  if (index === 0) {
    return { ...point, movement: 0 };
  }
  const movement = Math.abs(point.value - data[index - 1].value);
  return { ...point, movement };
});

const avgMovement =
  ranges.filter((r, i) => i > 0).reduce((sum, r) => sum + r.movement, 0) /
  (ranges.length - 1);
```

## Integration with Other Features

### 1. Lock Limits

When limits are manually locked:

- The traffic light still evaluates based on the locked limits
- Status reflects whether the locked limits represent a stable process
- User can adjust locked limits to achieve "in control" status

### 2. Auto Lock Limits

Auto-locking (outlier removal):

- Recalculates limits without outliers
- May change traffic light status from red to green
- Helps identify whether outliers are causing "out of control" status

### 3. Trend Lines

When trend analysis is active:

- Traffic light evaluates based on **trend-adjusted limits** (dynamic limits at the last data point)
- Uses the trend line values at the last point to determine the effective limits for evaluation
- This provides context-aware assessment that accounts for the expected trend trajectory
- A process with a trend is evaluated relative to where it should be on the trend line
- The `effectiveLimits` calculation automatically uses trend line values when trend is active

### 4. Seasonality

When seasonality adjustments are applied:

- Traffic light evaluates the seasonally-adjusted data
- Helps distinguish between seasonal variation (expected) and special causes
- After seasonality removal, a process should ideally be "in control"

## Use Cases

### 1. Quick Health Check

Users can scan multiple metrics on a slide and immediately identify which processes need investigation based on traffic light colors.

### 2. Process Stability Assessment

Before making process changes, verify the process is in control. An out-of-control process should be stabilized before optimization efforts.

### 3. Alert Triggering

The traffic light status can be used to trigger alerts or notifications:

- Email/Slack notifications when status changes from green to red
- Dashboard summaries showing count of in-control vs out-of-control processes

### 4. Reporting and Compliance

Document process control status for audits and compliance:

- "85% of processes were in statistical control this quarter"
- Trend reports showing improvement in control status over time

## Best Practices

### 1. Respond to Red Status

When a process shows as out of control:

1. Investigate recent changes or events
2. Check for data quality issues
3. Look for violations on the chart (points outside limits)
4. Consider if special cause variation is present
5. Document findings and corrective actions

### 2. Don't Overreact to Borderline Cases

If a process is just barely out of control:

- Check if it's due to a single outlier
- Look at the trend over time
- Consider the practical significance, not just statistical significance

### 3. Use with Violation Detection

The traffic light is a summary indicator. Always review the detailed violation patterns:

- Points outside limits (most critical)
- Runs of consecutive points on one side
- Trends indicating process shifts

### 4. Context Matters

A red traffic light doesn't always mean something is wrong:

- May indicate a recent process improvement (deliberate shift)
- Could be due to insufficient data points
- Might reflect a known one-time event

## Technical Considerations

### Performance

The traffic light calculation is memoized for efficiency:

```typescript
const controlIndicatorColor = useMemo(() => {
  // Complex statistical analysis and violation detection
  // Evaluates recent data trends, violations, and process stability
  // ...
  return "green" | "yellow" | "red";
}, [
  chartData,
  effectiveLimits,
  xmrData.violations,
  submetric.preferredTrend,
  trendActive,
  trendLines,
]);
```

Recalculation only occurs when relevant data changes (chart data, limits, violations, trend state), ensuring efficient rendering even with complex analysis.

### Limit Sources

The system uses "effective limits" that automatically adapt based on active state:

- **Default calculated limits**: From all data points (when no adjustments active)
- **Locked limits**: User-specified fixed limits (manual or auto-locked)
- **Trend-based limits**: Dynamic limits at the last data point when trend is active

The `effectiveLimits` calculation ensures traffic light evaluation is always context-aware and uses the most appropriate limits for the current chart state.

### Edge Cases

**Insufficient Data**:

- Requires minimum data points (typically 10) for reliable control limits
- Traffic light may not be shown if data is insufficient

**Extreme Values**:

- If data contains extreme outliers, limits may be very wide
- Process may show as "in control" even with high variation
- Solution: Use auto-lock or manual lock to exclude outliers

**Zero Variation**:

- If all data points are identical, avgMovement = 0
- URL = 0, which may cause issues
- System handles this edge case with minimum threshold

## Relationship with Western Electric Rules

The traffic light system **integrates** Western Electric Rules into its assessment:

| Aspect      | Traffic Light System                               | Western Electric Rules       |
| ----------- | -------------------------------------------------- | ---------------------------- |
| Purpose     | Overall process status with severity levels        | Specific violation patterns  |
| Granularity | Three-state indicator (Red/Yellow/Green)           | Five individual rule types   |
| Integration | Uses WER violations as inputs to decision logic    | Independent violation flags  |
| Sensitivity | Contextual (considers trends, direction, severity) | High (point-by-point)        |
| Use Case    | Quick prioritization and triage                    | Detailed root cause analysis |

**How They Work Together**:

1. **Western Electric Rules** detect specific violation patterns (Rules 1-5)
2. **Traffic Light** evaluates these violations with additional context:
   - Is the violation sudden or gradual?
   - Is it favorable or unfavorable?
   - Is it part of a consistent trend?
   - What's the severity and acceleration?
3. **Result**: Nuanced status that helps prioritize attention:
   - Red = Immediate attention required
   - Yellow = Monitor and investigate
   - Green = Continue normal operations

## Future Enhancements

Potential improvements under consideration:

1. **Historical status tracking**: Track how long a process has been in each state (red/yellow/green)
2. **Status change notifications**: Alert users when status changes (e.g., green → yellow → red)
3. **Confidence levels**: Show confidence score in the status determination
4. **Customizable thresholds**: Allow users to adjust sensitivity of warning/critical thresholds
5. **Batch status API**: Endpoint to check status of multiple metrics simultaneously
6. **Status history visualization**: Timeline showing status changes over time
7. **Predictive warnings**: Machine learning to predict potential status changes
8. **Custom rule weights**: Allow users to prioritize certain violation types

## Related Documentation

- [Auto Lock Limit](./AUTO_LOCK_LIMIT.md) - Automatic outlier detection and limit adjustment
- [Lock Limit](./LOCK_LIMIT.md) - Manual limit locking and modification
- [Trend Lines](./TREND_LINES.md) - Trend analysis and dynamic limits
- [Seasonality](./DESEASONALISATION.md) - Seasonal adjustments for recurring patterns
- [Data Ingestion](./DATA_INGESTION.md) - API for programmatic data ingestion

## References

- Statistical Process Control: A Practical Guide by Dr. Donald J. Wheeler
- Xmrit User Manual: https://xmrit.com/manual/
- Western Electric Rules for Control Charts
