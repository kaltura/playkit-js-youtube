// @flow
import { registerEngine } from "@playkit-js/playkit-js";
import { Youtube } from "./youtube";
import "./style.css";
import {registerPlugin} from "@playkit-js/kaltura-player-js";
import {YouTubePlugin} from "./youtube-plugin";

declare var __VERSION__: string;
declare var __NAME__: string;

const VERSION = __VERSION__;
const NAME = __NAME__;

export { Youtube as Engine };
export { VERSION, NAME };
export {YouTubePlugin as Plugin};

const pluginName: string = 'youtube';
registerPlugin(pluginName, YouTubePlugin);

if (Youtube.isSupported()) {
  registerEngine(Youtube.id, Youtube);
}
