// Work around Expo's IDE stub-PCH command parsing when project paths contain spaces.
const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(__dirname, '../node_modules/expo-modules-core/android/build.gradle');
const before = "          def cmd = entry.command\n            // Replace the forced-include path: `-Xclang -include -Xclang <path>/cmake_pch.hxx`\n            .replaceAll(/-Xclang -include -Xclang [^\\s]+cmake_pch\\.hxx(?=\\s)/, java.util.regex.Matcher.quoteReplacement(\"-Xclang -include -Xclang ${stubHeaderPath}\"))\n            // Replace the source file operand: `<path>/cmake_pch.hxx.cxx`\n            .replaceAll(/[^\\s]+cmake_pch\\.hxx\\.cxx/, java.util.regex.Matcher.quoteReplacement(stubHeaderPath))\n\n          def process = new ProcessBuilder(cmd.split(\" \").toList())\n";
const after = "          // Body OS: preserve quoted paths such as E:/Workout OS during IDE sync.\n          def args = entry.arguments != null\n            ? entry.arguments.toList()\n            : org.apache.tools.ant.types.Commandline.translateCommandline(entry.command).toList()\n          args = args.collect { arg ->\n            (arg.endsWith(\"cmake_pch.hxx\") || arg.endsWith(\"cmake_pch.hxx.cxx\")) ? stubHeaderPath : arg\n          }\n\n          def process = new ProcessBuilder(args)\n";
const source = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
if (source.includes(after)) process.exit(0);
if (!source.includes(before)) throw new Error('Expo PCH helper changed; review the Windows path workaround before building.');
fs.writeFileSync(target, source.replace(before, after));
console.log('Applied Expo IDE PCH quoted-path fix.');
