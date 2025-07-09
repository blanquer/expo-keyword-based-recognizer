# expo-keyword-based-recognizer

Speech recognizer that can be triggered by a custom keyword/phrase

# API documentation

- [Documentation for the latest stable release](https://docs.expo.dev/versions/latest/sdk/keyword-based-recognizer/)
- [Documentation for the main branch](https://docs.expo.dev/versions/unversioned/sdk/keyword-based-recognizer/)

# Installation in managed Expo projects

For [managed](https://docs.expo.dev/archive/managed-vs-bare/) Expo projects, please follow the installation instructions in the [API documentation for the latest stable release](#api-documentation). If you follow the link and there is no documentation available then this library is not yet usable within managed projects &mdash; it is likely to be included in an upcoming Expo SDK release.

# Installation in bare React Native projects

For bare React Native projects, you must ensure that you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) before continuing.

### Add the package to your npm dependencies

```
npm install expo-keyword-based-recognizer
```

### Configure for Android




### Configure for iOS

Run `npx pod-install` after installing the npm package.

# Contributing

Contributions are very welcome! Please refer to guidelines described in the [contributing guide]( https://github.com/expo/expo#contributing).


# NOTES FROM JOSEP

Always ensure the build types are up to date by running this from the root:

npm run build plugin

(and kill it)

then, to test the example app:
cd example
npx expo prebuild --clean -p ios (for iOS for example)
xed ios
Compile/run the project in Xcode