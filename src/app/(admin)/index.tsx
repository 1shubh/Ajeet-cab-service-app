import { View, Text, Image, ScrollView } from "react-native";
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
import { fetchUserProfile } from "@/redux/slice/userdetails";

// Add these to your redux store / types
interface AdminStats {
  totalDrivers: number;
  activeDrivers: number;
  driversOnLeave: number;
  inactiveDrivers: number;
  totalFeeCollected: number;
  pendingFees: number;
  pendingStudentsCount: number;
  feeCollectedPercent: number;
  vehicleCheckupsDue: number;
  expiringDriverDocs: number;
  newAdmissionsPending: number;
}

const StatCard = ({
  label,
  value,
  valueColor = "text-white",
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) => (
  <View className="border border-gray-700 p-3 rounded-xl bg-darkinputbg flex-1">
    <Text className="text-gray-400 text-xs mb-1" maxFontSizeMultiplier={1}>
      {label}
    </Text>
    <Text
      className={`text-lg font-psemibold ${valueColor}`}
      maxFontSizeMultiplier={1}
    >
      {value}
    </Text>
  </View>
);

const AlertCard = ({
  type,
  title,
  subtitle,
}: {
  type: "warning" | "danger" | "success";
  title: string;
  subtitle: string;
}) => {
  const colors = {
    warning: "border-yellow-700 bg-yellow-950",
    danger: "border-red-900 bg-red-950",
    success: "border-green-900 bg-green-950",
  };
  const textColors = {
    warning: "text-yellow-300",
    danger: "text-red-300",
    success: "text-green-300",
  };
  const subColors = {
    warning: "text-yellow-800",
    danger: "text-red-900",
    success: "text-green-900",
  };

  return (
    <View
      className={`border rounded-xl p-3 mb-2 flex-row items-center gap-3 ${colors[type]}`}
    >
      <View className="flex-1">
        <Text
          className={`text-xs font-psemibold ${textColors[type]}`}
          maxFontSizeMultiplier={1}
        >
          {title}
        </Text>
        <Text
          className={`text-xs ${subColors[type]}`}
          maxFontSizeMultiplier={1}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

const SectionLabel = ({ label }: { label: string }) => (
  <Text className="text-gray-500 text-xs uppercase tracking-widest mt-4 mb-2">
    {label}
  </Text>
);

const Home = () => {
  const {
    profile,
    loading: ProfileLoading,
    error: ProfileError,
  } = useSelector((state: RootState) => state.profile);

  // Wire this up to your actual redux state
  const adminStats: AdminStats = {
    totalDrivers: 24,
    activeDrivers: 18,
    driversOnLeave: 4,
    inactiveDrivers: 2,
    totalFeeCollected: 120000,
    pendingFees: 34500,
    pendingStudentsCount: 42,
    feeCollectedPercent: 78,
    vehicleCheckupsDue: 3,
    expiringDriverDocs: 5,
    newAdmissionsPending: 8,
  };

  const dispatch = useDispatch<AppDispatch>();

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, []);

  console.log(profile)

  return (
    <ScrollView
      className="h-screen bg-appBg pt-10 px-3"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="flex-row justify-between mb-4">
        <View>
          <Text className="font-pregular text-white text-xs">Welcome Back</Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-psemibold text-yellow-400">
              {profile?.name}
            </Text>
            <Text className="text-xs text-yellow-100 capitalize">
              ({profile?.role})
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

      {/* Total Earning */}
      <View className="border border-yellow-300 p-4 rounded-xl flex-row gap-3 bg-darkinputbg">
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
            ₹2,000/-
          </Text>
        </View>
      </View>

      {/* Active Students & Routes */}
      <View className="mt-3 flex-row justify-between gap-2">
        <View className="border border-yellow-300 p-3 rounded-xl flex-row gap-1 bg-darkinputbg flex-1">
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
        <View className="border border-yellow-300 p-3 rounded-xl flex-row gap-1 bg-darkinputbg flex-1">
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

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* Drivers Overview */}
          <SectionLabel label="Drivers Overview" />
          <View className="flex-row gap-2 mb-2">
            <StatCard
              label="Total Drivers"
              value={adminStats.totalDrivers}
            />
            <StatCard
              label="Active"
              value={adminStats.activeDrivers}
              valueColor="text-green-400"
            />
          </View>
          <View className="flex-row gap-2">
            <StatCard
              label="On Leave"
              value={adminStats.driversOnLeave}
              valueColor="text-yellow-400"
            />
            <StatCard
              label="Inactive"
              value={adminStats.inactiveDrivers}
              valueColor="text-red-400"
            />
          </View>

          {/* Fees Overview */}
          <SectionLabel label="Fees Overview" />
          <View className="border border-gray-700 rounded-xl bg-darkinputbg p-4">
            <View className="flex-row justify-between mb-3">
              <View>
                <Text className="text-gray-400 text-xs mb-1">
                  Total Collected
                </Text>
                <Text className="text-green-400 text-lg font-psemibold">
                  ₹{adminStats.totalFeeCollected.toLocaleString("en-IN")}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-xs mb-1">
                  Pending Fees
                </Text>
                <Text className="text-red-400 text-lg font-psemibold">
                  ₹{adminStats.pendingFees.toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View className="bg-gray-800 rounded-full h-2 mb-2">
              <View
                className="bg-green-400 rounded-full h-2"
                style={{ width: `${adminStats.feeCollectedPercent}%` }}
              />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500 text-xs">
                {adminStats.feeCollectedPercent}% collected
              </Text>
              <Text className="text-gray-500 text-xs">
                {adminStats.pendingStudentsCount} students pending
              </Text>
            </View>
          </View>

          {/* Alerts */}
          <SectionLabel label="Alerts" />
          {adminStats.vehicleCheckupsDue > 0 && (
            <AlertCard
              type="warning"
              title={`${adminStats.vehicleCheckupsDue} vehicle checkups due`}
              subtitle="Buses #4, #7, #12 need service"
            />
          )}
          {adminStats.expiringDriverDocs > 0 && (
            <AlertCard
              type="danger"
              title={`${adminStats.expiringDriverDocs} driver docs expiring soon`}
              subtitle="Licenses / permits within 30 days"
            />
          )}
          {adminStats.newAdmissionsPending > 0 && (
            <AlertCard
              type="success"
              title={`${adminStats.newAdmissionsPending} new student admissions`}
              subtitle="Pending route assignment"
            />
          )}
        </>
      )}

      <View className="h-8" />
    </ScrollView>
  );
};

export default Home;