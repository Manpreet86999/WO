const {withAppBuildGradle}=require('expo/config-plugins');
module.exports=function withReleaseSigning(config){return withAppBuildGradle(config,config=>{
 let source=config.modResults.contents;
 if(source.includes('// Body OS private release signing'))return config;
 const anchor='    signingConfigs {';
 if(!source.includes(anchor))throw new Error('Android signing template changed. Review signing configuration before building.');
 source=source.replace(anchor,`${anchor}
        // Body OS private release signing
        release {
            if (findProperty('BODYOS_RELEASE_STORE_FILE')) {
                storeFile file(findProperty('BODYOS_RELEASE_STORE_FILE'))
                storePassword findProperty('BODYOS_RELEASE_STORE_PASSWORD')
                keyAlias findProperty('BODYOS_RELEASE_KEY_ALIAS')
                keyPassword findProperty('BODYOS_RELEASE_KEY_PASSWORD')
            }
        }`);
 const begin=source.indexOf('    buildTypes {');
 const before=source.slice(0,begin),after=source.slice(begin);
 const release=after.indexOf('        release {');
 if(begin<0||release<0)throw new Error('Android release template changed.');
 source=before+after.slice(0,release)+after.slice(release).replace('signingConfig signingConfigs.debug','signingConfig signingConfigs.release');
 source+=`\n// Fail before producing a release with missing signing credentials.\ngradle.taskGraph.whenReady { graph ->\n    if (graph.allTasks.any { it.project == project && it.name.toLowerCase().contains('release') } && !['android.injected.signing.store.file','android.injected.signing.store.password','android.injected.signing.key.alias','android.injected.signing.key.password'].every { project.findProperty(it) }) {\n        ['BODYOS_RELEASE_STORE_FILE','BODYOS_RELEASE_STORE_PASSWORD','BODYOS_RELEASE_KEY_ALIAS','BODYOS_RELEASE_KEY_PASSWORD'].each { key ->\n            if (!project.findProperty(key)) throw new GradleException('Missing private signing property: ' + key + '. See docs/ANDROID-APK.md')\n        }\n    }\n}\n`;
 config.modResults.contents=source;return config;
 });};

