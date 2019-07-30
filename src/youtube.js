//@flow
import {EventManager, FakeEventTarget, FakeEvent, EventType, Error} from '@playkit-js/playkit-js';
import {Track, VideoTrack, AudioTrack, TextTrack as PKTextTrack} from '@playkit-js/playkit-js';
import {Utils, getLogger} from '@playkit-js/playkit-js';

const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

const YOUTUBE_MIMETYPE = 'video/youtube';

const TIME_INTERVAL_TIMEOUT = 250;

const DEFAULT_PLAYER_VARS: {[var: string]: number | string} = {
  controls: 0,
  autoplay: 0,
  origin: window.location.origin,
  iv_load_policy: 3,
  disablekb: 1,
  modestbranding: 1,
  playsinline: 1,
  rel: 0,
  fs: 0
};

/**
 * Youtube engine for playback.
 * @classdesc
 */
class Youtube extends FakeEventTarget implements IEngine {
  /**
   * The video element.
   * @type {HTMLVideoElement}
   * @private
   */
  _el: HTMLVideoElement;
  /**
   * The event manager of the engine.
   * @type {EventManager}
   * @private
   */
  _eventManager: EventManager;

  /**
   * The player config object.
   * @type {Object}
   * @private
   */
  _config: Object;

  /**
   * weather bitrate is adaptive or discrete
   * @type {boolean}
   * @private
   */
  _isAdaptiveBitrate: boolean = true;

  _source: PKMediaSourceObject;

  _api: Object;

  _sdkLoaded: Promise<*>;

  _apiReady: Function;

  _apiError: Function;

  _loaded: boolean = false;

  _isSeeking: boolean = false;

  _firstPlaying: boolean = true;

  _currentState: number | null = null;

  _playerTracks: Array<Track> = [];

  /**
   * The Youtube class logger.
   * @type {any}
   * @static
   * @private
   */
  static _logger: any = getLogger('Youtube');

  /**
   * @type {string} - The engine id.
   * @public
   * @static
   */
  static id: string = 'youtube';

  static isSupported(): boolean {
    return true;
  }

  /**
   * Factory method to create an engine.
   * @param {PKMediaSourceObject} source - The selected source object.
   * @param {Object} config - The player configuration.
   * @returns {IEngine} - New instance of the run time engine.
   * @public
   * @static
   */
  static createEngine(source: PKMediaSourceObject, config: Object): IEngine {
    return new this(source, config);
  }

  /**
   * Checks if the engine can play a given source.
   * @param {PKMediaSourceObject} source - The source object to check.
   * @returns {boolean} - Whether the engine can play the source.
   * @public
   * @static
   */
  static canPlaySource(source: PKMediaSourceObject): boolean {
    let canPlayType = typeof source.mimetype === 'string' ? source.mimetype.toLowerCase() === YOUTUBE_MIMETYPE : false;
    Youtube._logger.debug('canPlayType result for mimeType: ' + source.mimetype + ' is ' + canPlayType.toString());
    return canPlayType;
  }

  /**
   * Runs the Youtube capabilities tests.
   * @returns {void}
   * @public
   * @static
   */
  static runCapabilities(): void {}

  /**
   * Gets the youtube capabilities.
   * @return {Promise<Object>} - The Youtube capabilities object.
   * @public
   * @static
   */
  static getCapabilities(): Promise<Object> {
    let dataSaver = false;
    if ("connection" in navigator && navigator.connection) {
      // $FlowFixMe
      dataSaver = !!navigator.connection.saveData;
    }
    const capabilities = {
      [Youtube.id]: {
        autoplay: false,
        mutedAutoPlay: !dataSaver
      }
    };
    return Promise.resolve(capabilities);
  }

  /**
   * For browsers which block auto play, use the user gesture to open the video element and enable playing via API.
   * @returns {void}
   * @private
   * @public
   */
  static prepareVideoElement(): void {
    Youtube._logger.debug('Prepare the video element for playing not supported');
  }

  /**
   * The player playback rates.
   * @type {Array<number>}
   */
  static PLAYBACK_RATES: Array<number> = [1];

  /**
   * @constructor
   * @param {PKMediaSourceObject} source - The selected source object.
   * @param {Object} config - The player configuration.
   */
  constructor(source: PKMediaSourceObject, config: Object) {
    super();
    this._eventManager = new EventManager();
    this._createVideoElement();
    this._init(source, config);
  }

  /**
   * Restores the engine.
   * @param {PKMediaSourceObject} source - The selected source object.
   * @param {Object} config - The player configuration.
   * @returns {void}
   */
  restore(source: PKMediaSourceObject, config: Object): void {
    this.reset();
    this._init(source, config);
  }

  /**
   * shared reset of the engine.
   * @returns {void}
   * @private
   */
  _reset(): void {
    this._stopSeekTargetWatchDog();
    this._stopPlayingWatchDog();
    this.detach();
    if (this._playerReady()) {
      this._api.stopVideo && this._api.stopVideo();
    }
    this._loaded = false;
    this._firstPlaying = true;
    this._isSeeking = false;
    this._isAdaptiveBitrate = true;
    this._playerTracks = [];
    this._currentState = null;
  }

  /**
   * Resets the engine.
   * @returns {void}
   */
  reset(): void {
    this._reset();
    this._eventManager.removeAll();
  }

  /**
   * Destroys the engine.
   * @public
   * @returns {void}
   */
  destroy(): void {
    this._reset();
    if (this._api) {
      this._api.destroy && this._api.destroy();
    }
    this._eventManager.destroy();
  }

  /**
   * Get the engine's id
   * @public
   * @returns {string} the engine's id
   */
  get id(): string {
    return Youtube.id;
  }

  /**
   * Listen to the video  events and triggers them from the engine.
   * @public
   * @returns {void}
   */
  attach(): void {}

  /**
   * Remove the listeners of the video element events.
   * @public
   * @returns {void}
   */
  detach(): void {}

  /**
   * @returns {HTMLVideoElement} - The video element.
   * @public
   */
  getVideoElement(): HTMLVideoElement {
    return this._el;
  }

  /**
   * Select a new video track.
   * @param {VideoTrack} videoTrack - The video track object to set.
   * @returns {void}
   */
  selectVideoTrack(videoTrack: VideoTrack): void {
    if (this._api) {
      if (videoTrack instanceof VideoTrack && (!videoTrack.active || this.isAdaptiveBitrateEnabled()) ) {
        if (this.isAdaptiveBitrateEnabled()) {
          this.dispatchEvent(EventType.ABR_MODE_CHANGED, {mode: 'manual'});
        }
        this._isAdaptiveBitrate = false;
        this._api.setPlaybackQuality(videoTrack.label);
      }
    }
  }

  /**
   * Select a new audio track.
   * @param {AudioTrack} audioTrack - The video track object to set.
   * @returns {void}
   */
  selectAudioTrack(audioTrack: AudioTrack): void {
    Youtube._logger.info(`audio track switching not supported, cannot switch to ` + audioTrack.language);
  }

  /**
   * Select a new text track.
   * @param {PKTextTrack} textTrack - The playkit text track object to set.
   * @returns {void}
   */
  selectTextTrack(textTrack: PKTextTrack): void {
    Youtube._logger.info(`text track switching not supported, cannot switch to ` + textTrack.language);
  }

  /**
   * Hide the text track
   * @function hideTextTrack
   * @returns {void}
   * @public
   */
  hideTextTrack(): void {}

  /**
   * Enables adaptive bitrate switching according to the media source extension logic.
   * @function enableAdaptiveBitrate
   * @returns {void}
   * @public
   */
  enableAdaptiveBitrate(): void {
    if (this._api) {
      this._api.setPlaybackQuality('default');
      this._isAdaptiveBitrate = true;
    }
  }

  /**
   * Checking if adaptive bitrate switching is enabled.
   * @function isAdaptiveBitrateEnabled
   * @returns {boolean} - Whether adaptive bitrate is enabled.
   * @public
   */
  isAdaptiveBitrateEnabled(): boolean {
    return this._isAdaptiveBitrate;
  }

  /**
   * Seeking to live edge.
   * @function seekToLiveEdge
   * @returns {void}
   * @public
   */
  seekToLiveEdge(): void {}

  attachMediaSource(): void {}

  detachMediaSource(): void {}

  /**
   * Get the start time of DVR window in live playback in seconds.
   * @returns {Number} - start time of DVR window.
   * @public
   */
  getStartTimeOfDvrWindow(): number {
    return 0;
  }

  /**
   * Checking if the current playback is live.
   * @function isLive
   * @returns {boolean} - Whether playback is live.
   * @public
   */
  isLive(): boolean {
    return false;
  }

  /**
   * Start/resume playback.
   * @public
   * @returns {void}
   */
  play(): void {
    if (this._api) {
      if (this.currentTime === this.duration) {
        this.currentTime = 0;
      }
      this._api.playVideo();
    }
  }

  /**
   * Pause playback.
   * @public
   * @returns {void}
   */
  pause(): void {
    if (this._api) {
      this._api.pauseVideo();
    }
  }

  /**
   * Load media.
   * @param {number} startTime - Optional time to start the video from.
   * @public
   * @returns {Promise<Object>} - The loaded data
   */
  load(startTime: ?number): Promise<Object> {
    this._sdkLoaded
      .then(() => {
        //TODO: if autoplay pass it here and check in play if already playing?
        const loadOptions = {
          videoId: this._source.url,
          startSeconds: (startTime && startTime > 0) ? startTime : 0
        };
        this._api.cueVideoById(loadOptions);
        this._loaded = true;
      })
      .catch(error => {
        return Promise.reject(error);
      });
    this._videoLoaded = {};
    this._videoLoaded.promise = new Promise((resolve, reject) => {
      this._videoLoaded.resolve = resolve;
      this._videoLoaded.reject = reject;
    });
    return this._videoLoaded.promise;
  }

  _playerReady(): boolean {
    return !!(this._api && this._loaded);
  }

  /**
   * Parse youtube video tracks into player video tracks.
   * @returns {Array<VideoTrack>} - The parsed video tracks.
   * @private
   */
  _parseVideoTracks(): Array<VideoTrack>{
    const levels: Array<string> = this._api.getAvailableQualityLevels();
    const currentLevel: string = this._api.getPlaybackQuality();
    const videoTracks = [];
    levels.forEach((level, i) => {
      let settings = {
        active: currentLevel === level,
        label: level,
        bandwidth: 0,
        width: i+1, //TODO: get estimated width and height from https://developers.google.com/youtube/iframe_api_reference#Playback_quality
        height: i+1,
        language: '',
        index: i
      };
      videoTracks.push(new VideoTrack(settings));
    });
    return videoTracks;
  }

  /**
   * Set a source.
   * @param {string} source - Source to set.
   * @public
   * @returns {void}
   */
  set src(source: string): void {
    this._source.url = source;
  }

  /**
   * Get the source url.
   * @returns {string} - The source url.
   * @public
   */
  get src(): string {
    return (this._loaded && this._source) ? this._source.url: "";
  }

  /**
   * Get the current time in seconds.
   * @returns {Number} - The current playback time.
   * @public
   */
  get currentTime(): number {
    return this._playerReady() ? this._api.getCurrentTime() : 0;
  }

  /**
   * Set the current time in seconds.
   * @param {Number} to - The number to set in seconds.
   * @public
   * @returns {void}
   */
  set currentTime(to: number): void {
    if (this._api) {
      if (this.currentTime !== to) {
        this._isSeeking = true;
        this._api.seekTo(to, true);
        this.dispatchEvent(new FakeEvent(EventType.SEEKING));
        if (this.paused) {
          this._startSeekTargetWatchDog();
        }
      }
    }
  }

  _startSeekTargetWatchDog() {
    const previousTime = this.currentTime;
    this._stopSeekTargetWatchDog();
    this._seekTargetIntervalId = setInterval(() => {
      if (!this.paused || !this._isSeeking) {
        this._stopSeekTargetWatchDog();
      } else if (this.currentTime !== previousTime) {
        this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
        this.dispatchEvent(new FakeEvent(EventType.SEEKED));
        this._isSeeking = false;
      }
    }, TIME_INTERVAL_TIMEOUT);
  }

  _stopSeekTargetWatchDog() {
    clearInterval(this._seekTargetIntervalId);
    this._seekTargetIntervalId = null;
  }

  /**
   * Get the duration in seconds.
   * @returns {Number} - The playback duration.
   * @public
   */
  get duration(): number {
    return this._playerReady() ? this._api.getDuration() : NaN;
  }

  /**
   * Set playback volume.
   * @param {Number} vol - The volume to set.
   * @public
   * @returns {void}
   */
  set volume(vol: number): void {
    this._playerReady() && this._api.setVolume(vol * 100);
  }

  /**
   * Get playback volume.
   * @returns {Number} - The volume value of the video element.
   * @public
   */
  get volume(): number {
    return this._playerReady() ? this._api.getVolume() / 100 : 1;
  }

  /**
   * Get paused state.
   * @returns {boolean} - The paused value of the video element.
   * @public
   */
  get paused(): boolean {
    if (this._playerReady()) {
      return ![window.YT.PlayerState.PLAYING, window.YT.PlayerState.BUFFERING].includes(this._api.getPlayerState());
    } else {
      return true;
    }
  }

  /**
   * Get seeking state.
   * @returns {boolean} - The seeking value of the video element.
   * @public
   */
  get seeking(): boolean {
    return this._isSeeking;
  }

  /**
   * Get the first seekable range (part) of the video in seconds.
   * @returns {TimeRanges} - First seekable range (part) of the video in seconds.
   * @public
   */
  get seekable(): any {
    return {
      length: 1,
      start: () => {
        return 0;
      },
      end: () => {
        return this._api? this.currentTime : 0;
      }
    };
  }

  /**
   * Get the first played range (part) of the video in seconds.
   * @returns {TimeRanges} - First played range (part) of the video in seconds.
   * @public
   */
  get played(): any {
    return {
      length: 1,
      start: () => {
        return 0;
      },
      end: () => {
        return this._api? this.currentTime : 0;
      }
    };
  }

  /**
   * Get the first buffered range (part) of the video in seconds.
   * @returns {TimeRanges} - First buffered range (part) of the video in seconds.
   * @public
   */
  get buffered(): any {
    return {
      length: 1,
      start: () => {
        return 0;
      },
      end: () => {
        return this._api? this._api.getVideoLoadedFraction() * this.duration : 0;
      }
    };
  }

  /**
   * Set player muted state.
   * @param {boolean} mute - The new mute value.
   * @public
   * @returns {void}
   */
  set muted(mute: boolean): void {
    if (this._playerReady()) {
      mute ?
        this._api.mute() :
        this._api.unMute();
      this._muted = mute;
    }
  }

  /**
   * Get player muted state.
   * @returns {boolean} - The muted value of the video element.
   * @public
   */
  get muted(): boolean {
    let muted = false;
    if (this._playerReady()) {
      muted = (typeof this._muted === 'boolean') ? this._muted : this._api.isMuted();
    }
    return muted;
  }

  /**
   * Get the default mute value.
   * @returns {boolean} - The defaultMuted of the video element.
   * @public
   */
  get defaultMuted(): boolean {
    return false;
  }

  /**
   * Sets an image to be shown while the video is downloading, or until the user hits the play button.
   * @param {string} poster - The image url to be shown.
   * @returns {void}
   * @public
   */
  set poster(poster: string): void {}

  /**
   * Gets an image to be shown while the video is downloading, or until the user hits the play button.
   * @returns {poster} - The image url.
   * @public
   */
  get poster(): string {
    return '';
  }

  /**
   * Specifies if and how the author thinks that the video should be loaded when the page loads.
   * @param {string} preload - The preload value.
   * @public
   * @returns {void}
   */
  set preload(preload: string): void {}

  /**
   * Gets the preload value of the video element.
   * @returns {string} - The preload value.
   * @public
   */
  get preload(): string {
    return 'none';
  }

  /**
   * Set if the video will automatically start playing as soon as it can do so without stopping.
   * @param {boolean} autoplay - The autoplay value.
   * @public
   * @returns {void}
   */
  set autoplay(autoplay: boolean): void {}

  /**
   * Gets the autoplay value of the video element.
   * @returns {boolean} - The autoplay value.
   * @public
   */
  get autoplay(): boolean {
    return false;
  }

  /**
   * Set to specifies that the video will start over again, every time it is finished.
   * @param {boolean} loop - the loop value.
   * @public
   * @returns {void}
   */
  set loop(loop: boolean) {}

  /**
   * Gets the loop value of the video element.
   * @returns {boolean} - The loop value.
   * @public
   */
  get loop(): boolean {
    return false;
  }

  /**
   * Set to specifies that video controls should be displayed.
   * @param {boolean} controls - the controls value.
   * @public
   * @returns {void}
   */
  set controls(controls: boolean): void {}

  /**
   * Gets the controls value of the video element.
   * @returns {boolean} - The controls value.
   * @public
   */
  get controls(): boolean {
    return false;
  }

  /**
   * Sets the current playback speed of the audio/video.
   * @param {Number} playbackRate - The playback speed value.
   * @public
   * @returns {void}
   */
  set playbackRate(playbackRate: number): void {
    if (this._api) {
      this._api.setPlaybackRate(playbackRate);
    }
  }

  /**
   * Gets the current playback speed of the audio/video.
   * @returns {Number} - The current playback speed value.
   * @public
   */
  get playbackRate(): number {
    return this._playerReady() ? this._api.getPlaybackRate() : 1;
  }

  /**
   * Sets the default playback speed of the audio/video.
   * @param {Number} defaultPlaybackRate - The default playback speed value.
   * @public
   * @returns {void}
   */
  set defaultPlaybackRate(defaultPlaybackRate: number) {}

  /**
   * Gets the default playback speed of the audio/video.
   * @returns {Number} - The default playback speed value.
   * @public
   */
  get defaultPlaybackRate(): number {
    return 1;
  }

  /**
   * The ended property returns whether the playback of the audio/video has ended.
   * @returns {boolean} - The ended value.
   * @public
   */
  get ended(): boolean {
    return this._playerReady() ? this._api.getPlayerState() === window.YT.PlayerState.ENDED : false;
  }

  /**
   * The error property returns a MediaError object.
   * @returns {MediaError} - The MediaError object has a code property containing the error state of the audio/video.
   * @public
   */
  get error(): ?MediaError {
    return null;
  }

  /**
   * @returns {Number} - The current network state (activity) of the audio/video.
   * @public
   */
  get networkState(): number {
    if (!(this._playerReady())) {
      return 0;
    }
    const playerState = window.YT.PlayerState;
    switch (this._api.getPlayerState()) {
      case playerState.UNSTARTED:
        return 0;
      case playerState.BUFFERING:
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Indicates if the audio/video is ready to play or not.
   * @returns {Number} - The current ready state of the audio/video.
   * 0 = HAVE_NOTHING - no information whether or not the audio/video is ready.
   * 1 = HAVE_METADATA - metadata for the audio/video is ready.
   * 2 = HAVE_CURRENT_DATA - data for the current playback position is available, but not enough data to play next frame/millisecond.
   * 3 = HAVE_FUTURE_DATA - data for the current and at least the next frame is available.
   * 4 = HAVE_ENOUGH_DATA - enough data available to start playing.
   */
  get readyState(): number {
    if (!this._api) {
      return 0;
    }
    const playerState = window.YT.PlayerState;
    switch (this._api.getPlayerState()) {
      case playerState.UNSTARTED:
        return 0;
      case playerState.BUFFERING:
        return 2;
      default:
        return 4;
    }
  }

  /**
   * @returns {Number} - The height of the video player, in pixels.
   * @public
   */
  get videoHeight(): number {
    return -1;
  }

  /**
   * @returns {Number} - The width of the video player, in pixels.
   * @public
   */
  get videoWidth(): number {
    return -1;
  }

  /**
   * @param {boolean} playsinline - Whether to set on the video tag the playsinline attribute.
   */
  set playsinline(playsinline: boolean): void {}

  /**
   * @returns {boolean} - Whether the video tag has an attribute of playsinline.
   */
  get playsinline(): boolean {
    return this._config.playsinline;
  }

  /**
   * Set crossOrigin attribute.
   * @param {?string} crossOrigin - 'anonymous' or 'use-credentials'
   */
  set crossOrigin(crossOrigin: ?string): void {}

  /**
   * Get crossOrigin attribute.
   * @returns {?string} - 'anonymous' or 'use-credentials'
   */
  get crossOrigin(): ?string {
    return null;
  }

  /**
   * get the playback rates
   * @return {number[]} - playback rates
   */
  get playbackRates(): Array<number> {
    let playbackRates = Youtube.PLAYBACK_RATES;
    if (this._playerReady()) {
      const rates = this._api.getAvailablePlaybackRates();
      if (rates && Array.isArray(rates)) {
        playbackRates = rates;
      }
    }
    return playbackRates;
  }

  /**
   * Initializes the engine.
   * @param {PKMediaSourceObject} source - The selected source object.
   * @param {Object} config - The player configuration.
   * @private
   * @returns {void}
   */
  _init(source: PKMediaSourceObject, config: Object): void {
    this._source = source;
    this._config = config;
    const dispatchError = e => {
      const error = new Error(Error.Severity.CRITICAL, Error.Category.PLAYER, Error.Code.LOAD_FAILED, e);
      this.dispatchEvent(new FakeEvent(EventType.ERROR, error));
    };
    this._sdkLoaded = new Promise((resolve, reject) => {
      this._apiReady = () => {
        if (this._config.playback.muted || this._config.playback.autoplay) {
          this._api.mute && this._api.mute();
          this._muted = true;
        }
        resolve();
      };
      this._apiError = (e) => {
        const error = this._getYoutubeErrorCodeData(e.data);
        dispatchError(error);
        reject(e.data);
      };
    });
    this._loadYouTubeIframeAPI().then(() => {
      this._loadYouTubePlayer();
    }).catch(e => {
      dispatchError(e);
    });
  }

  _createVideoElement() {
    const el = (this._el = Utils.Dom.createElement('div'));
    Utils.Dom.setAttribute(el, 'id', Utils.Generator.uniqueId(5));
    Utils.Dom.setAttribute(el, 'tabindex', '-1');
  }

  _getYoutubeErrorCodeData(errorNumber: number): {code: number, message: string} {
    switch (errorNumber) {
      case 2:
        return { code: errorNumber, message: 'Invalid params' };
      case 5:
        return { code: errorNumber, message: 'Error while trying to play the video' };
      case 100:
        return { code: errorNumber, message: 'Video not found' };
      case 101:
      case 150:
        return {
          code: errorNumber,
          message: 'The owner of the requested video does not allow it to be played in embedded players'
        };
      default:
        return {
          code: errorNumber,
          message: 'Unknown error'
        };
    }
  }

  /**
   * Loads the YouTube player.
   * @private
   * @returns {void}
   */
  _loadYouTubePlayer(): void {
    const loadYouTubePlayer = () => {
      const config = {
        playerVars: DEFAULT_PLAYER_VARS,
        events: {
          onReady: this._apiReady,
          onError: this._apiError,
          onStateChange: e => this._onPlayerStateChange(e),
          onPlaybackQualityChange: e => this._onPlaybackQualityChange(e),
          onVolumeChange: () => this.dispatchEvent(new FakeEvent(EventType.VOLUME_CHANGE))
        }
      };
      config.playerVars.playsinline = this._config.playback.playsinline ? 1 : 0;
      config.playerVars.autoplay = this._config.playback.autoplay ? 1 : 0;
      if (Utils.Object.hasPropertyPath(this._config, 'playback.options.youtube')) {
        const youtubeConfig = this._config.playback.options.youtube;
        Utils.Object.mergeDeep(config.playerVars, youtubeConfig.playerVars);
      }
      this._api = new window.YT.Player(this._el.id, config);
    };
    if (this._api) {
      return this._apiReady();
    }
    if (window && window.YT && window.YT.Player) {
      loadYouTubePlayer();
    } else {
      window.onYouTubeIframeAPIReady = loadYouTubePlayer;
    }
  }

  /**
   * Load YouTube IFrame API element dom object.
   * @private
   * @returns {void}
   */
  _loadYouTubeIframeAPI(): Promise<> {
    return new Promise((resolve, reject) => {
      if (window && window.YT && window.YT.Player) {
        return resolve();
      }
      const tag = Utils.Dom.createElement('script');
      let url = YOUTUBE_IFRAME_API_URL;
      if (Utils.Object.hasPropertyPath(this._config, 'playback.options.youtube')) {
        if (this._config.playback.options.youtube.iframeApi) {
          url = this._config.playback.options.youtube.iframeApi;
        }
      }
      tag.src = url;
      tag.async = true;
      tag.onload = () => {
        resolve();
      };
      tag.onerror = () => {
        reject({message: "Youtube Iframe API loading failed: " + url});
      };
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    });
  }

  _getPlayerStateKey(state: number | null): string {
    const playerState = window.YT.PlayerState;
    return Object.keys(playerState).find(key => playerState[key] === state) || "UNKNOWN";
  }

  _onPlayerStateChange(event: any): void {
    const playerState = window.YT.PlayerState;
    const newState = event.data;
    Youtube._logger.info(`player state changed from ${this._getPlayerStateKey(this._currentState)} to ${this._getPlayerStateKey(newState)}`);
    if (newState === this._currentState) {
      return;
    }
    this._currentState = newState;

    switch( this._currentState ){
      case playerState.UNSTARTED:
        this._handleLoaded();
        break;
      case playerState.ENDED:
        this._onEnded();
        break;
      case playerState.PLAYING:
        if (this._firstPlaying) {
          this._handleFirstPlaying();
        }
        this._onPlaying();
        break;
      case playerState.PAUSED:
        this._onPaused();
        break;
      case playerState.BUFFERING:
        this._onBuffering();
        break;
      case playerState.CUED:
        break;
    }
  }

  _onPlaybackQualityChange(event: any): void {
    let videoTrack = this._playerTracks.find(track => {
      return track instanceof VideoTrack && track.label === event.data;
    });
    this.dispatchEvent(EventType.VIDEO_TRACK_CHANGED, {selectedVideoTrack: videoTrack})
  }

  _onPlaying() {
    this.dispatchEvent(new FakeEvent(EventType.PLAY));
    this.dispatchEvent(new FakeEvent(EventType.PLAYING));
    this._startPlayingWatchDog();
    if (this._isSeeking) {
      this._isSeeking = false;
      this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
      this.dispatchEvent(new FakeEvent(EventType.SEEKED));
    }
  }

  _handleLoaded() {
    if (this._loaded) {
      this.dispatchEvent(new FakeEvent(EventType.LOADED_METADATA));
      this._videoLoaded.resolve({tracks: this._playerTracks});
    }
  }

  _handleFirstPlaying() {
    this._firstPlaying = false;
    this.dispatchEvent(new FakeEvent(EventType.DURATION_CHANGE));
  }

  _onBuffering() {
    this._stopPlayingWatchDog();
    this.dispatchEvent(new FakeEvent(EventType.WAITING));
  }

  _onPaused() {
    if (this._isSeeking) {
      this._isSeeking = false;
    }
    this._stopPlayingWatchDog();
    this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
    this.dispatchEvent(new FakeEvent(EventType.PAUSE));
  }

  _onEnded() {
    this._stopPlayingWatchDog();
    this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
    this.dispatchEvent(new FakeEvent(EventType.PAUSE));
    this.dispatchEvent(new FakeEvent(EventType.ENDED));
  }

  _startPlayingWatchDog() {
    this._stopPlayingWatchDog();
    this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
    this._playingIntervalId = setInterval(() => {
      if (!this._isSeeking) {
        this.dispatchEvent(new FakeEvent(EventType.TIME_UPDATE));
      }
    }, TIME_INTERVAL_TIMEOUT);
  }

  _stopPlayingWatchDog() {
    clearInterval(this._playingIntervalId);
    this._playingIntervalId = null;
  }

  resetAllCues(): void {}
  enterPictureInPicture(): void {}
  exitPictureInPicture(): void {}
  isPictureInPictureSupported(): boolean {
    return false;
  }
  get isInPictureInPicture(): boolean {
    return false;
  }

  get targetBuffer(): number {
    return NaN;
  }

  get availableBuffer(): number {
    return NaN;
  }
}

export {Youtube}
