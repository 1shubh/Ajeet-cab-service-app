import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchDrivers,
  fetchPayroll,
  Driver,
  DriverStatus,
} from "@/redux/slice/driverSlice";
import { useAlert } from "@/components/AlertProvider";

const STATUS_STYLE: Record<DriverStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-950", text: "text-green-300", label: "Active" },
  on_leave: { bg: "bg-yellow-950", text: "text-yellow-300", label: "On leave" },
  inactive: { bg: "bg-gray-800", text: "text-gray-400", label: "Inactive" },
};

const FILTERS: { key: DriverStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "on_leave", label: "On leave" },
  { key: "inactive", label: "Inactive" },
];

// ------------------------------------------------------------
const DriverRow = ({ driver }: { driver: Driver }) => {
  const initials = driver.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const style = STATUS_STYLE[driver.status];
  const owes = driver.balance_due > 0;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/driver/${driver.driver_id}`)}
      className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2"
    >
      <View className="flex-row items-center gap-3">
        <View className="w-12 h-12 rounded-full border border-yellow-400/40 overflow-hidden items-center justify-center bg-[#1a1a2e]">
          {driver.profile_image ? (
            <Image
              source={{ uri: driver.profile_image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-yellow-400 font-psemibold">{initials}</Text>
          )}
        </View>

        <View className="flex-1">
          <Text
            className="text-white font-pmedium text-sm"
            numberOfLines={1}
            maxFontSizeMultiplier={1}
          >
            {driver.name}
          </Text>
          <Text className="text-gray-500 text-xs" numberOfLines={1}>
            {driver.phone ? `+91 ${driver.phone}` : "No number"}
          </Text>
        </View>

        <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
          <Text className={`text-xs ${style.text}`}>{style.label}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        <View className="flex-row items-center gap-1.5 flex-1">
          <Ionicons name="bus-outline" size={13} color="#6b7280" />
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {driver.bus_number ?? "No vehicle"}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 flex-1">
          <Ionicons name="git-branch-outline" size={13} color="#6b7280" />
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {driver.route_name ?? "No route"}
          </Text>
        </View>
        <Text
          className={`text-xs font-psemibold ${
            owes ? "text-red-400" : "text-green-400"
          }`}
          maxFontSizeMultiplier={1}
        >
          {owes ? `₹${driver.balance_due.toLocaleString("en-IN")} due` : "Settled"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ------------------------------------------------------------
export default function DriversScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const { drivers, loading, error, payroll, submitError } = useSelector(
    (s: RootState) => s.drivers
  );
  const { profile } = useSelector((s: RootState) => s.profile);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DriverStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(
    (searchTerm = search, status = filter) => {
      dispatch(fetchDrivers({ search: searchTerm, status }));
    },
    [dispatch, search, filter]
  );

  useEffect(() => {
    load();
    dispatch(fetchPayroll());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search, filter), 400);
    return () => clearTimeout(t);
  }, [search, filter]);

  useEffect(() => {
    if (submitError) {
      alert("Something went wrong", submitError, undefined, { tone: "danger" });
    }
  }, [submitError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchDrivers({ search, status: filter })),
      dispatch(fetchPayroll()),
    ]);
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-appBg" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-3">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white font-psemibold text-lg">Drivers</Text>
            <Text className="text-gray-500 text-xs">
              {drivers.length} {filter === "all" ? "total" : FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/add-driver")}
              className="bg-yellow-500 px-4 h-10 rounded-xl items-center justify-center"
            >
              <Text className="text-black font-psemibold text-xs">+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payroll snapshot */}
        {isAdmin && payroll && (
          <View className="border border-yellow-300 bg-darkinputbg rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-gray-400 text-xs mb-0.5">
                  Payroll this month
                </Text>
                <Text className="text-white text-xl font-psemibold">
                  ₹{Number(payroll.total_salary).toLocaleString("en-IN")}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-400 text-xs mb-0.5">Outstanding</Text>
                <Text
                  className={`text-xl font-psemibold ${
                    Number(payroll.total_outstanding) > 0
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  ₹{Number(payroll.total_outstanding).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>

            <View className="bg-gray-800 rounded-full h-2 mb-2">
              <View
                className="bg-green-400 rounded-full h-2"
                style={{
                  width: `${
                    Number(payroll.total_salary) > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (Number(payroll.total_paid) /
                              Number(payroll.total_salary)) *
                              100
                          )
                        )
                      : 0
                  }%`,
                }}
              />
            </View>
            <Text className="text-gray-500 text-xs">
              ₹{Number(payroll.total_paid).toLocaleString("en-IN")} paid across{" "}
              {payroll.driver_count} driver
              {payroll.driver_count === 1 ? "" : "s"}
            </Text>
          </View>
        )}

        {/* Search */}
        <View className="border-2 border-[#665524] rounded-xl px-3 mb-3 flex-row items-center gap-2">
          <Ionicons name="search" size={16} color="#6b6b6b" />
          <TextInput
            className="flex-1 text-white font-pmedium"
            style={{ height: 44 }}
            placeholder="Search name or number"
            placeholderTextColor="#6b6b6b"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Status filter */}
        <View className="flex-row gap-2 mb-3">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-xl border ${
                filter === f.key
                  ? "border-yellow-400 bg-[#2a2412]"
                  : "border-gray-700 bg-darkinputbg"
              }`}
            >
              <Text
                className={`text-xs font-pmedium ${
                  filter === f.key ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={drivers}
        keyExtractor={(item) => item.driver_id}
        renderItem={({ item }) => <DriverRow driver={item} />}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FACC15"
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#FACC15" className="mt-10" />
          ) : (
            <View className="items-center mt-16 px-8">
              <Text className="text-gray-300 font-pmedium text-base mb-2">
                {search || filter !== "all"
                  ? "No drivers match"
                  : "No drivers yet"}
              </Text>
              <Text className="text-gray-600 text-xs text-center mb-6">
                {search || filter !== "all"
                  ? "Try a different search or filter"
                  : "Add your first driver to assign routes and track salaries."}
              </Text>
              {isAdmin && !search && filter === "all" && (
                <TouchableOpacity
                  onPress={() => router.push("/add-driver")}
                  className="bg-yellow-500 px-6 h-12 rounded-xl items-center justify-center"
                >
                  <Text className="text-black font-psemibold text-sm">
                    Add driver
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {error && (
        <View className="border border-red-900 bg-red-950 rounded-xl p-3 mx-3 mb-3">
          <Text className="text-red-300 text-xs">{error}</Text>
        </View>
      )}
    </View>
  );
}