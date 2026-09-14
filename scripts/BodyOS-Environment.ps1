$bodyOsRoot = Split-Path -Parent $PSScriptRoot
$bodyOsTools = Join-Path $bodyOsRoot '.build-tools'
$env:JAVA_HOME = Join-Path $bodyOsTools 'jdk-17'
$env:ANDROID_HOME = 'E:\Android'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $bodyOsTools 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $bodyOsTools 'android-user'
$env:ANDROID_EMULATOR_HOME = $env:ANDROID_USER_HOME
$env:ANDROID_AVD_HOME = Join-Path $bodyOsTools 'avd'
$env:npm_config_cache = Join-Path $bodyOsTools 'npm-cache'
$env:__UNSAFE_EXPO_HOME_DIRECTORY = Join-Path $bodyOsTools 'expo-home'
$env:DOTSLASH_CACHE = Join-Path $bodyOsTools 'dotslash-cache'
$env:TEMP = Join-Path $bodyOsTools 'temp'
$env:TMP = $env:TEMP
$env:STUDIO_PROPERTIES = Join-Path $bodyOsTools 'studio.properties'
$env:Path = "$env:JAVA_HOME\bin;E:\node;$env:ANDROID_HOME\platform-tools;$env:Path"
foreach ($bodyOsDirectory in @($env:GRADLE_USER_HOME,$env:ANDROID_USER_HOME,$env:ANDROID_AVD_HOME,$env:npm_config_cache,$env:__UNSAFE_EXPO_HOME_DIRECTORY,$env:DOTSLASH_CACHE,$env:TEMP)) {
    New-Item -ItemType Directory -Force -Path $bodyOsDirectory | Out-Null
}
if (!(Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe")) { throw "Java 17 is missing from $env:JAVA_HOME" }
$bodyOsStudio = (Join-Path $bodyOsTools 'studio').Replace('\','/')
@"
idea.config.path=$bodyOsStudio/config
idea.system.path=$bodyOsStudio/system
idea.plugins.path=$bodyOsStudio/plugins
idea.log.path=$bodyOsStudio/log
"@ | Set-Content -LiteralPath $env:STUDIO_PROPERTIES -Encoding ASCII
