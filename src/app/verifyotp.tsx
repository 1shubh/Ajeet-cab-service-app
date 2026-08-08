import { View, Text, Image, TextInput, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import { images } from "@/constants/images";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { verifyOtp } from "@/redux/slice/authSlice";
import { fetchUserProfile } from "@/redux/slice/userdetails";

const VerifyOtp = () => {
  const [otp, setOtp] = useState("");
  const dispatch = useDispatch<AppDispatch>();
  const {
    phone,
    session,
    message,
    loading,
    error,
    otpSent,
    otpVerified,
    user,
  } = useSelector((state: RootState) => state.auth);

  const handleVerify = async () => {
    dispatch(verifyOtp({ phone: phone, otp: otp }));
  };

 useEffect(() => {
    if (otpVerified && user) {
      // ✅ Fetch profile immediately after OTP verified,
      // THEN navigate — profile will be ready when Home mounts
      dispatch(fetchUserProfile()).then(() => {
        if (user.role === "admin") {
          router.replace("/(admin)");
        } else if (user.role === "student") {
          router.replace("/(student)");
        } else if (user.role === "driver") {
          router.replace("/(driver)");
        }
      });
    }
  }, [otpVerified]);


  return (
    <View className="bg-[#06151e] h-screen pt-10 px-4 pb-20">
      <View className="border border-[#665524] h-10 rounded-3xl w-[60%] bg-[#2a2412] flex-row items-center justify-center gap-2 px-3">
        <View className="w-2 h-2 bg-yellow-300 rounded-full" />
        <Text className="text-yellow-300 uppercase font-pmedium mt-0.5">
          enter otp
        </Text>
      </View>
      <View className="items-center mt-8">
        <Image
          source={images.logo}
          className="w-40 h-40"
          resizeMode="contain"
        />
      </View>
      <View className="mt-5">
        <Text className="text-white font-pregular ml-2">
          Enter Six Digit OTP Sent on your Mobile Number
        </Text>

        <View className="border-2 border-[#665524] rounded-xl flex-row items-center px-2 gap-1">
          <TextInput
            className="w-full text-white font-pmedium"
            placeholder="Six Digit OTP"
            placeholderTextColor={"#b0b0b0"}
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
        </View>
        <TouchableOpacity
          className=" h-12 justify-center rounded-xl border bg-yellow-500 flex flex-row items-center gap-1 mt-5"
          // onPress={() => router.push("/login")}
          onPress={() => handleVerify()}
        >
          <Text className="font-psemibold text-black">Verify</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default VerifyOtp;
