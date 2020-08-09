// @flow
import { registerEngine } from "@playkit-js/playkit-js";
import { Youtube } from "./youtube";
import "./style.css";

declare var __VERSION__: string;
declare var __NAME__: string;

const VERSION = __VERSION__;
const NAME = __NAME__;

export { Youtube as Engine };
export { VERSION, NAME };

if (Youtube.isSupported()) {
  registerEngine(Youtube.id, Youtube);
}
