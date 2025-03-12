import { BasePlugin, KalturaPlayer } from '@playkit-js/kaltura-player-js';

const YT_CHAPTER_TYPE: string = 'YouTubeClipChapter';

class YouTubePlugin extends BasePlugin {
  constructor(name: string, player: KalturaPlayer, config: any) {
    super(name, player, config);
  }

  public get timelineManager(): any {
    return this.player.getService('timeline');
  }

  public static isValid(): boolean {
    return true;
  }

  public loadMedia(): void {
    this.eventManager.listenOnce(this.player, this.player.Event.Core.SOURCE_SELECTED, () => {
      if (this.player.engineType === this.player.EngineType.YOUTUBE && this.timelineManager) {
        const {seekFrom, clipTo, duration} = this.player.config.sources;
        const isClipToValid = !!(clipTo && duration && clipTo < duration);
        if (seekFrom || isClipToValid) {
          this.timelineManager.disableChapters();
          if (seekFrom) {
            this.timelineManager.addKalturaCuePoint(seekFrom, YT_CHAPTER_TYPE, 0);
          }
          if (isClipToValid) {
            this.timelineManager.addKalturaCuePoint(clipTo, YT_CHAPTER_TYPE, 1);
          }
        }
      }
    });
  }

  public reset(): void {}

  public destroy(): void {}
}

export { YouTubePlugin };
