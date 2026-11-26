# Submitting Fretward to the App Store

Everything App Store Connect asks for, ready to paste, and what is already done in the project.

## The name

The app is called **Fretward**. It was renamed from Open String on 25 November 2026, because a guitar app called *Open String Guitar Chords* is already on the App Store for iPad. Searches found no app called Fretward. App Store Connect checks the name when the app record is created; if it is refused there, choose another and change it in the places listed below.

The name is in a handful of places: the home screen name in `ios-guitar/OpenString/Info.plist` (`CFBundleDisplayName`), the web app's title in `app/guitar/layout.tsx` and `public/guitar/manifest.webmanifest`, the welcome screen in `components/guitar/Onboarding.tsx`, the reminder title in `ios-guitar/OpenString/Reminders.swift`, and the wording of a few screens and documents. The project and folder are still called OpenString, which nobody sees. Saved progress and recordings keep their old storage names, so nothing already on an iPad is lost.

## What is already done

- **Privacy manifest.** `ios-guitar/OpenString/PrivacyInfo.xcprivacy` says the app does no tracking and collects no data, and gives Apple's reason for the one API that needs one: UserDefaults (reason CA92.1, the app's own settings). It is in the Xcode project and is copied into the app.
- **Privacy policy.** On the web at `/guitar/privacy`.
- **Support page.** On the web at `/guitar/support`.
- **Encryption.** `ITSAppUsesNonExemptEncryption` is set to false in `Info.plist`, so App Store Connect will not ask about export compliance for each build.

## App Store Connect

**Name** (30 characters at most). Fretward

**Subtitle** (30). A guitar teacher that listens

**Primary category.** Education. **Secondary category.** Music.

**Privacy Policy URL.** https://synth-studio.vercel.app/guitar/privacy

**Support URL.** https://synth-studio.vercel.app/guitar/support

The site is on Vercel's free Hobby plan, which is meant for non commercial use. If the app will be sold, consider a paid plan or a domain of your own for these pages.

**Copyright.** 2026 Scott Van Bolhuis

**App Privacy** (the privacy label). Answer that you do not collect data from this app. Recordings and progress stay on the iPad and leave it only when the user shares them, which Apple does not count as collection. The result shown on the store is "Data Not Collected".

**Content rights.** Answer no, the app does not contain third party content. The guitar sound is made on the device, the songs are traditional, in the public domain or written for the course, and the text uses the system font. GuitarSet was used to test the note detector and is not in the app.

**Age rating.** None of the content questions apply. No unrestricted web access, no user generated content shared with others, no messaging. The result should be 4+.

**Price.** Your decision.

**Promotional text** (170)

> A guitar teacher that hears you play. Set the iPad on a stand, sit with your guitar, and be playing songs in your first week, with your hands on the strings.

**Keywords** (100, separated by commas, with no words repeated from the name or subtitle)

> learn,lessons,chords,tuner,strumming,acoustic,beginner,songs,practice,fingerpicking,tab,ear training

**Description** (4000)

> Fretward is a guitar teacher that listens. Set your iPad on a stand, sit with your guitar, and it hears every strum through the microphone, with nothing to plug in.
>
> PLAYING SONGS IN YOUR FIRST WEEK
> A course of 24 short lessons in six stages: holding and tuning the guitar, a first chord on day one and a first song in the first week, strumming patterns and waltz time, the campfire chords, tab and melodies, fingerpicking, and then the first barre chord, the blues, chords by ear and a song of your own.
>
> CHANGES PRACTISED AS CHANGES
> Most beginners can hold a chord. What stops a song is getting to the next one in time. New chords come with back and forth changes, and an exercise counts your clean changes in a minute and keeps your best.
>
> A COACH FOR EVERY SONG
> First the chord changes in your own time, since the music waits for you. Then one strum on each beat of a slow click, then the song's own strum, then the whole song faster. A change that keeps catching is taken out, drilled and put back.
>
> FEEDBACK THAT SAYS WHAT TO FIX
> Which chord a strum sounded like, which strings did not ring, changes that came late, and strums that rushed ahead of the click. Each new chord is checked one string at a time.
>
> HANDS STAY ON THE GUITAR
> Large text you can read from your chair. The app moves on by itself after a step that goes well, one strum starts the next run, and a Bluetooth page turning pedal works too. The tuner follows whichever string you pluck.
>
> HEAR YOURSELF
> The first time through each learned song is recorded and kept, with your latest, in the Files app, to play back or send to family.
>
> A SESSION FOR TODAY
> Each day the app plans a short session for the time you have, starting with tuning up and ending on something you already play well. Choose a time to play and the iPad reminds you on days you have not played yet.
>
> PRIVATE
> No account, no advertising, no tracking. Your progress and recordings stay on your iPad.

**Notes for App Review**

> No account or sign in is needed, and the app works without an internet connection.
>
> The app listens to an acoustic guitar through the iPad's microphone and asks for permission on first start. Without a guitar, a reviewer can still go through every screen: every step can be skipped, and after two runs that are not heard the main button becomes Move on. Recordings and progress are kept on the iPad and shown in the Files app under Fretward.

## Screenshots

App Store Connect needs screenshots for the 13 inch iPad, 2752 by 2064 pixels in landscape. Smaller iPads use the same set.

## The submission itself

1. Open the privacy and support addresses and check they show the pages.
2. Build the web app into the project, `ios-guitar/build-web.sh`, then open `ios-guitar/OpenString.xcodeproj` in Xcode.
3. Under Signing and Capabilities, choose your team. The bundle identifier is `com.scottvanbolhuis.fretward`. It cannot change after the first upload.
4. Product, Archive, then Distribute App to App Store Connect.
5. In App Store Connect, fill in the fields above, add the screenshots, choose the build, and submit for review.
