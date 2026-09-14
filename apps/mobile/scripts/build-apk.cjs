const {existsSync,readFileSync,writeFileSync}=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {configure,configureGradle}=require('./build-environment.cjs');
configure();
function fail(message){console.error(message);process.exit(1);}
if(process.platform!=='win32')fail('This launcher targets Windows. See docs/ANDROID-APK.md for the Gradle steps.');
if(!process.env.JAVA_HOME||!existsSync(path.join(process.env.JAVA_HOME,'bin','java.exe')))fail('Set JAVA_HOME to your installed JDK. See docs/ANDROID-APK.md.');
if(!process.env.ANDROID_HOME||!existsSync(process.env.ANDROID_HOME))fail('Set ANDROID_HOME to your Android SDK. See docs/ANDROID-APK.md.');
function run(command,args,cwd){const result=spawnSync(command,args,{cwd,stdio:'inherit',windowsHide:true,env:{...process.env,EXPO_NO_TELEMETRY:'1',NODE_ENV:'production'}});if(result.error)fail(result.error.message);if(result.status!==0)process.exit(result.status||1);}
run(process.execPath,['node_modules/expo/bin/cli','prebuild','--platform','android','--no-install'],root);
configureGradle();
// Expo recreates this file; apply the download timeout after each prebuild.
const wrapperProperties=path.join(root,'android','gradle','wrapper','gradle-wrapper.properties');
const wrapperText=readFileSync(wrapperProperties,'utf8');
writeFileSync(wrapperProperties,/^networkTimeout=.*$/m.test(wrapperText)
  ? wrapperText.replace(/^networkTimeout=.*$/m,'networkTimeout=120000')
  : wrapperText+'\nnetworkTimeout=120000\n');
run('cmd.exe',['/d','/s','/c','gradlew.bat :app:assembleRelease'],path.join(root,'android'));
console.log('APK ready: '+path.join(root,'android','app','build','outputs','apk','release','app-release.apk'));
