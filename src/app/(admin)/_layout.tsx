// src/app/(admin)/_layout.tsx
import { View, Text, Image, Platform } from "react-native";
import React from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { icons } from "@/constants/icons";

const ACTIVE = "#FACC15";
const INACTIVE = "#9CA3AF";
const BG = "#06151e";

// ------------------------------------------------------------
// One tab item — replaces ~30 repeated lines per tab
// ------------------------------------------------------------
const TabItem = ({
  focused,
  activeIcon,
  inactiveIcon,
  label,
  iconClass = "w-6 h-6",
}: {
  focused: boolean;
  activeIcon: any;
  inactiveIcon: any;
  label: string;
  iconClass?: string;
}) => (
  <View className="items-center justify-center" style={{ width: 64 }}>
    <View
      style={{
        backgroundColor: focused ? ACTIVE : "transparent",
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      <Image
        source={focused ? activeIcon : inactiveIcon}
        className={iconClass}
        resizeMode="contain"
      />
    </View>
    <Text
      style={{ color: focused ? ACTIVE : INACTIVE, fontSize: 11 }}
      className="font-pmedium mt-1"
      numberOfLines={1}
      maxFontSizeMultiplier={1.1}
    >
      {label}
    </Text>
  </View>
);

const AdminTabLayout = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // we render our own label inside the icon
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingTop: 18,
          paddingBottom: insets.bottom || 8,
          backgroundColor: BG,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.home}
              inactiveIcon={icons.homeoutlined}
              label="Home"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="students"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.student}
              inactiveIcon={icons.studentoutlined}
              label="Students"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="drivers"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.driver}
              inactiveIcon={icons.driveroutlined}
              label="Drivers"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.route}
              inactiveIcon={icons.routeoutlined}
              label="Routes"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.user}
              inactiveIcon={icons.useroutlined}
              label="Profile"
              iconClass="w-5 h-6"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem
              focused={focused}
              activeIcon={icons.van}
              inactiveIcon={icons.vanoutlined}
              label="Van"
              iconClass="w-6 h-6"
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default AdminTabLayout;
