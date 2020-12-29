#!/bin/bash
REPO_PREFIX="@playkit-js/playkit-js-"
HTTP_SUCCESS=false

currentVersion=$(npx -c 'echo "$npm_package_version"')
repoName=$(npx -c 'echo "$npm_package_name"')
packageNameSuffix="${repoName#$REPO_PREFIX}"
echo "$packageNameSuffix"
echo "$currentVersion"

REAL_BRANCH=$(git ls-remote origin | sed -n "\|$TRAVIS_COMMIT\s\+refs/heads/|{s///p}")
echo "$REAL_BRANCH"
UPDATE_UI_CONF=true
if [ "$REAL_BRANCH" = "master" ]; then
  UPDATE_UI_CONF=true
else
  UPDATE_UI_CONF=false
fi

for i in {1..3}; do
  echo "Try number $i for pinging Jenkins...\n"
  HTTP_CODE=$(curl -k -d "{'name':$packageNameSuffix, 'version':$currentVersion, 'source':'npm', 'update_uiconf': $UPDATE_UI_CONF}" -H "Content-Type: application/json" --silent --output /dev/stderr --write-out "%{http_code}" --fail -X POST https://jenkins.ovp.kaltura.com/generic-webhook-trigger/invoke?token=$1)
  STATUS_CODE=$?
  echo "Request return with http code $HTTP_CODE and curl finished with status code $STATUS_CODE"
  if [ "$HTTP_CODE" -eq 200 ] && [ "$STATUS_CODE" -eq 0 ]; then
    HTTP_SUCCESS=true
    break
  fi
done

echo "Jenkins ping success status - $HTTP_SUCCESS"

if [ "$HTTP_SUCCESS" = true ]; then
  exit 0
else
  exit 1
fi
