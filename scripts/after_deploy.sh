#!/bin/bash
currentVersion=$(npx -c 'echo "$npm_package_version"')
repoName=$(npx -c 'echo "$npm_package_name"')
repoPrefix="@playkit-js/playkit-js-"
packageNameSuffix="${repoName#$repoPrefix}"
echo $packageNameSuffix
echo $currentVersion
HTTPCODE=$(curl -k -d "{'name':$packageNameSuffix, 'version':$currentVersion, 'source':'npm', 'update_uiconf': $2}" -H "Content-Type: application/json" --silent --output /dev/stderr --write-out "%{http_code}" --fail -X POST https://jenkins.ovp.kaltura.com/generic-webhook-trigger/invoke?token=$1)
STATUSCODE=$?
if [ $HTTPCODE -ne 200 ] || [ $STATUSCODE -ne 0 ]; then
  exit 1
fi
