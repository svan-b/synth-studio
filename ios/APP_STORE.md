# Submitting Middle C to the App Store

Everything App Store Connect asks for, ready to paste, and what is already done in the project.

## Decide the name first

Two things already use the name.

- **An app.** *Middle C: Piano Scales & Chords*, by Sameh Aly, is on the App Store. It teaches beginners piano scales and chords, for iPhone. An app called Middle C would sit beside it, in the same field.
- **A registered US trademark.** MIDDLE C, registration 6014537 (serial 88158674), owned by Charlotte Music Club, LLC of Charlotte, North Carolina, registered 17 March 2020 in class 41. That class covers education and entertainment, and this registration is for a music venue's services. A second mark, MIDDLE C JAZZ, belongs to the same venue.

A piano teaching app is not a music venue, so this is not a clear conflict. But the name is shared with a piano learning app already in the store, and the mark is in the class that also covers education. Picking a different name now costs nothing. Picking one after launch costs reviews and recognition.

These facts come from search results. Check them yourself before deciding: search App Store Connect for the name you want, and search the USPTO trademark database (tmsearch.uspto.gov) in classes 9 and 41.

The name is in a handful of places in the project: the home screen name in `ios/MiddleC/Info.plist` (`CFBundleDisplayName`), the web app's title in `app/piano/layout.tsx` and `public/piano/manifest.webmanifest`, the welcome screen in `components/piano/Onboarding.tsx`, and the wording of a few screens and documents. The saved progress key `middle-c-v1` must not change, or progress already on an iPad would be lost.

## What is already done

- **Privacy manifest.** `ios/MiddleC/PrivacyInfo.xcprivacy` says the app does no tracking and collects no data, and gives Apple's reasons for the two APIs that need one. These are UserDefaults (reason CA92.1, the app's own settings) and the system clock CoreMIDI times notes with (reason 35F9.1, measuring time between events in the app). It is in the Xcode project and is copied into the app.
- **Privacy policy.** In the app under Settings, About, Privacy. On the web at `/piano/privacy` (see below). Both show the same text, from `lib/piano/content/about.ts`.
- **Credits and licences.** In the app under Settings, About, Acknowledgements, with the full licence texts a tap away. The texts are in `public/piano/licences.txt`, written by `node scripts/piano-notices.mjs` from what the app's code actually includes. The iPad build runs it each time, and a test fails if it falls behind.
- **Encryption.** `ITSAppUsesNonExemptEncryption` is set to false in `Info.plist`, so App Store Connect will not ask about export compliance for each build.
- **Nothing from elsewhere in this repository ships in the app.** The build leaves out the code of the site's other pages.

## App Store Connect

**Name** (30 characters at most). Middle C, until you decide otherwise.

**Subtitle** (30). A piano teacher for your stand

**Primary category.** Education. **Secondary category.** Music.

**Privacy Policy URL.** https://synth-studio.vercel.app/piano/privacy

This address works once this branch is merged into the branch Vercel deploys to production. Before you submit, open it in a browser and check it shows the policy. The site is on Vercel's free Hobby plan, which is meant for non commercial use. If the app will be sold, consider a paid plan or a domain of your own for this page.

**Support URL.** Required, and only you can provide it: a page where people can reach you. A simple page with an email address is enough.

**Copyright.** 2026 followed by your name or company.

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

> Middle C is a piano teacher that sits on your music stand. Connect a digital piano by cable or Bluetooth MIDI and it follows every key you play, so you learn with your hands on the keys and your eyes on the music.
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

1. Merge this branch so the privacy page is live, and open the address to check it.
2. Build the web app into the project, `ios/build-web.sh`, then open `ios/MiddleC.xcodeproj` in Xcode.
3. Under Signing and Capabilities, choose your team. The bundle identifier is `app.middlec.piano`. Change it if you rename the app, before the first upload, since it cannot change after.
4. Product, Archive, then Distribute App to App Store Connect.
5. In App Store Connect, fill in the fields above, add the screenshots, choose the build, and submit for review.
