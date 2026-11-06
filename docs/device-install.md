# Installing the app on a physical iPhone

How to get Print Loft onto a real iPhone for testing. There are two routes; which one you
use depends on where the Apple Developer enrollment stands.

| | Route A — local build, free team | Route B — EAS build, paid team |
|---|---|---|
| When | **Now**, until the LLC's Apple Developer enrollment is approved | Once The Print Loft LLC's organization membership is approved |
| Builds on | This Mac (Xcode, via the Expo CLI) | Expo's cloud |
| Signed by | The Print Loft Apple Account's free **Personal Team** | The Print Loft LLC's paid Apple team |
| Bundle ID | `com.theprintloft.app.dev` (test ID) | `com.theprintloft.app` (the real one) |
| Install lasts | **7 days**, then rebuild | 1 year |
| Phone needs the Mac running? | Yes — same Wi-Fi, Metro running | Development build: yes. `staging` build: no |

> **Never sign with the HitchHero team.** Xcode on this Mac also knows a paid team called
> "Patrick Cary" (no "(Personal Team)" suffix). It belongs to a different business. Print
> Loft builds use **only** the Print Loft Apple Account. If you ever see that team selected
> for PrintLoft, change it.

---

## Route A — local build on the free Print Loft team

### Once per Mac

1. **Create the Print Loft Apple Account** if it doesn't exist yet:
   [account.apple.com](https://account.apple.com) — Print Loft email, your own legal name,
   two-factor on.
2. **Add it to Xcode:** Xcode → **Settings** (⌘,) → **Accounts** → **+** → **Apple Account**
   → sign in. Xcode creates a free team for it, shown as **"Patrick Cary (Personal Team)"**
   (team ID `5HVTC9C5FG`).
3. **Project packages:** in `mobileapp`, run `npm ci` (see [setup.md](./setup.md)).

### Once per phone

1. Plug the iPhone into the Mac with a cable and unlock it.
2. If it asks **"Trust This Computer?"**, tap **Trust**.
3. **Developer Mode:** iPhone **Settings → Privacy & Security → Developer Mode → On**, then
   restart the phone when asked. (Already on for Patrick's iPhone.)

### First build — in Xcode (creates the signing profile)

The first build for a new team has to happen in Xcode, because Xcode needs to create a
signing profile and register the phone. `npx expo run:ios` can't do that step — it fails
with *"No profiles for 'com.theprintloft.app.dev' were found"*.

1. In Finder, open **`mobileapp/ios/PrintLoft.xcworkspace`** (the white icon — not the
   `.xcodeproj`).
2. Left sidebar → click the blue **PrintLoft** project → under **Targets** select
   **PrintLoft** → **Signing & Capabilities** tab.
3. Tick **Automatically manage signing**.
4. **Team:** **Patrick Cary (Personal Team)**.
5. **Bundle Identifier:** `com.theprintloft.app.dev`.
6. At the top of the window, choose your **iPhone** as the run destination.
7. Press **▶ Run** (⌘R). First build: 5–10 minutes. Approve any keychain prompt.
8. Close Xcode once it has installed. From now on, use the Terminal command below.

### Every build after that — Terminal

Phone plugged in and unlocked:

```bash
cd ~/Projects/mobileapp
```

```bash
LANG=en_US.UTF-8 npx expo run:ios --device
```

It lists connected devices to pick from, builds, installs, and starts **Metro** (the server
the phone loads the app's code from). **Leave that Terminal window open** while you use the
app.

### First launch on the phone

1. iPhone **Settings → General → VPN & Device Management** → tap your Print Loft developer
   name → **Trust**. (Once per install.)
2. Open **Print Loft**. It shows the Expo dev launcher; tap the server listed under
   **Development servers** if it doesn't connect by itself.
3. The phone must be on the **same Wi-Fi** as the Mac.

The app talks to **staging**: test payments only (card `4242 4242 4242 4242`), Prodigi
sandbox orders, CMS drafts.

### When it stops opening (after 7 days)

Plug the phone in and rerun the Terminal command. That's the free team's limit, not a bug.

### If something goes wrong

| Symptom | Cause / fix |
|---|---|
| Phone shows **unavailable** | Not plugged in, locked, or not trusted. Unlock, keep the screen on, tap Trust. |
| Installs, then `The application failed to launch … has not been explicitly trusted by the user` | Expected on the **first install for a new team**. Do **First launch on the phone** step 1 (Trust), then restart the server — this error also stops it: `LANG=en_US.UTF-8 npx expo start --dev-client`. |
| `No device UDID or name matching …` | Passing the wrong ID to `--device`. Run `--device` with no value and pick from the list. |
| `No profiles for 'com.theprintloft.app.dev' were found` | The first build for this team hasn't been done in Xcode. Do **First build — in Xcode** above. |
| Signing settings vanished | `npx expo prebuild --clean` regenerates `ios/` from `app.json` and resets the team and bundle ID. Redo steps 2–5 of the Xcode build. |
| App opens to a red error / can't load | Metro isn't running or the phone is on a different Wi-Fi. Rerun the Terminal command. |
| App shows old config (wrong Stripe key, wrong API) | Metro was started before a config change. Stop it (Ctrl-C) and rerun. |

The team and bundle ID live in `ios/`, which is generated and **not committed**, so they
stay on this Mac and never reach the repo.

---

## Route B — EAS build (after Apple approves the LLC)

Requires the paid organization membership — Expo's internal distribution can't use a free
team. The Expo project is `@the-print-loft-llc/print-loft`, owned by the Print Loft Expo
login.

From `mobileapp`:

```bash
eas login
```

Sign in with the **Print Loft** Expo login.

```bash
eas device:create
```

Open the link it prints on the iPhone and install the profile — this registers the phone.

```bash
eas build --profile development --platform ios
```

When asked, sign in with the **Print Loft Apple Account**. EAS creates the certificate and
profile for `com.theprintloft.app` under the LLC's team and builds in the cloud. Scan the QR
code on the phone to install. Start Metro with `LANG=en_US.UTF-8 npx expo start` and open
the app.

For a build that works **without the Mac** (to show someone), use `--profile staging`
instead. App Store / TestFlight builds use `--profile production` and `eas submit`.

Docs: [internal distribution](https://docs.expo.dev/build/internal-distribution/) ·
[development builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
