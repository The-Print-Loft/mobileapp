# Local setup & machine transfer

Getting the app building on a fresh Mac. These are the non-obvious steps — the ones that
cost hours the first time.

## First run

```bash
cd mobileapp
npm ci                              # NOT `npm install` — see "Version pinning" below
LANG=en_US.UTF-8 npx expo run:ios   # builds, installs, and starts Metro
```

`LANG=en_US.UTF-8` avoids a Ruby/CocoaPods encoding error. `expo run:ios` starts Metro
itself; if you ever need it standalone: `LANG=en_US.UTF-8 npx expo start`.

## Local-only files

**None.** The app runs entirely from committed config (staging API + Stripe test key) —
no `.env`, no secrets to copy. `git clone` + `npm ci` is the whole story.

(The sibling repos *do* have local-only files:
`api/postman/Prodigi *.postman_environment.json` — Prodigi keys — and `web/.env`.)

## GitHub auth (for the private sibling repos)

`mobileapp` is **public**; `api` and `web` are **private**. A fresh machine can clone
`mobileapp` with no credentials, but the private repos return "Repository not found"
until you authenticate:

```bash
gh auth login          # GitHub.com → HTTPS → the account with pvcary-sds access
gh auth setup-git
```

Then clone `api` / `web`.

## Gotchas

### Version pinning — use `npm ci`, never `npm install`
`npm install` re-resolves transitive deps and will **drift `expo-modules-jsi` off the
pinned `57.0.4`** to a newer patch (e.g. `57.0.6`). Newer patches fail to compile under
Xcode 26.x Swift/C++ interop:

```
'RuntimeScheduler' cannot be annotated with either SWIFT_RETURNS_RETAINED or
SWIFT_RETURNS_UNRETAINED because it is not returning a SWIFT_SHARED_REFERENCE type
```

`npm ci` installs exactly what `package-lock.json` pins, so it stays on `57.0.4` (which
has no such annotation). If you run `npm install` by accident and the lock changes:

```bash
git checkout package-lock.json
rm -rf node_modules && npm ci
node -p "require('expo-modules-jsi/package.json').version"   # must print 57.0.4
```

### The Swift date patch (auto-applied)
`patches/expo-modules-jsi+57.0.4.patch` fixes an `abs()` ambiguity in
`JavaScriptCodable+Date.swift` under Swift 6.2 (Xcode 26.x). It applies automatically via
the `postinstall` hook (patch-package). If a build complains about that file, re-run
`npx patch-package`.

### Stale native project → regenerate `ios/`
`ios/` is git-ignored and regenerated (Expo Continuous Native Generation). If a build
fails on a missing/extra Pods header after a dependency change — e.g.
`'Expo/EXBundleConfiguration.h' file not found` — the `ios/Pods` are stale. Rebuild them:

```bash
rm -rf ios
LANG=en_US.UTF-8 npx expo prebuild --platform ios --clean
LANG=en_US.UTF-8 npx expo run:ios
```

Still stuck? Clear Xcode's build cache:

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```
