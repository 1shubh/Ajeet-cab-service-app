import { View, Text, Image, TextInput, TouchableOpacity } from "react-native";
import React from "react";
import { images } from "@/constants/images";
import { router } from "expo-router";

const Login = () => {
  return (
    <View className="bg-[#06151e] h-screen pt-10 px-4 pb-20">
      <View className="border border-[#665524] h-10 rounded-3xl w-[60%] bg-[#2a2412] flex-row items-center justify-center gap-2 px-3">
        <View className="w-2 h-2 bg-yellow-300 rounded-full" />
        <Text className="text-yellow-300 uppercase font-pmedium mt-0.5">
          Login to your account
        </Text>
      </View>
      <View className="items-center mt-8">
        <Image
          source={images.logo}
          className="w-40 h-40"
          resizeMode="contain"
        />
      </View>
      {/* form */}
      <View className="mt-5">
        <Text className="text-white font-pregular ml-2">
          Enter Mobile Number
        </Text>

        <View className="border-2 border-[#665524] rounded-xl flex-row items-center px-2 gap-1">
          <Text className="text-white font-pmedium">+91</Text>
          <TextInput
            className="w-full text-white font-pmedium"
            placeholder="Enter mobile "
            placeholderTextColor={"#b0b0b0"}
          />
        </View>
        <TouchableOpacity
          className=" h-12 justify-center rounded-xl border bg-yellow-500 flex flex-row items-center gap-1 mt-5"
          onPress={() => router.push("/login")}
        >
          <Text className="font-psemibold text-black">Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Login;
