# PlayKit JS YouTube - YouTube Engine for the [PlayKit JS Player]

[![Build Status](https://travis-ci.com/kaltura/playkit-js-youtube.svg?branch=master)](https://travis-ci.com/kaltura/playkit-js-youtube)[![](https://img.shields.io/npm/v/@playkit-js/playkit-js-youtube/latest.svg)]([NPM])[![](https://img.shields.io/npm/v/@playkit-js/playkit-js-youtube/canary.svg)]([NPM_CANARY])

PlayKit JS YouTube Engine integrates youtube with the [PlayKit JS Player].
 
PlayKit JS YouTube is written in [ECMAScript6], statically analysed using [Flow] and transpiled in ECMAScript5 using [Babel].

[YouTube Iframe API]: https://developers.google.com/youtube/iframe_api_reference
[Flow]: https://flow.org/
[ECMAScript6]: https://github.com/ericdouglas/ES6-Learning#articles--tutorials
[Babel]: https://babeljs.io
[NPM]: https://www.npmjs.com/package/@playkit-js/playkit-js-youtube
[NPM_CANARY]: https://www.npmjs.com/package/@playkit-js/playkit-js-youtube/v/canary

## Getting Started

### Prerequisites
The adapter requires [PlayKit JS Player] to be loaded first.

The engine uses the [YouTube Iframe API] javascript library.

[Playkit JS Player]: https://github.com/kaltura/playkit-js

### Installing

First, clone and run [yarn] to install dependencies:

[yarn]: https://yarnpkg.com/lang/en/

```
git clone https://github.com/kaltura/playkit-js-youtube.git
cd playkit-js-youtube
yarn install
```

### Building

Then, build the player

```javascript
yarn run build
```

### Embed the library in your test page

Finally, add the bundle as a script tag in your page, and initialize the player

```html
<script type="text/javascript" src="/PATH/TO/FILE/playkit.js"></script>
<script type="text/javascript" src="/PATH/TO/FILE/playkit-youtube.js"></script>
<div id="player-placeholder"" style="height:360px; width:640px">
<script type="text/javascript">
var playerContainer = document.querySelector("#player-placeholder");
var config = {...};
var player = playkit.core.loadPlayer(config);
playerContainer.appendChild(player.getView());
player.play();
</script>
```

## Configuration

[YouTube Iframe API] configuration options, can be passed via the [PlayKit JS Player] config.

The configuration is exposed via the playback section:

```javascript
{
  playback:{
    options: {
      youtube: {
        // YouTube Iframe configuration options here
      }
    }
  }
}
``` 

## Running the tests

Tests can be run locally via [Karma], which will run on Chrome, Firefox and Safari

[Karma]: https://karma-runner.github.io/1.0/index.html
```
yarn run test
```

You can test individual browsers:
```
yarn run test:chrome
yarn run test:firefox
yarn run test:safari
```

### And coding style tests

We use ESLint [recommended set](http://eslint.org/docs/rules/) with some additions for enforcing [Flow] types and other rules.

See [ESLint config](.eslintrc.json) for full configuration.

We also use [.editorconfig](.editorconfig) to maintain consistent coding styles and settings, please make sure you comply with the styling.


## Compatibility

TBD

## Contributing

Please read [CONTRIBUTING.md](https://gist.github.com/PurpleBooth/b24679402957c63ec426) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/kaltura/playkit-js-youtube/tags). 

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE.md](LICENSE.md) file for details
