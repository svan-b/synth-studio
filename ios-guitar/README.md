# Open String for iPad

The iPad app is a thin native shell around the guitar teacher. The teacher is a web app (`/guitar` in this repository). The shell carries it inside the app as plain files, so it opens with no connection, and gives it what a web page on an iPad cannot have:

- **A file of its own for progress**, which survives the web view's storage being cleared. A dated copy also goes into the Files app under Open String each day you play.
- **Recordings in the Files app.** The first time through each learned song is kept, with your latest, under Open String, Recordings, ready to play or send to family.
- **A reminder at your time to play**, only on days you have not played yet. After a quiet week it sends two gentler ones and then stops.
- **The iPad's volume**, so the sound check can tell you when the iPad is too quiet beside your guitar.
- **The whole screen**, kept awake while it sits on a stand in front of you.

The app listens to the guitar through the iPad's own microphone. Nothing needs plugging in.

## Putting it on your iPad

You need a Mac with Xcode (free from the Mac App Store), your iPad, and a cable between them.

1. Get the project onto the Mac, with the web app already inside it. Either use a ready made copy of this folder that already contains `OpenString/web`, or clone this repository and run `./ios-guitar/build-web.sh` in Terminal (that route needs Node.js).
2. Open `OpenString.xcodeproj` in Xcode.
3. In the left sidebar click the blue **OpenString** at the top, then the **OpenString** target, then the **Signing & Capabilities** tab. Tick **Automatically manage signing** and choose your name under **Team**. If no team is listed, choose **Add an Account** and sign in with your Apple ID.
4. If Xcode says the bundle identifier is not available, change `app.openstring.guitar` to anything of your own, i.e. `com.yourname.openstring`.
5. Plug the iPad into the Mac. On the iPad, tap **Trust** if asked. The first time, the iPad also needs **Developer Mode** switched on: Settings, Privacy & Security, Developer Mode, then restart.
6. At the top of the Xcode window choose your iPad as the place to run, then press the Play button.
7. The first time, the iPad may refuse to open the app. On the iPad go to Settings, General, VPN & Device Management, tap your Apple ID under Developer App, and tap **Trust**. Then open Open String.

With a free Apple ID the app stops opening after 7 days. Plug the iPad in and press Play again to renew it. Progress and recordings are kept. With a paid Apple Developer membership it lasts a year.

## Using it

Set the iPad on a stand or a table in front of you, about an arm's length away, and sit with the guitar. The first time, the iPad asks whether the app may use the microphone: say yes. The welcome screens then check that it can hear you, and whether the iPad is loud enough beside your guitar. Turn the iPad up with the buttons on its side if the sound check says so. While the microphone is in use the iPad keeps a volume of its own, so set it with the app open.

## How it is put together

```
OpenString/OpenStringApp.swift  the app's entry point and its one window
OpenString/WebScreen.swift      the web view, and the messages between page and app
OpenString/AppFiles.swift       serves the web app from the `web` folder as openstring://localhost/guitar
OpenString/ProgressFile.swift   progress on disk, and the dated copies in Files
OpenString/Recordings.swift     recordings of your playing, in Files
OpenString/Reminders.swift      the reminder at your time to play
OpenString/Bridge.js            runs in the page first and says this is the app
OpenString/SelfTest.swift       a check the app runs on itself when built in the cloud
OpenString/web/                 the web app, written by build-web.sh (not kept in git)
```

The page and the app talk through one channel, described at the top of `Bridge.js`.

When the web app changes, run `./ios-guitar/build-web.sh` again and press Play in Xcode.

For work on the web app itself, a Debug build can load it from a computer instead of from inside the app: run `npm run dev` on the Mac, then in Xcode edit the scheme and add the launch argument `-OSDevURL http://your-mac.local:3000/guitar`.

## Building in the cloud

`cloud-build.yml` is a GitHub Actions workflow that builds the app on a Mac in the cloud, has it test itself in the iPad simulator, and offers the Xcode project with the web app inside as a download. It is not switched on. To switch it on, copy it to `.github/workflows/ios-guitar.yml`.
