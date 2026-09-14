# Body OS tools on E:

The project, Android SDK and Node were already on E:. The previous Java path and some Gradle runs used the Windows profile on C:. Body OS launchers now set their own paths under `E:\Workout OS\.build-tools`.

| Item | Location |
|---|---|
| Java 17 | `E:\Workout OS\.build-tools\jdk-17` |
| Gradle downloads/cache | `E:\Workout OS\.build-tools\gradle-home` |
| Build temporary files | `E:\Workout OS\.build-tools\temp` |
| npm cache | `E:\Workout OS\.build-tools\npm-cache` |
| Expo CLI state | `E:\Workout OS\.build-tools\expo-home` |
| Android user state / emulators | `.build-tools\android-user` / `.build-tools\avd` |
| Android Studio settings, caches, plugins and logs | `E:\Workout OS\.build-tools\studio` |
| Android SDK | `E:\Android` |
| Source and APK output | `E:\Workout OS` |

Use `Build-Android-APK.cmd` for the signed release build. Use `Body-OS-Terminal.cmd` for development commands. Close Android Studio completely before using `Open-Body-OS-Android-Studio.cmd`; an already-running Studio instance may keep its old environment. This shortcut uses a separate Studio settings folder, so Studio can ask for initial setup again. Select the existing SDK at `E:\Android` and Java at `.build-tools\jdk-17` if asked.

Java and cached Gradle dependencies were copied from C: without deleting their originals. The C: cache may be shared with other projects, so it has not been removed. Windows itself, the Codex application, system files and Windows-managed paging still use their normal locations. This setup redirects Body OS build tools; it does not move Windows.

These settings are scoped to the Body OS launchers, not global Windows environment variables. A normal terminal or the standard Android Studio shortcut can still use Windows defaults. The APK build script reapplies Java 17 and E: paths after Expo prebuild, which regenerates Android files.

Verification: PowerShell/Node launcher syntax checked; copied Java 17 runs from E:. Check Gradle `--version` and a full APK build before removing old caches. Never delete the release keystore or user data to reclaim cache space.
