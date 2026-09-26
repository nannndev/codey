// Flow Radio: generative focus music, synthesised in the browser with Web Audio.
// The station list is tiny and ships with the app; the engine loads on first play.
export { RADIO_STATIONS, type RadioStation, type RadioStationInfo } from "./radio/stations";
import type { FlowRadioEngine } from "./radio/engine";

let engine: FlowRadioEngine | null = null;
let loading: Promise<FlowRadioEngine> | null = null;

export function loadFlowRadio(): Promise<FlowRadioEngine> {
  loading ??= import("./radio/engine").then(({ FlowRadioEngine }) => (engine = new FlowRadioEngine()));
  return loading;
}

/** The engine once loaded, or null before the first play. */
export function flowRadioIfLoaded(): FlowRadioEngine | null {
  return engine;
}
