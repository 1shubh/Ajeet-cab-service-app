import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchRouteSummaries,
  toggleRouteActive,
  RouteSummary,
} from "@/redux/slice/routeslice";
import { useAlert } from "@/components/AlertProvider";

// ------------------------------------------------------------
// Small inline stat
// ------------------------------------------------------------
const Metric = ({ value, label }: { value: number; label: string }) => (
  <View className="items-center flex-1">
    <Text
      className="text-white font-psemibold text-base"
      maxFontSizeMultiplier={1}
    >
      {value}
    </Text>
    <Text className="text-gray-500 text-xs" maxFontSizeMultiplier={1}>
      {label}
    </Text>
  </View>
);

// ------------------------------------------------------------
// Route card
// ------------------------------------------------------------
const RouteCard = ({
  route,
  onToggle,
}: {
  route: RouteSummary;
  onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={() => router.push(`/route/${route.id}`)}
    className={`border rounded-xl p-4 mb-3 bg-darkinputbg ${
      route.is_active ? "border-yellow-300" : "border-gray-800"
    }`}
  >
    <View className="flex-row justify-between items-start mb-1">
      <View className="flex-1 mr-3">
        <Text
          className={`font-psemibold text-base ${
            route.is_active ? "text-white" : "text-gray-500"
          }`}
          numberOfLines={1}
        >
          {route.name}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {route.start_point ?? "—"} → {route.end_point ?? "—"}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onToggle}
        hitSlop={8}
        className={`px-3 py-1 rounded-full flex items-center justify-center ${
          route.is_active ? "bg-green-950" : "bg-gray-800"
        }`}
      >
        <Text
          className={`text-xs font-pmedium ${
            route.is_active ? "text-green-300" : "text-gray-400"
          }`}
        >
          {route.is_active ? "Active" : "Inactive"}
        </Text>
      </TouchableOpacity>
    </View>

    <View className="flex-row items-center mt-3 pt-3 border-t border-gray-800">
      <Metric value={route.student_count} label="Students" />
      <Metric value={route.stop_count} label="Stops" />
      <Metric value={route.driver_count} label="Drivers" />
      <View className="items-center flex-1">
        <Text
          className="text-yellow-400 font-psemibold text-base"
          maxFontSizeMultiplier={1}
        >
          ₹{route.default_fee ?? 0}
        </Text>
        <Text className="text-gray-500 text-xs" maxFontSizeMultiplier={1}>
          Fee
        </Text>
      </View>
    </View>

    {route.driver_name && (
      <Text className="text-gray-600 text-xs mt-2">
        Driver: {route.driver_name}
      </Text>
    )}
  </TouchableOpacity>
);

// ------------------------------------------------------------
// Screen
// ------------------------------------------------------------
export default function RoutesScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { summaries, loading, error, submitError } = useSelector(
    (s: RootState) => s.routes,
  );
  const { alert, confirm, toast } = useAlert();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchRouteSummaries());
  }, []);

  useEffect(() => {
    if (submitError) Alert.alert("Couldn't update route", submitError);
  }, [submitError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchRouteSummaries());
    setRefreshing(false);
  };

  const handleToggle = async (route: RouteSummary) => {
    const turningOff = route.is_active;

    const ok = await confirm({
      title: turningOff ? "Deactivate route?" : "Activate route?",
      message: turningOff
        ? "It will stop appearing when admitting new students."
        : "It will become selectable during admission.",
      confirmText: turningOff ? "Deactivate" : "Activate",
      tone: turningOff ? "danger" : "info",
    });

    if (!ok) return;

    const result = await dispatch(
      toggleRouteActive({ id: route.id, is_active: !route.is_active }),
    );

    if (toggleRouteActive.rejected.match(result)) {
      alert("Couldn't update route", result.payload as string, undefined, {
        tone: "danger",
      });
    } else {
      toast(turningOff ? "Route deactivated" : "Route activated");
    }
  };

  const activeCount = summaries.filter((r) => r.is_active).length;

  return (
    <View className="flex-1 bg-appBg px-3 pt-12">
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-white font-psemibold text-lg">Routes</Text>
          <Text className="text-gray-500 text-xs">
            {activeCount} active of {summaries.length}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/add-route")}
          className="bg-yellow-500 px-4 h-10 rounded-xl items-center justify-center"
        >
          <Text className="text-black font-psemibold text-xs">+ New route</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={summaries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RouteCard route={item} onToggle={() => handleToggle(item)} />
        )}
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
            <View className="items-center mt-20 px-8">
              <Text className="text-gray-300 font-pmedium text-base mb-2">
                Create your first route
              </Text>
              <Text className="text-gray-600 text-xs text-center mb-6">
                Students can't be assigned transport until at least one route
                exists.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/add-route")}
                className="bg-yellow-500 px-6 h-12 rounded-xl items-center justify-center"
              >
                <Text className="text-black font-psemibold text-sm">
                  Add route
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={<View className="h-8" />}
      />

      {error && (
        <View className="border border-red-900 bg-red-950 rounded-xl p-3 mb-3">
          <Text className="text-red-300 text-xs">{error}</Text>
        </View>
      )}
    </View>
  );
}
