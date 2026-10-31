module.exports = {
  expo: {
    name: "Hearth & One",
    slug: "scooby-kitchen",
    scheme: "scoobykitchen",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon-1024.png",
    ios: {
      bundleIdentifier: "com.scooby.kitchen",
      usesAppleSignIn: true,
      // Firebase iOS app (kept out of git, like google-services.json for Android). Cloud builds do not
      // receive gitignored files, so they provide it as an EAS file secret in GOOGLE_SERVICES_INFO_PLIST.
      googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST || "./GoogleService-Info.plist",
      supportsTablet: true,
      infoPlist: {
        // The app only uses standard HTTPS, which is exempt: avoids the export-compliance question on every upload.
        ITSAppUsesNonExemptEncryption: false,
        // iPad apps must rotate in all four directions (or declare full-screen-only, which Apple is
        // phasing out). iPhone stays portrait. Layouts switch at 768 px wide (useResponsive).
        UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
        "UISupportedInterfaceOrientations~ipad": [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationPortraitUpsideDown",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight",
        ],
        NSCameraUsageDescription:
          "Hearth & One needs camera access to let you take photos of your pet, scan recipes, and be seen during video consultations with the veterinarian.",
        NSMicrophoneUsageDescription:
          "Hearth & One needs microphone access so you can speak during your video consultation with the veterinarian.",
        NSPhotoLibraryUsageDescription:
          "Hearth & One needs access to your photo library so you can upload a profile picture and photos of your pet.",
        NSLocationWhenInUseUsageDescription:
          "Hearth & One uses your location to auto-fill your delivery address at checkout.",
      },
    },
    android: {
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/icon-1024.png",
        backgroundColor: "#F9F6F0",
      },
      package: "com.scooby.kitchen",
      config: {
        googleMaps: {
          // Real key lives in .env (gitignored) locally, and in EAS
          // secrets/env for cloud builds — never hardcoded here so it
          // never lands in a tracked file again.
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      // Only what the app really uses: location (address autofill, nearby vets), camera (pet
      // photos), microphone (vet video call). Photo picking goes through the system picker and
      // needs no storage/media permission, so Google's restricted photo/video permissions are
      // blocked even where a library would add them.
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "CAMERA",
        "RECORD_AUDIO",
      ],
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
    },
    plugins: [
      "expo-image",
      "expo-font",
      "expo-sharing",
      "expo-secure-store",
      "expo-apple-authentication",
      [
        // iOS only: the URL scheme Google uses to hand the user back to the app after sign-in
        // (REVERSED_CLIENT_ID from GoogleService-Info.plist; public, it ships inside the app).
        "@react-native-google-signin/google-signin",
        { iosUrlScheme: "com.googleusercontent.apps.372112333224-u64lij6u4mrpmokhm5a8jbsktmm0or3b" },
      ],
      "@sentry/react-native",
      "expo-web-browser",
      [
        "expo-splash-screen",
        {
          image: "./assets/scooby-logo-512.png",
          resizeMode: "contain",
          backgroundColor: "#F9F6F0",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: false,
          savePhotosPermission:
            "Hearth & One needs permission to save your Pet Heritage Passport to your photo library.",
        },
      ],
      [
        "expo-notifications",
        {
          color: "#3F5E4D",
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "326bc6a2-7b29-4f00-b1c5-6ea53074cd6e",
      },
    },
    owner: "lokesh_46",
  },
};
