// components/AuthGate.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SplashScreen, useRouter, useSegments } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { supabase } from "@/lib/supabase";
import { setSession, logout } from "@/redux/slice/authSlice";
import { fetchUserProfile } from "@/redux/slice/userdetails";

const ROLE_HOME: Record<string, string> = {
  admin: "/(admin)",
  driver: "/(driver)",
  student: "/(student)",
};

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const segments = useSegments();

  const { profile } = useSelector((s: RootState) => s.profile);
  const [bootstrapped, setBootstrapped] = useState(false);

  // ----------------------------------------------------------
  // 1. Cold-start session restore
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session) {
          dispatch(setSession(session));
          // Await the profile so the first screen renders with data
          await dispatch(fetchUserProfile());
        }
      } catch (err) {
        console.error("Auth bootstrap failed:", err);
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
          SplashScreen.hideAsync();
        }
      }
    };

    bootstrap();

    // 2. Keep Redux in sync with token refresh / sign-out
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          dispatch(logout());
        } else if (session) {
          dispatch(setSession(session));
        }
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------------
  // 3. Route protection — runs after bootstrap
  // ----------------------------------------------------------
  useEffect(() => {
    if (!bootstrapped) return;

    const group = segments[0]; // "(admin)" | "login" | undefined ...
    const inProtectedGroup =
      group === "(admin)" || group === "(driver)" || group === "(student)";
    const onAuthScreen = group === "login" || group === "verifyotp" || !group;

    if (!profile && inProtectedGroup) {
      // Not signed in but sitting on a protected route
      router.replace("/login");
      return;
    }

    if (profile) {
      const home = ROLE_HOME[profile.role];

      if (onAuthScreen && home) {
        // Signed in but stuck on login — send them home
        router.replace(home as any);
        return;
      }

      // Signed in as the wrong role for this group
      if (inProtectedGroup && group !== home?.replace("/", "")) {
        router.replace(home as any);
      }
    }
  }, [bootstrapped, profile, segments]);

  if (!bootstrapped) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  return <>{children}</>;
}