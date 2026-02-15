export { clampInterval, mergeIntervals, buildTimeline, type Interval } from "./timeline";
export {
  resolveDay,
  resolveServiceDays,
  generateSlots,
  computeWindows,
  type ResolvedDay,
  type BlockingAllocation,
  type SlotResult,
  type WindowResult,
} from "./availability";
