// @flow
import {registerEngine} from '@playkit-js/playkit-js';
import {Youtube} from './youtube';

declare var __VERSION__: string;
declare var __NAME__: string;

export {Youtube as Engine};
export {__VERSION__ as VERSION, __NAME__ as NAME};

if (Youtube.isSupported()) {
  registerEngine(Youtube.id, Youtube);
}
