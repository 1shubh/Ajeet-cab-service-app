import { View, Text, Image } from "react-native";
import React from "react";
import AppTabs from "@/components/app-tabs";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { icons } from "@/constants/icons";

const TabLayout = () => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 100,
          paddingBottom: 2,
          paddingTop: 5,
          backgroundColor: "#06151e",
          borderColor: "#06151e",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                backgroundColor: focused ? "yellow" : "transparent",
                padding: 3,
                borderRadius: 8,
                width: 50,
              }}
              className="items-center"
            >
              <Image
                source={focused ? icons.home : icons.homeoutlined}
                className="w-6 h-6 object-contain"
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{ color: focused ? "yellow" : "white" }}
              className="text-[12px] font-pmedium mt-1"
            >
              Home
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="addstudent"
        options={{
          title: "Students",
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                backgroundColor: focused ? "yellow" : "transparent",
                padding: 3,
                borderRadius: 8,
                width: 50,
              }}
              className="items-center"
            >
              <Image
                source={focused ? icons.student : icons.studentoutlined}
                className="w-6 h-6 object-contain"
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{ color: focused ? "yellow" : "white" }}
              className="text-[12px] font-pmedium mt-1"
            >
              Students
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: "Drivers",
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                backgroundColor: focused ? "yellow" : "transparent",
                padding: 3,
                borderRadius: 8,
                width: 50,
              }}
              className="items-center"
            >
              <Image
                source={focused ? icons.driver : icons.driveroutlined}
                className="w-6 h-6 object-contain"
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{ color: focused ? "yellow" : "white" }}
              className="text-[12px] font-pmedium mt-1"
            >
              Drivers
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "profile",
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                backgroundColor: focused ? "yellow" : "transparent",
                padding: 3,
                borderRadius: 8,
                width: 50,
              }}
              className="items-center"
            >
              <Image
                source={focused ? icons.user : icons.useroutlined}
                className="w-5 h-6 object-contain"
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{ color: focused ? "yellow" : "white" }}
              className="text-[12px] font-pmedium mt-1"
            >
              Profile
            </Text>
          ),
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
