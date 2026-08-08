// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { useColorScheme, View, ActivityIndicator } from "react-native";
import { SplashScreen, Stack } from "expo-router";
import "../global.css";
import { Provider } from "react-redux";
import { useFonts } from "expo-font";
import { store } from "@/redux/store";
import { StatusBar } from "expo-status-bar";
import AuthGate from "@/components/AuthGate";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Keep the splash up until we say otherwise
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    "Poppins-Black": require("../../assets/fonts/Poppins-Black.ttf"),
    "Poppins-Bold": require("../../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-ExtraBold": require("../../assets/fonts/Poppins-ExtraBold.ttf"),
    "Poppins-ExtraLight": require("../../assets/fonts/Poppins-ExtraLight.ttf"),
    "Poppins-Light": require("../../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Medium": require("../../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-Regular": require("../../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Thin": require("../../assets/fonts/Poppins-Thin.ttf"),
    "Avega-Italic": require("../../assets/fonts/Avega-Italic.ttf"),
    CampanaScript: require("../../assets/fonts/CampanaScript.otf"),
    Writeline: require("../../assets/fonts/Writeline.ttf"),
    "DancingScript-SemiBold": require("../../assets/fonts/DancingScript-SemiBold.ttf"),
    "DancingScript-Bold": require("../../assets/fonts/DancingScript-Bold.ttf"),
  });

  useEffect(() => {
    if (fontError) {
      console.error("Font loading failed:", fontError);
      SplashScreen.hideAsync(); // don't leave users stuck on splash
    }
  }, [fontError]);

  // Hold the splash until fonts resolve
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="verifyotp" />
              <Stack.Screen name="(admin)" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen name="(student)" />
              <Stack.Screen
                name="add-student"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="add-route"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen name="myadmissions" />
              <Stack.Screen name="student/[id]" />
              <Stack.Screen name="student/edit/[id]" />
              <Stack.Screen name="route/[id]" />
            </Stack>
          </AuthGate>
          <StatusBar style="light" />
        </ThemeProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
