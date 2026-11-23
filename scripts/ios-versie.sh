#!/bin/sh
# Buildstap "Versie uit git" van de iOS-app (ios/App/App.xcodeproj): zet de
# versie in de Info.plist van de gebouwde app, net als android/app/build.gradle.
# Op de tag v0.6 "0.6 (<hash>)", twaalf commits later "0.6+12 (<hash>)", zonder
# tag "0.<aantal commits> (<hash>)". CFBundleVersion wordt het aantal commits.
# Zonder git blijft alles zoals in het project.
set -e
plist="$TARGET_BUILD_DIR/$INFOPLIST_PATH"
cd "$SRCROOT"
count=$(git rev-list --count HEAD 2>/dev/null) || exit 0
hash=$(git rev-parse --short HEAD)
describe=$(git describe --tags --long --match 'v[0-9]*' 2>/dev/null || true)
if [ -n "$describe" ]; then
  tag=$(echo "$describe" | sed -E 's/^v(.+)-([0-9]+)-g[0-9a-f]+$/\1/')
  since=$(echo "$describe" | sed -E 's/^v(.+)-([0-9]+)-g[0-9a-f]+$/\2/')
  if [ "$since" = "0" ]; then versie="$tag"; else versie="$tag+$since"; fi
else
  versie="0.$count"
fi
/usr/libexec/PlistBuddy -c "Delete :FluistervinkVersie" "$plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :FluistervinkVersie string $versie ($hash)" "$plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $count" "$plist"
