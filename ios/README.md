# Middle C for iPad

The iPad app is a thin native shell around the piano teacher. The teacher is a web app (`/piano` in this repository). The shell carries it inside the app as plain files, so it opens with no connection, and gives it three things a web page on an iPad cannot have:

- **MIDI from the piano**, by USB cable or Bluetooth, through the iPad's own MIDI. No special browser is needed.
- **A file of its own for progress**, which survives the web view's storage being cleared. A dated copy also goes into the Files app under Middle C each day you practise.
- **The whole screen**, kept awake while it sits on the music stand.

## Putting it on your iPad

You need a Mac with Xcode (free from the Mac App Store), your iPad, and a cable between them.

1. Get the project onto the Mac, with the web app already inside it. Either use a ready made copy of this folder that already contains `MiddleC/web`, or clone this repository and run `./ios/build-web.sh` in Terminal (that route needs Node.js).
2. Open `MiddleC.xcodeproj` in Xcode.
3. In the left sidebar click the blue **MiddleC** at the top, then the **MiddleC** target, then the **Signing & Capabilities** tab. Tick **Automatically manage signing** and choose your name under **Team**. If no team is listed, choose **Add an Account** and sign in with your Apple ID.
4. If Xcode says the bundle identifier is not available, change `app.middlec.piano` to anything of your own, i.e. `com.yourname.middlec`.
5. Plug the iPad into the Mac. On the iPad, tap **Trust** if asked. The first time, the iPad also needs **Developer Mode** switched on: Settings, Privacy & Security, Developer Mode, then restart.
6. At the top of the Xcode window choose your iPad as the place to run, then press the Play button.
7. The first time, the iPad may refuse to open the app. On the iPad go to Settings, General, VPN & Device Management, tap your Apple ID under Developer App, and tap **Trust**. Then open Middle C.

With a free Apple ID the app stops opening after 7 days. Plug the iPad in and press Play again to renew it. Progress is kept. With a paid Apple Developer membership it lasts a year.

On a Mac with an Apple chip you can also choose **My Mac (Designed for iPad)** as the place to run, to try the app on the Mac itself with the piano plugged into the Mac.

## Using it

Plug the piano's USB TO HOST socket into the iPad and open the app. It finds the piano by itself. For a piano with Bluetooth MIDI, use **Pair a Bluetooth piano** in Settings inside the app.

## How it is put together

```
MiddleC/MiddleCApp.swift     the app's entry point and its one window
MiddleC/WebScreen.swift      the web view, and the messages between page and app
MiddleC/AppFiles.swift       serves the web app from the `web` folder as middlec://app/piano
MiddleC/PianoLink.swift      the piano, over the iPad's MIDI
MiddleC/ProgressFile.swift   progress on disk, and the dated copies in Files
MiddleC/Bridge.js            runs in the page first: adds MIDI and says this is the app
MiddleC/SelfTest.swift       a check the app runs on itself when built in the cloud
MiddleC/web/                 the web app, written by build-web.sh (not kept in git)
```

The page and the app talk through one channel, described at the top of `Bridge.js`.

When the web app changes, run `./ios/build-web.sh` again and press Play in Xcode.

For work on the web app itself, a Debug build can load it from a computer instead of from inside the app: run `npm run dev` on the Mac, then in Xcode edit the scheme and add the launch argument `-MCDevURL http://your-mac.local:3000/piano`.

## Building in the cloud

`cloud-build.yml` is a GitHub Actions workflow that builds the app on a Mac in the cloud, has it test itself in the iPad simulator, and offers the Xcode project with the web app inside as a download. It is not switched on. To switch it on, copy it to `.github/workflows/ios.yml`.
