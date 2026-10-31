# Apple App Store: Hearth & One

Everything for App Store Connect. Items marked **[CONFIRM]** are facts only the business can confirm.
Copy rule: the food is made in batches, frozen and shipped cold. Never write "cooked fresh today" or "made to order".

## What you need before anything else

| Item | Detail |
|---|---|
| Apple Developer Program | US$99 a year (about Rs 8,500). Enrol as an organisation, which needs a D-U-N-S number and takes days to a couple of weeks, or as an individual, which is faster. The seller name shown on the store is the organisation or the person. |
| A Mac with Xcode, or Expo's cloud build (EAS) | iOS apps can only be built with Apple's tools. EAS Build can do it without a Mac, but needs the Developer account. |
| Bundle identifier | com.scooby.kitchen (set in the app, cannot change after the first upload) |
| Push notifications | An APNs key from the Developer account, uploaded to Firebase or Expo |

## Store listing

| Field | Value |
|---|---|
| App name (max 30) | Hearth & One: Pet Care |
| Subtitle (max 30) | Dog meals, vet care, one app |
| Primary category | Shopping |
| Secondary category | Lifestyle |
| Price | Free |
| Age rating | 4+ (answer the questionnaire honestly: no objectionable content; the AI assistant and vet video are not user-to-user chat) |
| Support URL | https://hearthandone.com (a page with contact details is required) |
| Marketing URL | https://hearthandone.com |
| Privacy policy URL | https://hearthandone.com/privacy |
| Support email | support@hearthandone.com |
| Copyright | 2026 Synara Vitality LLP (Apple Developer team name; confirm this is the legal entity to show) |

### Promotional text (max 170, can be changed any time without review)
Frozen dog meals made in small batches and delivered cold, a health passport for your dog, and video visits with a verified vet.

### Keywords (max 100 characters, comma separated, no spaces)
dog food,pet care,vet,frozen,meal plan,pet passport,dog health,puppy,pet shop

### Description (max 4000)
Same text as the Google Play full description (see google-play.md). Apple reviewers also read it, so keep the AI disclaimer: "The assistant gives general information and does not replace advice from a licensed veterinarian."

### What's new (first version)
Welcome to Hearth & One. Shop frozen dog meals, create your dog's health passport, book vet video consultations and plan meals.

### Screenshots (the business must supply these)
- 6.9-inch iPhone (required): 1320 x 2868 px, minimum 3, up to 10
- 6.5-inch iPhone (often still asked for): 1284 x 2778 px
- 13-inch iPad (required, because the app supports iPad): 2064 x 2752 px (2048 x 2732 is also accepted), minimum 3, up to 10. **Decision made: the app supports both iPhone and iPad.** iPad rotates in all four directions (Apple requires this); iPhone stays portrait.
- App icon: 1024 x 1024 PNG, no transparency, no rounded corners

## App Privacy ("nutrition label") answers

Apple's version of the Data safety form. Based on the in-app privacy policy.

**Tracking (used to track you across other companies' apps and sites):** No. The app uses no advertising identifier and no cross-app tracking, so the App Tracking Transparency prompt is not needed.

| Apple data type | Collected | Linked to the user | Used for |
|---|---|---|---|
| Contact info: name, email, phone number, physical address | Yes | Yes | App functionality, account management |
| Purchases: purchase history | Yes | Yes | App functionality |
| Location: precise and coarse | Yes | Yes | App functionality (address autofill, nearby vets) |
| User content: photos or videos | Yes | Yes | App functionality |
| User content: audio data | Yes | Yes | App functionality (vet video call) |
| User content: customer support, other user content (pet profile and records, meal plans) | Yes | Yes | App functionality |
| Identifiers: user ID, device ID (push token) | Yes | Yes | App functionality |
| Diagnostics: crash data, performance data | Yes | Linked or not linked, depending on how Sentry is configured **[CONFIRM]** | App functionality (stability) |

Not collected: health and fitness of the user, financial info (card details stay with Razorpay), contacts, browsing history, search history, sensitive info.

## Permission texts already in the app

Camera, microphone, photo library, location (while in use) and "save to photos" all have clear explanation texts. Apple rejects vague ones. The "save to photos" text is only used with add-only access.

## Apple rules that this app must meet (found while preparing)

1. **Account deletion inside the app (Guideline 5.1.1(v)).** Mandatory for any app that lets people create an account. Built (Profile, Delete account, plus `https://hearthandone.com/delete-account`) and working on beta; it must be released to production and included in the app build before submission.
2. **Sign in with Apple, or an equal alternative (Guideline 4.8).** The app offers "Continue with Google". Apple requires another sign-in option that collects only name and email, lets the user hide their email, and does not track. The simplest way to satisfy it is to add "Sign in with Apple". **[DECISION NEEDED]**
3. **A demo account for the reviewer (Guideline 2.1).** The phone one-time-code login cannot be used by Apple's reviewers. Provide a test account or a documented review path in the "App Review Information" box.
4. **iOS has not been built or tested for release yet.** The generated iOS project exists on the Mac but there is no Firebase iOS config file (`GoogleService-Info.plist`) and no Google sign-in set-up for iOS. Phone verification and Google sign-in will not work on iOS until this is done.
5. **Payments.** Physical food paid through Razorpay is allowed without Apple's in-app purchase. The vet video consultation is a real-time one-to-one service, which Apple allows to use its own payment method. Say so in the review notes.
6. **AI and health wording.** Keep the "does not replace a veterinarian" line in the description and inside the assistant screen.

## Review notes to paste into App Store Connect

> Hearth & One sells frozen dog food (physical goods, paid through Razorpay) and offers verified-vet video consultations. Test account: **[ADD reviewer login]**. The AI assistant gives general feeding information and says it does not replace a veterinarian. The app uses the camera and microphone for the video consultation and for pet photos, and location only to fill in the delivery address and find nearby vets.
