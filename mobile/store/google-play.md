# Google Play: Hearth & One

Everything to paste into the Play Console. Items marked **[CONFIRM]** are facts only the business can confirm.
Copy rule: the food is made in batches, frozen and shipped cold. Never write "cooked fresh today" or "made to order".

## Store listing

| Field | Value |
|---|---|
| App name (max 30) | Hearth & One: Pet Care |
| Package | com.scooby.kitchen (cannot change after the first upload) |
| Default language | English (India) |
| Category | Shopping (alternative: Lifestyle) |
| Tags | Pets, Shopping, Health (choose the closest offered) |
| Contact email | support@hearthandone.com |
| Website | https://hearthandone.com |
| Privacy policy URL | https://hearthandone.com/privacy |
| Free or paid | Free (no in-app purchases; real-world goods are paid through Razorpay) |
| Ads | No ads |

### Short description (80 characters, this is 79)
Frozen dog meals, pet health passport, vet video calls and an AI feeding guide.

### Full description (max 4000)
Hearth & One brings your dog's food, health records and vet care into one app.

SHOP FROZEN DOG MEALS
Browse recipes made in small batches, frozen and delivered cold. See exactly what is inside every recipe, filter by sensitivities such as beef, chicken or grain, and reorder in a few taps. Track every order from checkout to your door. **[CONFIRM delivery area, e.g. "Delivery across India" or the list of cities.]**

KNOW YOUR PET
Create a Pet Heritage Passport with your dog's name, breed, birth date, weight and photos. Snap a photo and the pet scanner suggests the breed. Keep consultation notes and records together, and share or save the passport as an image.

VET VIDEO CONSULTATIONS
Book a video consultation with a verified veterinarian from home. Find clinics near you on the map.

MEAL PLANNER AND AI FEEDING GUIDE
Build a meal plan from your dog's profile, and ask the AI nutrition assistant everyday feeding questions. The assistant gives general information and does not replace advice from a licensed veterinarian.

EASY SIGN-IN
Continue with Google or verify your phone number with a one-time code.

SUPPORT THAT ANSWERS
Raise a ticket from the app and follow it until it is solved.

Questions? support@hearthandone.com

### Graphics to prepare (the business must supply these)
- App icon: 512 x 512 PNG, 32-bit, no transparency (use `assets/icon-1024.png`, resized)
- Feature graphic: 1024 x 500 PNG or JPG
- Phone screenshots: minimum 2, recommended 6 to 8 (16:9 or 9:16, 320 to 3840 px). Suggested order: Home, Shop Recipes, Recipe detail, Pet Passport, Vet Consult, Meal Planner, Order tracking.
- Tablet screenshots only if you want to appear in the tablet listing (optional)

## Data safety form

Based on the in-app privacy policy. Where the policy and the form disagree, the form must be corrected, because Google compares them.

**Does the app collect or share user data?** Yes.
**Is all collected data encrypted in transit?** Yes (HTTPS/TLS).
**Can users request that data is deleted?** Yes, but see "Account deletion" below. This answer is only valid once deletion exists.

| Data type (Play category) | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Name | Yes | With delivery partners (to fulfil orders) | No | App functionality, account management |
| Email address | Yes | No | No | Account management, app functionality |
| Phone number | Yes | With delivery partners, with the OTP provider | No | Account management, app functionality, fraud prevention |
| Address (delivery) | Yes | With delivery partners | No | App functionality |
| User IDs | Yes | No | No | Account management |
| Purchase history (Financial info) | Yes | No | No | App functionality |
| Approximate location | Yes | No | Yes | App functionality (nearby vets) |
| Precise location | Yes | No | Yes | App functionality (address autofill, nearby vets) |
| Photos | Yes | No | Yes | App functionality (pet photos, profile photo, review photo) |
| Videos | Yes | Video-call provider (service provider) | Yes | App functionality (vet consultation) |
| Voice or sound recordings | Yes | Video-call provider (service provider) | Yes | App functionality (vet consultation) |
| Other in-app messages | Yes | No | Yes | App functionality (support tickets, AI assistant) |
| Other user-generated content (pet profile, pet records, meal plans) | Yes | No | No | App functionality |
| Crash logs and diagnostics | Yes | Sentry (service provider) | No | Analytics (app stability) |
| Device or other IDs (push token) | Yes | No | Yes | App functionality (order notifications) |

Notes for whoever fills in the form:
- **Card and UPI details:** entered on Razorpay's payment screen. The app does not read them, so do not tick "Payment info".
- **Service providers:** Google does not count handing data to a provider that processes it for you as "sharing". The "Shared" column lists them for completeness. Delivery partners are listed as shared on purpose: it is the safer answer.
- **Pet health records:** these are about the pet, not the user, so they are listed as user-generated content, not "Health info". This is a judgment call. If the vet video call is later changed to record sessions, revisit it.
- **Data not collected:** contacts, calendar, SMS, call logs, files and documents, web browsing, installed apps, health or fitness data of the user.
- **Sold or used for ads:** no.

## Permissions kept, and why (for the permission declaration form)

| Permission | Why the app needs it |
|---|---|
| CAMERA | Photograph the pet, scan for breed, video consultation |
| RECORD_AUDIO | Speak during the vet video consultation |
| ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION | Fill in the delivery address, find nearby vets (foreground use only, never in the background) |
| POST_NOTIFICATIONS | Order updates and reminders |
| INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, VIBRATE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED | Normal permissions, no review needed |

**Removed in this clean-up (no longer in the app):** READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO, READ_MEDIA_VISUAL_USER_SELECTED, READ_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW. Google restricts photo and video permissions and rejects apps that could use the system photo picker instead. This app picks images through the system picker, so it never needed them. Saving the passport image now asks for no storage permission on Android 13 and newer, and only add-to-photos access on older versions.

## Other Play Console forms

- **Target audience:** 18 and over (matches the Terms of Use). This also avoids the Families policy.
- **Content rating (IARC questionnaire):** no violence, no sexual content, no gambling, no user-generated public content. Expected result: Everyone / 3+. Answer the "digital purchases" question truthfully (physical goods only).
- **Government app / News app / Financial features / Health apps declarations:** answer "No". The app is not a financial service, and the pet-health features do not handle the user's own health data. Re-read the Health apps question when you reach it.
- **Advertising ID:** the app does not use it. Declare "No".
- **App access (login required):** provide a test account for Google's reviewers. The phone one-time-code sign-in cannot be used by them, so create an email/password-free reviewer path, or give them a Google test account. **[DECISION NEEDED]**
- **Foreground service:** a location foreground-service entry comes from a library. The app does not use background location. Check the Pre-launch report; if Google asks, remove that service in the manifest.

## Blockers before submitting (found while preparing this)

1. **Account deletion: built on beta, not yet live.** Google requires deletion inside the app plus a public web page. Both now exist (Profile, Delete account; `https://hearthandone.com/delete-account`) and work on beta. They still have to be released to production (backend, website and an app build) before submitting. Use `https://hearthandone.com/delete-account` as the deletion URL in the Data safety form.
2. **Reviewer login.** See "App access" above.
3. **Razorpay live keys.** Confirm production uses live (`rzp_live_`) keys before real customers are invited.
4. **Test on a real phone.** The permission clean-up changes how the passport is saved. It has been checked in the built manifest, but the save-to-photos flow has not yet been run on a phone.
