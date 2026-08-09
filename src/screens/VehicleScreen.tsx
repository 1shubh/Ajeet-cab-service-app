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
  fetchVehicles,
  fetchFleet,
  clearVehicleSubmitState,
  Vehicle,
} from "@/redux/slice/vehicleSlice";
import { useAlert } from "@/components/AlertProvider";

type Filter = "all" | "unassigned" | "attention";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "attention", label: "Needs attention" },
];

const daysUntil = (date: string) =>
  Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

// ------------------------------------------------------------
const Stat = ({
  value,
  label,
  accent = "text-white",
}: {
  value: number;
  label: string;
  accent?: string;
}) => (
  <View className="flex-1 border border-gray-700 bg-darkinputbg rounded-xl p-3">
    <Text
      className={`text-xl font-psemibold ${accent}`}
      maxFontSizeMultiplier={1}
    >
      {value}
    </Text>
    <Text className="text-gray-500 text-xs mt-0.5" maxFontSizeMultiplier={1}>
      {label}
    </Text>
  </View>
);

// ------------------------------------------------------------
const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  const hasWarning = vehicle.expiring_docs > 0 || vehicle.service_overdue;

  // soonest_expiry uses 9999-12-31 as its null sentinel
  const realExpiry =
    vehicle.soonest_expiry && !vehicle.soonest_expiry.startsWith("9999")
      ? vehicle.soonest_expiry
      : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/vehicle/${vehicle.id}`)}
      className={`border rounded-xl mb-3 overflow-hidden bg-darkinputbg ${
        !vehicle.is_active
          ? "border-gray-800"
          : hasWarning
            ? "border-red-900"
            : "border-yellow-300"
      }`}
    >
      {vehicle.image ? (
        <Image
          source={{ uri: vehicle.image }}
          className="w-full h-32"
          resizeMode="cover"
        />
      ) : null}

      <View className="p-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text
              className={`font-psemibold text-base ${
                vehicle.is_active ? "text-white" : "text-gray-500"
              }`}
              numberOfLines={1}
            >
              {vehicle.bus_number}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
              {[vehicle.make, vehicle.model, vehicle.year]
                .filter(Boolean)
                .join(" · ") || "No model details"}
            </Text>
          </View>

          {!vehicle.is_active && (
            <View className="bg-gray-800 px-2 py-0.5 rounded-full">
              <Text className="text-gray-400 text-xs">Retired</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-4 pt-2 border-t border-gray-800">
          <View className="flex-row items-center gap-1.5 flex-1">
            <Ionicons name="person-outline" size={13} color="#6b7280" />
            <Text className="text-gray-400 text-xs" numberOfLines={1}>
              {vehicle.assigned_driver_name ?? "Unassigned"}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="people-outline" size={13} color="#6b7280" />
            <Text className="text-gray-400 text-xs">
              {vehicle.student_count}
            </Text>
          </View>
          {vehicle.capacity ? (
            <Text className="text-gray-600 text-xs">
              of {vehicle.capacity} seats
            </Text>
          ) : null}
        </View>

        {hasWarning && vehicle.is_active && (
          <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-gray-800">
            <Ionicons name="warning" size={13} color="#F87171" />
            <Text className="text-red-400 text-xs flex-1" numberOfLines={1}>
              {vehicle.service_overdue && "Service overdue"}
              {vehicle.service_overdue && vehicle.expiring_docs > 0 && " · "}
              {vehicle.expiring_docs > 0 &&
                `${vehicle.expiring_docs} doc${vehicle.expiring_docs === 1 ? "" : "s"} expiring`}
              {realExpiry &&
                daysUntil(realExpiry) >= 0 &&
                ` (${formatDate(realExpiry)})`}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ------------------------------------------------------------
export default function VehiclesScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert } = useAlert();

  const { vehicles, loading, error, fleet, submitError } = useSelector(
    (s: RootState) => s.vehicles
  );
  const { profile } = useSelector((s: RootState) => s.profile);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(
    (term = search, f = filter) => {
      dispatch(fetchVehicles({ search: term, filter: f }));
    },
    [dispatch, search, filter]
  );

  useEffect(() => {
    load();
    dispatch(fetchFleet());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search, filter), 400);
    return () => clearTimeout(t);
  }, [search, filter]);

  useEffect(() => {
    if (submitError) {
      alert("Something went wrong", submitError, undefined, { tone: "danger" });
      dispatch(clearVehicleSubmitState());
    }
  }, [submitError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchVehicles({ search, filter })),
      dispatch(fetchFleet()),
    ]);
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-appBg" style={{ paddingTop: insets.top + 12 }}>
      <View className="px-3">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white font-psemibold text-lg">Vehicles</Text>
            <Text className="text-gray-500 text-xs">
              {vehicles.length} in this view
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/add-vehicle")}
              className="bg-yellow-500 px-4 h-10 rounded-xl items-center justify-center"
            >
              <Text className="text-black font-psemibold text-xs">+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Fleet stats */}
        {fleet && (
          <View className="flex-row gap-2 mb-3">
            <Stat value={fleet.active_vehicles} label="Active" />
            <Stat
              value={fleet.unassigned}
              label="Unassigned"
              accent={fleet.unassigned > 0 ? "text-yellow-400" : "text-white"}
            />
            <Stat
              value={fleet.service_due}
              label="Service due"
              accent={fleet.service_due > 0 ? "text-red-400" : "text-white"}
            />
            <Stat
              value={fleet.docs_expiring}
              label="Docs due"
              accent={fleet.docs_expiring > 0 ? "text-red-400" : "text-white"}
            />
          </View>
        )}

        {/* Search */}
        <View className="border-2 border-[#665524] rounded-xl px-3 mb-3 flex-row items-center gap-2">
          <Ionicons name="search" size={16} color="#6b6b6b" />
          <TextInput
            className="flex-1 text-white font-pmedium"
            style={{ height: 44 }}
            placeholder="Search number or model"
            placeholderTextColor="#6b6b6b"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
          />
        </View>

        {/* Filters */}
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

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
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
                  ? "Nothing matches"
                  : "No vehicles yet"}
              </Text>
              <Text className="text-gray-600 text-xs text-center mb-6">
                {search || filter !== "all"
                  ? "Try a different search or filter"
                  : "Add your buses to assign them to drivers and track documents."}
              </Text>
              {isAdmin && !search && filter === "all" && (
                <TouchableOpacity
                  onPress={() => router.push("/add-vehicle")}
                  className="bg-yellow-500 px-6 h-12 rounded-xl items-center justify-center"
                >
                  <Text className="text-black font-psemibold text-sm">
                    Add vehicle
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