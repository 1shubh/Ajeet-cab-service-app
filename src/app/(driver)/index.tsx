// src/app/(driver)/index.tsx
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import React, { useEffect } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchMyAdmissionStats } from "@/redux/slice/admissionslice";


export default function DriverHome() {
  const dispatch = useDispatch<AppDispatch>();
  const { profile } = useSelector((s: RootState) => s.profile);
  const { myStats } = useSelector((s: RootState) => s.admissions);

  useEffect(() => {
    dispatch(fetchMyAdmissionStats());
  }, []);

  return (
    <ScrollView className="flex-1 bg-appBg px-3 pt-12">
      <Text className="text-white text-xs font-pregular">Welcome Back</Text>
      <Text className="text-yellow-400 font-psemibold text-lg mb-6">
        {profile?.name}
      </Text>

      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 border border-yellow-300 bg-darkinputbg rounded-xl p-3">
          <Text className="text-gray-400 text-xs mb-1">Students admitted</Text>
          <Text className="text-yellow-400 text-2xl font-psemibold">
            {myStats?.total_admissions ?? 0}
          </Text>
        </View>
        <View className="flex-1 border border-gray-700 bg-darkinputbg rounded-xl p-3">
          <Text className="text-gray-400 text-xs mb-1">This month</Text>
          <Text className="text-green-400 text-2xl font-psemibold">
            {myStats?.admissions_this_month ?? 0}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/add-student")}
        className="bg-yellow-500 h-14 rounded-xl items-center justify-center mb-2"
      >
        <Text className="text-black font-psemibold">Admit new student</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/myadmissions")}
        className="border border-yellow-300 h-14 rounded-xl items-center justify-center"
      >
        <Text className="text-yellow-400 font-psemibold">
          View my admissions
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}