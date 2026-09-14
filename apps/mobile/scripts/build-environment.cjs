const fs = require('node:fs');
const path = require('node:path');
const workspace = path.resolve(__dirname, '../../..');
const tools = path.join(workspace, '.build-tools');
function configure() {
  const env = process.env;
  env.JAVA_HOME = path.join(tools, 'jdk-17');
  env.ANDROID_HOME = 'E:\\Android';
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
  env.GRADLE_USER_HOME = path.join(tools, 'gradle-home');
  env.ANDROID_USER_HOME = path.join(tools, 'android-user');
  env.ANDROID_EMULATOR_HOME = env.ANDROID_USER_HOME;
  env.ANDROID_AVD_HOME = path.join(tools, 'avd');
  env.npm_config_cache = path.join(tools, 'npm-cache');
  env.__UNSAFE_EXPO_HOME_DIRECTORY = path.join(tools, 'expo-home');
  env.DOTSLASH_CACHE = path.join(tools, 'dotslash-cache');
  env.TEMP = env.TMP = path.join(tools, 'temp');
  for (const key of ['GRADLE_USER_HOME','ANDROID_USER_HOME','ANDROID_AVD_HOME','npm_config_cache','__UNSAFE_EXPO_HOME_DIRECTORY','DOTSLASH_CACHE','TEMP']) fs.mkdirSync(env[key], {recursive:true});
  env.PATH = [path.join(env.JAVA_HOME,'bin'),'E:\\node',path.join(env.ANDROID_HOME,'platform-tools'),env.PATH || ''].join(path.delimiter);
  return env;
}
function configureGradle() {
  const env = configure();
  const android = path.resolve(__dirname, '../android');
  const properties = path.join(android,'gradle.properties');
  let source = fs.readFileSync(properties,'utf8');
  const values = {
    'org.gradle.java.home': env.JAVA_HOME.replaceAll('\\','/'),
    'org.gradle.java.installations.paths': env.JAVA_HOME.replaceAll('\\','/'),
    'org.gradle.java.installations.auto-detect': 'false',
    'org.gradle.java.installations.auto-download': 'false',
    'org.gradle.workers.max': '2',
    'org.gradle.parallel': 'false',
    'org.gradle.jvmargs': `-Xmx2048m -XX:MaxMetaspaceSize=512m -Djava.io.tmpdir="${env.TEMP.replaceAll('\\','/')}"`,
  };
  for (const [key,value] of Object.entries(values)) {
    const pattern = new RegExp('^'+key.replaceAll('.','\\.')+'=.*$','m');
    source = pattern.test(source) ? source.replace(pattern,`${key}=${value}`) : source+`\n${key}=${value}\n`;
  }
  fs.writeFileSync(properties,source);
  fs.writeFileSync(path.join(android,'gradle/gradle-daemon-jvm.properties'),'# Body OS: use the local Java 17 installation on E:.\ntoolchainVersion=17\n');
}
module.exports = {configure,configureGradle};
if (require.main === module) configureGradle();
