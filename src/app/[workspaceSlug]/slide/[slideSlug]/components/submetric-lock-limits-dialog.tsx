"use client";

import { Trash2, Undo2 } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestampToDateString } from "@/lib/time-buckets";
import {
  type DataPoint,
  generateXMRData,
  type XMRLimits,
} from "@/lib/xmr-calculations";

interface SubmetricLockLimitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataPoints: DataPoint[];
  currentLimits: XMRLimits;
  onLockLimits: (
    limits: XMRLimits,
    isManuallyModified: boolean,
    excludedIndices: number[],
  ) => void;
  submetricName: string;
  outlierIndices?: number[];
  isCurrentLimitsManuallyLocked?: boolean;
  autoDetectedOutliers?: number[];
  onResetToAutoLock?: () => void;
  isAutoLocked?: boolean;
}

// Memoized table row component to prevent unnecessary re-renders
const DataPointRow = memo(
  ({
    point,
    index,
    timestamp,
    onEditValue,
    onExclude,
    canExclude,
    isExcluded,
  }: {
    point: DataPoint;
    index: number;
    timestamp: string;
    onEditValue: (index: number, value: string) => void;
    onExclude: (index: number) => void;
    canExclude: boolean;
    isExcluded: boolean;
  }) => {
    return (
      <TableRow className={isExcluded ? "bg-gray-100 dark:bg-gray-800/50" : ""}>
        <TableCell
          className={`text-[10px] sm:text-sm py-1.5 sm:py-2 ${isExcluded ? "text-muted-foreground" : ""}`}
        >
          {timestamp}
        </TableCell>
        <TableCell className="text-right p-1">
          <Input
            type="number"
            step="0.01"
            value={isExcluded ? "" : point.value}
            onChange={(e) => onEditValue(index, e.target.value)}
            className="text-right h-7 sm:h-8 w-20 sm:w-32 ml-auto text-xs sm:text-sm"
            placeholder={isExcluded ? "Excluded" : undefined}
            disabled={isExcluded}
          />
        </TableCell>
        <TableCell className="p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExclude(index)}
            className={`h-7 w-7 sm:h-8 sm:w-8 p-0 ${
              isExcluded
                ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                : "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            }`}
            disabled={!canExclude}
            title={
              !canExclude
                ? "Cannot exclude - minimum 3 data points required"
                : isExcluded
                  ? "Include row back"
                  : "Exclude row"
            }
          >
            {isExcluded ? (
              <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </TableCell>
      </TableRow>
    );
  },
);

DataPointRow.displayName = "DataPointRow";

export function SubmetricLockLimitsDialog({
  open,
  onOpenChange,
  dataPoints,
  currentLimits,
  onLockLimits,
  submetricName,
  outlierIndices = [],
  isCurrentLimitsManuallyLocked = false,
  autoDetectedOutliers = [],
  onResetToAutoLock,
  isAutoLocked = false,
}: SubmetricLockLimitsDialogProps) {
  // State for editable data points (never actually removed, just marked as excluded)
  const [editedDataPoints, setEditedDataPoints] =
    useState<DataPoint[]>(dataPoints);

  // State for median mode toggles
  const [useMedian, setUseMedian] = useState(false);

  // State for indices to exclude from calculations (from auto-detection + user exclusions)
  const [excludedIndices, setExcludedIndices] =
    useState<number[]>(outlierIndices);

  // Reset edited data points, median toggle, and excluded indices when dialog opens
  useEffect(() => {
    if (open) {
      setEditedDataPoints(dataPoints);
      setUseMedian(false);
      setExcludedIndices(outlierIndices);
    }
  }, [dataPoints, open, outlierIndices]);

  // Helper function to calculate XMR data from current state
  const calculateXMRFromCurrentState = useCallback(() => {
    if (editedDataPoints.length === 0) {
      return {
        limits: currentLimits,
        dataPoints: [],
      };
    }
    // Filter out excluded indices for limit calculation
    const filteredDataPoints = editedDataPoints.filter(
      (_, index) => !excludedIndices.includes(index),
    );

    // Use filtered data points if we have enough, otherwise use all
    const dataForCalculation =
      filteredDataPoints.length >= 3 ? filteredDataPoints : editedDataPoints;

    const xmrData = generateXMRData(dataForCalculation, useMedian);
    return {
      limits: xmrData.limits,
      dataPoints: xmrData.dataPoints,
    };
  }, [editedDataPoints, currentLimits, useMedian, excludedIndices]);

  // State for input values (lazy initialization to avoid repeated toString calls)
  const [avgX, setAvgX] = useState<string>(() => currentLimits.avgX.toString());
  const [unpl, setUnpl] = useState<string>(() => currentLimits.UNPL.toString());
  const [lnpl, setLnpl] = useState<string>(() => currentLimits.LNPL.toString());
  const [avgMovement, setAvgMovement] = useState<string>(() =>
    currentLimits.avgMovement.toString(),
  );
  const [url, setUrl] = useState<string>(() => currentLimits.URL.toString());

  // Track which fields have been modified
  const [isModified, setIsModified] = useState({
    avgX: false,
    unpl: false,
    lnpl: false,
    avgMovement: false,
    url: false,
  });

  // Track if user made any changes (for determining manual vs auto lock)
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);

  // Reset inputs and modification state when dialog opens
  useEffect(() => {
    if (open) {
      setAvgX(currentLimits.avgX.toFixed(2));
      setUnpl(currentLimits.UNPL.toFixed(2));
      setLnpl(currentLimits.LNPL.toFixed(2));
      setAvgMovement(currentLimits.avgMovement.toFixed(2));
      setUrl(currentLimits.URL.toFixed(2));

      // Always reset field modification flags (to allow auto-recalculation)
      setIsModified({
        avgX: false,
        unpl: false,
        lnpl: false,
        avgMovement: false,
        url: false,
      });

      // If current limits were manually locked, preserve that status
      // This ensures manual lock state persists even when making additional changes
      if (isCurrentLimitsManuallyLocked) {
        setHasUserMadeChanges(true);
      } else {
        setHasUserMadeChanges(false);
      }
    }
  }, [open, currentLimits, isCurrentLimitsManuallyLocked]);

  // Auto-recalculate limits when data or exclusions change
  // This provides real-time feedback as user modifies data or exclusions
  useEffect(() => {
    if (!open) return;

    // Check if any manual field modifications exist
    const hasManualModifications = Object.values(isModified).some((v) => v);

    // Only auto-calculate if no manual modifications to limit fields
    // This allows the user to see live updates while preserving manual overrides
    if (!hasManualModifications) {
      const recalculated = calculateXMRFromCurrentState();
      setAvgX(recalculated.limits.avgX.toFixed(2));
      setUnpl(recalculated.limits.UNPL.toFixed(2));
      setLnpl(recalculated.limits.LNPL.toFixed(2));
      setAvgMovement(recalculated.limits.avgMovement.toFixed(2));
      setUrl(recalculated.limits.URL.toFixed(2));
    }
  }, [open, calculateXMRFromCurrentState, isModified]);

  // Reset data points to original (clears all exclusions)
  const handleResetToOriginal = useCallback(() => {
    setEditedDataPoints(dataPoints);
    setExcludedIndices([]); // Clear all exclusions to show all original values

    // Mark that user has made changes (clicking reset is a user action)
    setHasUserMadeChanges(true);
  }, [dataPoints]);

  // Reset to auto-lock state (restores auto-detected outliers)
  const handleResetToAutoLock = useCallback(() => {
    if (onResetToAutoLock) {
      onResetToAutoLock();
      onOpenChange(false); // Close the dialog after reset
    }
  }, [onResetToAutoLock, onOpenChange]);

  // Handle data point value edit
  const handleEditValue = useCallback((index: number, newValue: string) => {
    const parsed = parseFloat(newValue);
    if (!Number.isNaN(parsed)) {
      setEditedDataPoints((prevPoints) => {
        const newDataPoints = [...prevPoints];
        newDataPoints[index] = { ...newDataPoints[index], value: parsed };
        return newDataPoints;
      });

      // Remove from excluded indices if user edits an excluded value
      setExcludedIndices((prevIndices) =>
        prevIndices.filter((i) => i !== index),
      );

      // Mark that user has made changes
      setHasUserMadeChanges(true);
    }
  }, []);

  // Handle data point exclusion/inclusion (toggle)
  const handleExcludeRow = useCallback((index: number) => {
    setExcludedIndices((prevIndices) => {
      if (prevIndices.includes(index)) {
        // Already excluded, so include it back
        return prevIndices.filter((i) => i !== index);
      } else {
        // Not excluded, so exclude it
        return [...prevIndices, index];
      }
    });

    // Mark that user has made changes
    setHasUserMadeChanges(true);
  }, []);

  // Validate and apply lock limits
  // Uses recalculated limits as fallback if user hasn't entered manual values
  const handleLockLimits = () => {
    // Recalculate limits from current edited data as baseline
    const xmrData = calculateXMRFromCurrentState();
    const recalculatedLimits = xmrData.limits;

    // Parse user inputs, fallback to recalculated values
    const parsedAvgX = parseFloat(avgX) || recalculatedLimits.avgX;
    const parsedUnpl = parseFloat(unpl) || recalculatedLimits.UNPL;
    const parsedLnpl = parseFloat(lnpl) || recalculatedLimits.LNPL;
    const parsedAvgMovement =
      parseFloat(avgMovement) || recalculatedLimits.avgMovement;
    const parsedUrl = parseFloat(url) || recalculatedLimits.URL;

    // Comprehensive validation
    // Rule 1: Average must be between lower and upper limits
    if (parsedAvgX < parsedLnpl || parsedAvgX > parsedUnpl) {
      alert(
        "Validation Error:\n\n" +
          "Average X must be between LNPL and UNPL.\n" +
          `Current: Avg X = ${parsedAvgX.toFixed(2)}, ` +
          `LNPL = ${parsedLnpl.toFixed(2)}, ` +
          `UNPL = ${parsedUnpl.toFixed(2)}`,
      );
      return;
    }

    // Rule 2: Average movement must not exceed upper range limit
    if (parsedAvgMovement > parsedUrl) {
      alert(
        "Validation Error:\n\n" +
          "Average Movement must be ≤ URL.\n" +
          `Current: Avg Movement = ${parsedAvgMovement.toFixed(2)}, ` +
          `URL = ${parsedUrl.toFixed(2)}`,
      );
      return;
    }

    // Rule 3: Ensure positive control range
    if (parsedUnpl <= parsedLnpl) {
      alert(
        "Validation Error:\n\n" +
          "UNPL must be greater than LNPL.\n" +
          `Current: UNPL = ${parsedUnpl.toFixed(2)}, ` +
          `LNPL = ${parsedLnpl.toFixed(2)}`,
      );
      return;
    }

    // Calculate quartiles
    const lowerQuartile = (parsedAvgX + parsedLnpl) / 2;
    const upperQuartile = (parsedAvgX + parsedUnpl) / 2;

    // Determine lock type: manual (user made changes) vs auto (accepted auto-detected limits)
    const hasManualLimitModifications = Object.values(isModified).some(
      (v) => v,
    );
    const isManuallyModified =
      hasUserMadeChanges || hasManualLimitModifications;

    onLockLimits(
      {
        avgX: Math.round(parsedAvgX * 100) / 100,
        UNPL: Math.round(parsedUnpl * 100) / 100,
        LNPL: Math.round(parsedLnpl * 100) / 100,
        avgMovement: Math.round(parsedAvgMovement * 100) / 100,
        URL: Math.round(parsedUrl * 100) / 100,
        lowerQuartile: Math.round(lowerQuartile * 100) / 100,
        upperQuartile: Math.round(upperQuartile * 100) / 100,
      },
      isManuallyModified,
      excludedIndices, // Pass the current excluded indices
    );

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[50vw] max-h-[80vh] sm:max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-base sm:text-2xl font-bold truncate pr-2">
              Lock Limits{submetricName ? ` - ${submetricName}` : ""}
            </DialogTitle>
            <Button
              onClick={handleLockLimits}
              size="sm"
              className="h-8 sm:h-9 text-xs sm:text-sm shrink-0"
            >
              Lock Limits
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-3 sm:gap-4 px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Description */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Edit or remove data points below, or manually enter limit values.
              Manual values take precedence. Click the trash icon to exclude
              data points, or the undo icon to include them back.
            </p>
            {outlierIndices.length > 0 && (
              <p className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 sm:p-3 rounded-md border border-amber-200 dark:border-amber-800">
                {isCurrentLimitsManuallyLocked ? (
                  <>
                    📋 {outlierIndices.length} data point
                    {outlierIndices.length !== 1 ? "s" : ""} excluded (shown
                    below). Click the undo icon to include them back
                    individually.
                  </>
                ) : (
                  <>
                    ⚠️ Auto-detected {outlierIndices.length} outlier
                    {outlierIndices.length !== 1 ? "s" : ""} (shown as excluded
                    below). Review and adjust as needed before locking.
                  </>
                )}
              </p>
            )}
          </div>

          {/* Limit Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="avgX" className="text-xs sm:text-sm font-medium">
                Avg X
              </Label>
              <Input
                id="avgX"
                type="number"
                step="0.01"
                value={avgX}
                onChange={(e) => {
                  setAvgX(e.target.value);
                  setIsModified((prev) => ({ ...prev, avgX: true }));
                  setHasUserMadeChanges(true);
                }}
                placeholder={currentLimits.avgX.toString()}
                className={`h-8 sm:h-10 text-xs sm:text-sm ${isModified.avgX ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="unpl" className="text-xs sm:text-sm font-medium">
                <span className="hidden sm:inline">Upper X Limit (UNPL)</span>
                <span className="sm:hidden">UNPL</span>
              </Label>
              <Input
                id="unpl"
                type="number"
                step="0.01"
                value={unpl}
                onChange={(e) => {
                  setUnpl(e.target.value);
                  setIsModified((prev) => ({ ...prev, unpl: true }));
                  setHasUserMadeChanges(true);
                }}
                placeholder={currentLimits.UNPL.toString()}
                className={`h-8 sm:h-10 text-xs sm:text-sm ${isModified.unpl ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="lnpl" className="text-xs sm:text-sm font-medium">
                <span className="hidden sm:inline">Lower X Limit (LNPL)</span>
                <span className="sm:hidden">LNPL</span>
              </Label>
              <Input
                id="lnpl"
                type="number"
                step="0.01"
                value={lnpl}
                onChange={(e) => {
                  setLnpl(e.target.value);
                  setIsModified((prev) => ({ ...prev, lnpl: true }));
                  setHasUserMadeChanges(true);
                }}
                placeholder={currentLimits.LNPL.toString()}
                className={`h-8 sm:h-10 text-xs sm:text-sm ${isModified.lnpl ? "border-red-500" : ""}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label
                htmlFor="avgMovement"
                className="text-xs sm:text-sm font-medium"
              >
                <span className="hidden sm:inline">Avg Movement</span>
                <span className="sm:hidden">Avg Move</span>
              </Label>
              <Input
                id="avgMovement"
                type="number"
                step="0.01"
                value={avgMovement}
                onChange={(e) => {
                  setAvgMovement(e.target.value);
                  setIsModified((prev) => ({ ...prev, avgMovement: true }));
                  setHasUserMadeChanges(true);
                }}
                placeholder={currentLimits.avgMovement.toString()}
                className={`h-8 sm:h-10 text-xs sm:text-sm ${isModified.avgMovement ? "border-red-500" : ""}`}
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="url" className="text-xs sm:text-sm font-medium">
                <span className="hidden sm:inline">
                  Upper Movement Limit (URL)
                </span>
                <span className="sm:hidden">URL</span>
              </Label>
              <Input
                id="url"
                type="number"
                step="0.01"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setIsModified((prev) => ({ ...prev, url: true }));
                  setHasUserMadeChanges(true);
                }}
                placeholder={currentLimits.URL.toString()}
                className={`h-8 sm:h-10 text-xs sm:text-sm ${isModified.url ? "border-red-500" : ""}`}
              />
            </div>
          </div>

          {/* Locked Limits Basis Data Table */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="text-xs sm:text-sm font-medium">
                  Locked Limits Basis:
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  ({editedDataPoints.length - excludedIndices.length} pts
                  {excludedIndices.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      + {excludedIndices.length} excl.
                    </span>
                  )}
                  )
                </span>
              </div>
              <div className="flex gap-2 sm:gap-3">
                {!isAutoLocked &&
                  onResetToAutoLock &&
                  autoDetectedOutliers.length > 0 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleResetToAutoLock}
                      className="h-auto p-0 text-xs sm:text-sm text-green-600 hover:text-green-700"
                    >
                      Reset to Auto
                    </Button>
                  )}
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleResetToOriginal}
                  className="h-auto p-0 text-xs sm:text-sm text-blue-600 hover:text-blue-700"
                >
                  Reset to Original
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] sm:h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Date</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">
                      Value
                    </TableHead>
                    <TableHead className="w-[50px] sm:w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editedDataPoints.map((point, index) => {
                    const isExcluded = excludedIndices.includes(index);
                    const nonExcludedCount =
                      editedDataPoints.length - excludedIndices.length;
                    const canExclude = isExcluded || nonExcludedCount > 3;

                    return (
                      <DataPointRow
                        key={`${point.timestamp}-${index}`}
                        point={point}
                        index={index}
                        timestamp={formatTimestampToDateString(point.timestamp)}
                        onEditValue={handleEditValue}
                        onExclude={handleExcludeRow}
                        canExclude={canExclude}
                        isExcluded={isExcluded}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
