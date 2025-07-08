
import 'dotenv/config';

export default {
  expo: {
    name: "Shariaa Analyzer",
    slug: "Sariah-AI",
    version: "1.0.0",
    scheme: "com.shariaa.analyzer",
    description: "A Shariah-compliant contract analyzer app",
    orientation: "portrait",
    icon: "./client/public/logo-shariaa.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./client/public/logo-shariaa.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.shariaaanalyzer.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./client/public/logo-shariaa.png",
        backgroundColor: "#10b981"
      },
      package: "com.shariaaanalyzer.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      favicon: "./client/public/logo-shariaa.png",
      bundler: "metro"
    },
    plugins: [
      "expo-dev-client",
      "expo-camera",
      "expo-image-picker",
      [
        "expo-document-picker",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ],
      "expo-secure-store"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      API_URL: process.env.API_URL || "http://localhost:5000"
    }
  }
};
