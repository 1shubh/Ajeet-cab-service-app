import { View, Text, Image } from "react-native";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
import { logout, removeSessionFromSecureStore } from "@/redux/slice/authSlice";

const Home = () => {
  const {
    profile,
    loading: ProfileLoading,
    error: ProfileError,
  } = useSelector((state: RootState) => state.profile);
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(removeSessionFromSecureStore());
  }, []);
  
  return (
    <View className="h-screen bg-appBg pt-10 px-3">
      {/* header */}
      <View className="flex-row justify-between">
        <View>
          <Text className=" font-pregular text-white text-xs">
            Welcome Back
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-psemibold  text-yellow-400">
              {profile.name}
            </Text>
            <Text className="text-xs text-yellow-100 capitalize">
              ({profile.role})
            </Text>
          </View>
        </View>
        <View className="border border-yellow-300 w-12 h-12 rounded-full overflow-hidden items-center justify-center">
          {profile?.profile_image ? (
            <Image
              source={{ uri: profile?.profile_image }}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image source={images.noimage} className="w-7 h-7 object-cover" />
          )}
        </View>
      </View>

      {/* total earning card */}
      <View className="border border-yellow-300 mt-5 p-4 rounded-xl flex-row gap-3 bg-darkinputbg">
        <Image
          source={icons.rupeeicon}
          className="w-12 h-12"
          resizeMode="contain"
        />
        <View>
          <Text
            className="text-2xl text-white font-pregular"
            maxFontSizeMultiplier={1}
          >
            Total Earning this month
          </Text>
          <Text
            className="text-xl text-primary font-psemibold"
            maxFontSizeMultiplier={1}
          >
            ₹2000/-
          </Text>
        </View>
      </View>
      {/* total active students and active routes*/}
      <View className="mt-3 flex-row justify-between">
        <View className="border border-yellow-300  p-1 rounded-xl flex-row w-[49%] gap-1 bg-darkinputbg">
          <Image
            source={icons.studentanim}
            className="w-10 h-10"
            resizeMode="contain"
          />
          <View>
            <Text
              className="text-xl text-white font-pregular"
              maxFontSizeMultiplier={1}
            >
              Active Students
            </Text>
            <Text
              className="text-xl text-primary font-psemibold"
              maxFontSizeMultiplier={1}
            >
              200
            </Text>
          </View>
        </View>
        <View className="border border-yellow-300 p-1 rounded-xl flex-row gap-1 w-[49%] bg-darkinputbg">
          <Image
            source={icons.routeanim}
            className="w-12 h-12"
            resizeMode="contain"
          />
          <View>
            <Text
              className="text-xl text-white font-pregular"
              maxFontSizeMultiplier={1}
            >
              Active Routes
            </Text>
            <Text
              className="text-xl text-primary font-psemibold"
              maxFontSizeMultiplier={1}
            >
              10
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default Home;
