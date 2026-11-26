# Submitting Keyward to the App Store

Everything App Store Connect asks for, ready to paste, and what is already done in the project.

## The name

The app is called **Keyward**. It was renamed from Middle C on 25 November 2026, because an iPhone app called *Middle C: Piano Scales & Chords* is already on the App Store and MIDDLE C is a registered US trademark (6014537) in class 41. Searches found no app called Keyward. App Store Connect checks the name when the app record is created; if it is refused there, choose another and change it in the places listed below.

The name is in a handful of places: the home screen name in `ios/MiddleC/Info.plist` (`CFBundleDisplayName`), the web app's title in `app/piano/layout.tsx` and `public/piano/manifest.webmanifest`, the welcome screen in `components/piano/Onboarding.tsx`, and the wording of a few screens and documents. The project and folder are still called MiddleC, which nobody sees. The saved progress key `middle-c-v1` must not change, or progress already on an iPad would be lost. The musical note middle C in the lessons is not the app's name and stays as it is.

## What is already done

- **Privacy manifest.** `ios/MiddleC/PrivacyInfo.xcprivacy` says the app does no tracking and collects no data, and gives Apple's reasons for the two APIs that need one. These are UserDefaults (reason CA92.1, the app's own settings) and the system clock CoreMIDI times notes with (reason 35F9.1, measuring time between events in the app). It is in the Xcode project and is copied into the app.
- **Privacy policy.** In the app under Settings, About, Privacy. On the web at `/piano/privacy` (see below). Both show the same text, from `lib/piano/content/about.ts`.
- **Credits and licences.** In the app under Settings, About, Acknowledgements, with the full licence texts a tap away. The texts are in `public/piano/licences.txt`, written by `node scripts/piano-notices.mjs` from what the app's code actually includes. The iPad build runs it each time, and a test fails if it falls behind.
- **Encryption.** `ITSAppUsesNonExemptEncryption` is set to false in `Info.plist`, so App Store Connect will not ask about export compliance for each build.
- **Nothing from elsewhere in this repository ships in the app.** The build leaves out the code of the site's other pages.

## App Store Connect

**Name** (30 characters at most). Keyward

**Subtitle** (30). A piano teacher for your stand

**Primary category.** Education. **Secondary category.** Music.

**Privacy Policy URL.** https://synth-studio.vercel.app/piano/privacy

The site is on Vercel's free Hobby plan, which is meant for non commercial use. If the app will be sold, consider a paid plan or a domain of your own for this page and the support page.

**Support URL.** https://synth-studio.vercel.app/piano/support

**Copyright.** 2026 Scott Van Bolhuis

**App Privacy** (the privacy label). Answer that you do not collect data from this app. The result shown on the store is "Data Not Collected".

**Content rights.** Answer yes, the app contains third party content, and yes, you have the rights to use it. That content is the piano recordings (Creative Commons Attribution, credited in the app), the music font (SIL Open Font License, credited in the app), and music that is traditional or in the public domain.

**Age rating.** None of the content questions apply. No unrestricted web access, no user generated content, no messaging. The result should be 4+.

**Price.** Your decision.

**Promotional text** (170)

> A piano teacher for the music stand. Connect your digital piano and learn real music with a coach that hears every key, while your hands stay on the keys.

**Keywords** (100, separated by commas, with no words repeated from the name or subtitle)

> lessons,learn,sheet music,sight reading,MIDI,keyboard,practice,beginner,chords,scales,notes,theory

Leave out piano makers' names, such as Yamaha, and other apps' names. Apple rejects keywords that use trademarks you do not own.

**Description** (4000)

> Keyward is a piano teacher that sits on your music stand. Connect a digital piano by cable or Bluetooth MIDI and it follows every key you play, so you learn with your hands on the keys and your eyes on the music.
>
> LEARN FROM THE FIRST NOTE
> A course of 39 short lessons takes you from finding middle C to Bach, Beethoven and Satie. You learn tunes by ear and by shape first, then read them on the staff. Reading, rhythm, sharps and flats, chords, scales, the pedal, playing by ear and making music up each have lessons of their own. If you already play, start further in.
>
> PRACTISE THE WAY THAT WORKS
> Each piece is learned with a coach built on research into how people learn to play. It finds the parts you already know and skips them, breaks the rest into phrases, brings the hands together early, and speeds up only once a passage holds. When something goes wrong it says where and what, such as slips in measure 3, quick notes running ahead, or long notes let go too early.
>
> YOUR HANDS STAY ON THE KEYS
> The top key of the piano means go on and the bottom key means again. The pedals and Bluetooth page turners work too. A question about a note is answered by playing it.
>
> A SESSION FOR TODAY
> Each day the app plans a short session for the time you have, with a lesson, a piece and an exercise. If you are called away, it picks up where you stopped.
>
> HEAR YOURSELF
> Play back your own playing with the music following along. The play through that finishes each piece is kept, so you can hear how far you have come.
>
> EXERCISES THAT NEVER REPEAT
> Note reading with spaced review, rhythm, playing by ear, sight reading, scales and arpeggios, and chords from symbols, with fresh material every time.
>
> WORKS WITH YOUR PIANO
> Any digital piano or keyboard with USB or Bluetooth MIDI. Demonstrations can play on the piano itself, as firmly as you play. Without MIDI, the app can listen through the microphone, or you can play on the screen.
>
> PRIVATE
> No account, no advertising, no tracking. Your progress stays on your iPad.

**Notes for App Review**

> No account or sign in is needed, and the app works without an internet connection.
>
> The app is meant to be used with a digital piano connected over MIDI, by USB cable or Bluetooth. Without one, every part of it can be reviewed with the keys on the screen. In first run setup, tap Not now on the Connect your piano page, and the app plays from the keys on the screen. The connection is under Settings, Your piano. The microphone option listens to an acoustic piano and asks for permission only when chosen.
>
> Bluetooth is used only to connect to a piano's Bluetooth MIDI.

## Screenshots

App Store Connect needs screenshots for the 13 inch iPad, 2752 by 2064 pixels in landscape. A set at that size is made by the browser tests in this project and is sent with this guide. Smaller iPads use the same set.

## The submission itself

1. Open the privacy and support addresses and check they show the pages.
2. Build the web app into the project, `ios/build-web.sh`, then open `ios/MiddleC.xcodeproj` in Xcode.
3. Under Signing and Capabilities, choose your team. The bundle identifier is `com.scottvanbolhuis.keyward`. It cannot change after the first upload.
4. Product, Archive, then Distribute App to App Store Connect.
5. In App Store Connect, fill in the fields above, add the screenshots, choose the build, and submit for review.
