#!/bin/sh
# https://docs.travis-ci.com/user/customizing-the-build/#Implementing-Complex-Build-Steps
set -ev
 yarn install
 if [ "${TRAVIS_MODE}" = "lint" ]; then
  yarn run eslint
elif [ "${TRAVIS_MODE}" = "flow" ]; then
  yarn run flow
elif [ "${TRAVIS_MODE}" = "unitTests" ]; then
	yarn run test
elif [ "${TRAVIS_MODE}" = "release" ] || [ "${TRAVIS_MODE}" = "releaseCanary" ]; then
  if [ "${TRAVIS_MODE}" = "releaseCanary" ]; then
    echo "Run standard-version"
    sha=$(git rev-parse --verify --short HEAD)
    echo "Current sha ${sha}"
    commitNumberAfterTag=$(git rev-list  `git rev-list --tags --no-walk --max-count=1`..HEAD --count)
    echo "Number of commit from last tag ${commitNumberAfterTag}"
    yarn run release --prerelease canary-${commitNumberAfterTag}-${sha} --skip.commit=true --skip.tag=true
    currentVersion=$(npx -c 'echo "$npm_package_version"')
    echo "Current version ${currentVersion}"
  else
    conventional-github-releaser -p angular -t $GH_TOKEN
  fi
  echo "Building..."
  yarn run build
  echo "Finish building"
elif [ "${TRAVIS_MODE}" = "deploy" ]; then
  echo "Deploy..."
else
	echo "Unknown travis mode: ${TRAVIS_MODE}" 1>&2
	exit 1
fi
