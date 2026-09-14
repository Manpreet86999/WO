$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\BodyOS-Environment.ps1"
$env:ORG_GRADLE_PROJECT_BODYOS_RELEASE_STORE_FILE = 'E:/BodyOS-Keys/body-os-release.keystore'
$env:ORG_GRADLE_PROJECT_BODYOS_RELEASE_KEY_ALIAS = 'bodyos'
$bodyOsSecret = Read-Host 'Signing-key password' -AsSecureString
$bodyOsExit = 1
try {
    $env:ORG_GRADLE_PROJECT_BODYOS_RELEASE_STORE_PASSWORD = [System.Net.NetworkCredential]::new('', $bodyOsSecret).Password
    $env:ORG_GRADLE_PROJECT_BODYOS_RELEASE_KEY_PASSWORD = $env:ORG_GRADLE_PROJECT_BODYOS_RELEASE_STORE_PASSWORD
    Write-Host 'Building with Java, caches and temporary files on E:. Keep this window open.'
    Set-Location -LiteralPath "$bodyOsRoot\apps\mobile"
    & 'E:\node\node.exe' 'scripts/build-apk.cjs'
    $bodyOsExit = $LASTEXITCODE
} finally {
    Remove-Item Env:\ORG_GRADLE_PROJECT_BODYOS_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\ORG_GRADLE_PROJECT_BODYOS_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
    $bodyOsSecret = $null
}
exit $bodyOsExit
