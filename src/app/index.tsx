import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ToastAndroid,
} from "react-native";
import React, { useEffect, useState } from "react";
import { images } from "@/constants/images";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  getSession,
  getSessionFromSecureStore,
  logout,
  removeSessionFromSecureStore,
  sendOtp,
  setSession,
} from "@/redux/slice/authSlice";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { fetchUserProfile } from "@/redux/slice/userdetails";
const Welcome = () => {
  const {
    profile,
    loading: ProfileLoading,
    error: ProfileError,
  } = useSelector((state: RootState) => state.profile);
  const [phone, setPhone] = useState("");
  const dispatch = useDispatch<AppDispatch>();
  const { session, message, loading, error, otpSent } = useSelector(
    (state: RootState) => state.auth,
  );
  const handleSendOtp = async () => {
    let result = await dispatch(sendOtp(phone));
    console.log(result);
  };

  useEffect(() => {
    if (error) {
      ToastAndroid.showWithGravity(
        error,
        ToastAndroid.SHORT,
        ToastAndroid.CENTER,
      );
    } else if (message) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  }, [error, message]);

  useEffect(() => {
    if (otpSent) {
      router.push("/verifyotp");
    }
  }, [otpSent]);

  useEffect(() => {
    const restoreSession = async () => {
      const stored = await getSessionFromSecureStore();
      if (stored) {
        dispatch(setSession(stored));
        dispatch(fetchUserProfile(stored.user_id));
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (session && profile) {
      if (profile?.role === "admin") {
        router.push("/(admin)");
      } else if (profile?.role === "student") {
        router.push("/(student)");
      } else if (profile?.role === "driver") {
        router.push("/(driver)");
      }
    }
  }, [session, profile]);

  if (ProfileLoading) {
    return (
      <View className="flex-1 items-center justify-center h-full">
        <Text>Please wait...</Text>
      </View>
    );
  }
  return (
    <View className="bg-[#06151e] h-screen pt-10 px-4 justify-between pb-20">
      <View className="border border-[#665524] h-10 rounded-3xl w-[60%] bg-[#2a2412] flex-row items-center justify-center gap-2 px-3">
        <View className="w-2 h-2 bg-yellow-300 rounded-full" />
        <Text className="text-yellow-300 uppercase font-pmedium mt-0.5">
          Safe & Verified Rides
        </Text>
      </View>
      <View className="gap-8">
        <View className="items-end">
          <Text className="text-4xl font-pbold text-white">Trust,</Text>
          <Text className="text-4xl font-pbold text-white">Safety</Text>
          <Text className="text-5xl font-pbold text-yellow-400">
            Ajeet Cab.
          </Text>
        </View>
        <View className="items-center">
          <Image
            source={images.logo}
            className="w-40 h-40"
            resizeMode="contain"
          />
        </View>
        <View className="items">
          <Text className="text-4xl font-pbold text-white">Reliable Rides</Text>
          <Text className="text-4xl font-pbold text-white">for Your</Text>
          <Text className="text-5xl font-pbold text-yellow-400">
            Little Ones.
          </Text>
        </View>
      </View>
      <View>
        <Text className="text-white font-pregular ml-2 mb-1">
          Enter Registered Mobile Number
        </Text>
        <View className="border-2 border-[#665524] rounded-xl flex-row items-center px-2 gap-1">
          <Text className="text-white font-pmedium">+91</Text>
          <TextInput
            className="w-full text-white font-pmedium"
            placeholder="Enter mobile "
            placeholderTextColor={"#b0b0b0"}
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
            keyboardType="phone-pad"
          />
        </View>
        <TouchableOpacity
          className={`h-12 justify-center rounded-xl border ${phone.length === 10 || loading ? "bg-yellow-500 border-yellow-500" : "bg-gray-400 border-gray-400"} flex flex-row items-center gap-1 mt-5`}
          disabled={phone.length !== 10 || loading}
          onPress={handleSendOtp}
        >
          <Text
            className={`font-psemibold ${
              phone.length === 10 || loading ? "text-black" : "text-gray-700"
            }`}
          >
            {loading ? "Sending" : "Send OTP"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Welcome;
